import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  defaultAdapter: string;
  defaultShell: string;
  defaultModel: string;
  defaultMode: string;
  setDefaultAdapter: (adapter: string) => void;
  setDefaultShell: (shell: string) => void;
  setDefaultModel: (model: string) => void;
  setDefaultMode: (mode: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultAdapter: "Claude Code",
      defaultShell: "",
      defaultModel: "",
      defaultMode: "auto",
      setDefaultAdapter: (defaultAdapter) => set({ defaultAdapter }),
      setDefaultShell: (defaultShell) => set({ defaultShell }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      setDefaultMode: (defaultMode) => set({ defaultMode }),
    }),
    { name: "busydev-settings" },
  ),
);
