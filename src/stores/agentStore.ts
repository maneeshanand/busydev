import { create } from "zustand";

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

type AgentStoreState = {
  isRunning: boolean;
  usage: AgentUsage | null;
  setRunning: (running: boolean) => void;
  setUsage: (usage: AgentUsage | null) => void;
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  isRunning: false,
  usage: null,
  setRunning: (isRunning) => set({ isRunning }),
  setUsage: (usage) => set({ usage }),
}));
