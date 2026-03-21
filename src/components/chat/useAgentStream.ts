import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { publishNotification } from "../../lib/notifications";
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

export function useAgentStream(worktreePath: string | null, adapter: string | null) {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextSeqRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedStatusRef = useRef<AgentStatus | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    async (id: string) => {
      try {
        const batch = await invoke<AgentEventBatch>("stream_agent_events", {
          id,
          sinceSeq: nextSeqRef.current,
        });

        if (batch.events.length > 0) {
          const newEvents: ChatEvent[] = batch.events.map((env) => ({
            id: `${id}-${env.seq}`,
            source: "agent" as const,
            event: env.event,
            timestamp: env.timestampMs,
          }));
          setEvents((prev) => [...prev, ...newEvents]);
          nextSeqRef.current = batch.nextSeq;

          for (const envelope of batch.events) {
            const agentEvent = envelope.event;
            if (agentEvent.type !== "error") {
              continue;
            }

            const message = agentEvent.message ?? agentEvent.content ?? "The agent reported an error.";
            void publishNotification({
              title: "Agent error",
              message,
              level: "error",
            });
          }
        }

        if (batch.usage) {
          setUsage(batch.usage);
        }

        const status = batch.session.status;
        const running = status === "Working" || status === "NeedsInput";
        setIsRunning(running);

        if (status !== notifiedStatusRef.current) {
          if (status === "NeedsInput") {
            void publishNotification({
              title: "Agent needs input",
              message: "The active session is waiting for your response.",
              level: "warning",
            });
          } else if (status === "Done") {
            void publishNotification({
              title: "Agent completed",
              message: "The active session finished successfully.",
              level: "success",
            });
          } else if (status === "Error") {
            void publishNotification({
              title: "Agent session failed",
              message: "The active session ended with an error.",
              level: "error",
            });
          }
          notifiedStatusRef.current = status;
        }

        if (!running) {
          stopPolling();
        }
      } catch (err) {
        const message = String(err);
        setError(message);
        void publishNotification({
          title: "Agent stream failed",
          message,
          level: "error",
        });
        stopPolling();
        setIsRunning(false);
      }
    },
    [stopPolling],
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      nextSeqRef.current = 0;
      pollRef.current = setInterval(() => poll(id), POLL_INTERVAL_MS);
      // Immediate first poll
      poll(id);
    },
    [poll, stopPolling],
  );

  const startSession = useCallback(async () => {
    if (!worktreePath || !adapter) return null;
    try {
      const session = await invoke<AgentSessionInfo>("start_agent_session", {
        input: { adapter, workspacePath: worktreePath },
      });
      setSessionId(session.id);
      setIsRunning(true);
      setError(null);
      startPolling(session.id);
      return session.id;
    } catch (err) {
      setError(String(err));
      return null;
    }
  }, [worktreePath, adapter, startPolling]);

  const sendInput = useCallback(
    async (message: string) => {
      // Add user message to events
      const userEvent: ChatEvent = {
        id: `user-${Date.now()}`,
        source: "user",
        event: { type: "message", content: message },
        timestamp: Date.now(),
      };
      setEvents((prev) => [...prev, userEvent]);

      let id = sessionId;
      if (!id) {
        id = await startSession();
        if (!id) return;
      }

      try {
        await invoke("send_agent_input", { id, input: message });
        if (!pollRef.current) {
          setIsRunning(true);
          startPolling(id);
        }
      } catch (err) {
        setError(String(err));
      }
    },
    [sessionId, startSession, startPolling],
  );

  const stopSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      await invoke("stop_agent_session", { id: sessionId });
      stopPolling();
      setIsRunning(false);
    } catch (err) {
      setError(String(err));
    }
  }, [sessionId, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Reset when workspace changes — setState calls are intentional batch reset
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    stopPolling();
    setEvents([]);
    setSessionId(null);
    setIsRunning(false);
    setUsage(null);
    setError(null);
    nextSeqRef.current = 0;
    notifiedStatusRef.current = null;
  }, [worktreePath, stopPolling]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sync to global agent store for StatusBar
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
