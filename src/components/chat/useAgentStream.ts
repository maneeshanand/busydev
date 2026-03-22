import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAgentStore } from "../../stores";

export type AgentStatus = "Working" | "NeedsInput" | "Idle" | "Error" | "Done";

export interface AgentEvent {
  type: "message" | "toolCall" | "toolResult" | "error" | "status";
  content?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  message?: string;
  status?: AgentStatus;
}

interface AgentEventEnvelope {
  seq: number;
  timestampMs: number;
  event: AgentEvent;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface AgentSessionInfo {
  id: string;
  adapter: string;
  workspacePath: string;
  status: AgentStatus;
  startedAtMs: number;
}

interface AgentEventBatch {
  session: AgentSessionInfo;
  events: AgentEventEnvelope[];
  nextSeq: number;
  usage: TokenUsage | null;
}

export interface ChatEvent {
  id: string;
  source: "agent" | "user";
  event: AgentEvent;
  timestamp: number;
}

const POLL_INTERVAL_MS = 500;
const EMPTY_EVENTS: ChatEvent[] = [];

type StreamSnapshot = {
  events: ChatEvent[];
  sessionId: string | null;
  nextSeq: number;
  usage: TokenUsage | null;
  isRunning: boolean;
  error: string | null;
};

const streamSnapshots = new Map<string, StreamSnapshot>();

export function __resetAgentStreamSnapshotsForTests() {
  streamSnapshots.clear();
}

function getSnapshot(path: string | null): StreamSnapshot | null {
  if (!path) {
    return null;
  }
  return streamSnapshots.get(path) ?? null;
}

function setSnapshot(path: string | null, snapshot: StreamSnapshot): void {
  if (!path) {
    return;
  }
  streamSnapshots.set(path, snapshot);
}

function getLastStatusEvent(events: ChatEvent[]): AgentStatus | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.event.type === "status" && event.event.status) {
      return event.event.status;
    }
  }
  return null;
}

export function useAgentStream(worktreePath: string | null, adapter: string | null) {
  const snapshot = getSnapshot(worktreePath);
  const [events, setEvents] = useState<ChatEvent[]>(snapshot?.events ?? EMPTY_EVENTS);
  const [sessionId, setSessionId] = useState<string | null>(snapshot?.sessionId ?? null);
  const [isRunning, setIsRunning] = useState(snapshot?.isRunning ?? false);
  const [usage, setUsage] = useState<TokenUsage | null>(snapshot?.usage ?? null);
  const [error, setError] = useState<string | null>(snapshot?.error ?? null);
  const nextSeqRef = useRef<number>(snapshot?.nextSeq ?? 0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<AgentStatus | null>(getLastStatusEvent(snapshot?.events ?? EMPTY_EVENTS));

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const appendEvents = useCallback(
    (build: (prev: ChatEvent[]) => ChatEvent[]) => {
      setEvents((prev) => {
        const next = build(prev);
        const current = getSnapshot(worktreePath);
        setSnapshot(worktreePath, {
          events: next,
          sessionId: current?.sessionId ?? sessionId,
          nextSeq: current?.nextSeq ?? nextSeqRef.current,
          usage: current?.usage ?? usage,
          isRunning: current?.isRunning ?? isRunning,
          error: current?.error ?? error,
        });
        return next;
      });
    },
    [error, isRunning, sessionId, usage, worktreePath],
  );

  const addErrorEvent = useCallback(
    (msg: string) => {
      appendEvents((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          source: "agent",
          event: { type: "error", message: msg },
          timestamp: Date.now(),
        },
      ]);
    },
    [appendEvents],
  );

  const poll = useCallback(
    async (id: string) => {
      try {
        const batch = await invoke<AgentEventBatch>("stream_agent_events", {
          id,
          sinceSeq: nextSeqRef.current,
        });

        if (batch.events.length > 0) {
          const newEvents: ChatEvent[] = [];
          for (const env of batch.events) {
            const nextEvent: ChatEvent = {
              id: `${id}-${env.seq}`,
              source: "agent",
              event: env.event,
              timestamp: env.timestampMs,
            };

            if (nextEvent.event.type === "status") {
              const nextStatus = nextEvent.event.status ?? null;
              if (!nextStatus || nextStatus === lastStatusRef.current) {
                continue;
              }
              lastStatusRef.current = nextStatus;
            }

            newEvents.push(nextEvent);
          }

          if (newEvents.length > 0) {
            appendEvents((prev) => [...prev, ...newEvents]);
          }
        }

        nextSeqRef.current = batch.nextSeq;
        setUsage(batch.usage);

        if (batch.session.status !== lastStatusRef.current) {
          lastStatusRef.current = batch.session.status;
          appendEvents((prev) => [
            ...prev,
            {
              id: `status-${id}-${batch.nextSeq}-${Date.now()}`,
              source: "agent",
              event: { type: "status", status: batch.session.status },
              timestamp: Date.now(),
            },
          ]);
        }

        const running = batch.session.status === "Working";
        setIsRunning(running);

        if (
          batch.session.status === "Done" ||
          batch.session.status === "Error" ||
          batch.session.status === "Idle"
        ) {
          setSessionId(null);
        }

        if (!running) {
          stopPolling();
        }
      } catch (err) {
        const message = String(err);
        setError(message);
        addErrorEvent(message);
        setIsRunning(false);
        stopPolling();
      }
    },
    [addErrorEvent, appendEvents, stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      nextSeqRef.current = 0;
      pollRef.current = setInterval(() => {
        void poll(id);
      }, POLL_INTERVAL_MS);
      void poll(id);
    },
    [poll, stopPolling],
  );

  const startSession = useCallback(async (): Promise<string> => {
    if (!worktreePath || !adapter) {
      throw new Error("Path or adapter is missing.");
    }

    try {
      const session = await invoke<AgentSessionInfo>("start_agent_session", {
        input: { adapter, workspacePath: worktreePath },
      });
      setSessionId(session.id);
      setIsRunning(true);
      setError(null);
      setSnapshot(worktreePath, {
        events,
        sessionId: session.id,
        nextSeq: nextSeqRef.current,
        usage,
        isRunning: true,
        error: null,
      });
      startPolling(session.id);
      return session.id;
    } catch (err) {
      const message = String(err);
      setError(message);
      throw new Error(message);
    }
  }, [adapter, events, startPolling, usage, worktreePath]);

  const sendInput = useCallback(
    async (message: string) => {
      appendEvents((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          source: "user",
          event: { type: "message", content: message },
          timestamp: Date.now(),
        },
      ]);

      let id = sessionId;
      if (!id) {
        try {
          id = await startSession();
        } catch (err) {
          const detail =
            err instanceof Error && err.message
              ? err.message
              : "Check that the adapter and path are configured correctly.";
          addErrorEvent(`Failed to start agent session: ${detail}`);
          return;
        }
      }

      try {
        await invoke("send_agent_input", { id, input: message });
        if (!pollRef.current) {
          setIsRunning(true);
          startPolling(id);
        }
      } catch (err) {
        const errMessage = String(err);
        if (errMessage.includes("agent stdin is closed")) {
          setSessionId(null);
          try {
            const nextId = await startSession();
            await invoke("send_agent_input", { id: nextId, input: message });
            if (!pollRef.current) {
              setIsRunning(true);
              startPolling(nextId);
            }
            return;
          } catch (retryErr) {
            addErrorEvent(String(retryErr));
            return;
          }
        }

        addErrorEvent(errMessage);
      }
    },
    [addErrorEvent, appendEvents, sessionId, startPolling, startSession],
  );

  const stopSession = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    try {
      await invoke("stop_agent_session", { id: sessionId });
      stopPolling();
      setIsRunning(false);
    } catch (err) {
      setError(String(err));
    }
  }, [sessionId, stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Reset stream state when the selected workspace changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    stopPolling();
    const restored = getSnapshot(worktreePath);
    if (restored) {
      setEvents(restored.events);
      setSessionId(restored.sessionId);
      setIsRunning(restored.isRunning);
      setUsage(restored.usage);
      setError(restored.error);
      nextSeqRef.current = restored.nextSeq;
      lastStatusRef.current = getLastStatusEvent(restored.events);
      return;
    }

    setEvents([]);
    setSessionId(null);
    setIsRunning(false);
    setUsage(null);
    setError(null);
    nextSeqRef.current = 0;
    lastStatusRef.current = null;
  }, [worktreePath, stopPolling]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    setSnapshot(worktreePath, {
      events,
      sessionId,
      nextSeq: nextSeqRef.current,
      usage,
      isRunning,
      error,
    });
  }, [error, events, isRunning, sessionId, usage, worktreePath]);

  useEffect(() => {
    useAgentStore.getState().setRunning(isRunning);
  }, [isRunning]);

  useEffect(() => {
    useAgentStore.getState().setUsage(
      usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            estimatedCostUsd: usage.estimatedCostUsd,
          }
        : null,
    );
  }, [usage]);

  return {
    events,
    isRunning,
    usage,
    error,
    sendInput,
    stopSession,
  };
}
