import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface TerminalSessionInfo {
  id: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
}

export function useTerminalSession(worktreePath: string | null) {
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async () => {
    if (!worktreePath) return;
    try {
      const session = await invoke<TerminalSessionInfo>("create_terminal_session", {
        cwd: worktreePath,
      });
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(session.id);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [worktreePath]);

  const closeSession = useCallback(async (id: string) => {
    try {
      await invoke("close_terminal_session", { id });
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== id);
        if (activeSessionId === id) {
          setActiveSessionId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeSessionId]);

  const resizeSession = useCallback(async (id: string, cols: number, rows: number) => {
    try {
      await invoke("resize_terminal_session", { id, cols, rows });
    } catch {
      // Resize failures are non-critical
    }
  }, []);

  return {
    sessions,
    activeSessionId,
    error,
    createSession,
    closeSession,
    selectSession: setActiveSessionId,
    resizeSession,
  };
}
