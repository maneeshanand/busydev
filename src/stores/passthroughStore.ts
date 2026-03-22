import { create } from "zustand";
import { persist } from "zustand/middleware";

const ADAPTERS = new Set(["Claude Code", "Codex"]);

type PassthroughState = {
  adapter: string;
  workspacePath: string;
  setAdapter: (adapter: string) => void;
  setWorkspacePath: (workspacePath: string) => void;
};

function normalizeAdapter(adapter: string): string {
  const value = adapter.trim();
  if (!value) {
    return "Codex";
  }
  return ADAPTERS.has(value) ? value : "Codex";
}

export const usePassthroughStore = create<PassthroughState>()(
  persist(
    (set) => ({
      adapter: "Codex",
      workspacePath: "",
      setAdapter: (adapter) => set({ adapter: normalizeAdapter(adapter) }),
      setWorkspacePath: (workspacePath) => set({ workspacePath: workspacePath.trim() }),
    }),
    { name: "busydev-passthrough" },
  ),
);
