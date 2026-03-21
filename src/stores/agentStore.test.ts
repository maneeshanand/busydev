import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "./agentStore";

describe("agentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({ isRunning: false, usage: null });
  });

  it("starts with default state", () => {
    const state = useAgentStore.getState();
    expect(state.isRunning).toBe(false);
    expect(state.usage).toBeNull();
  });

  it("sets running state", () => {
    useAgentStore.getState().setRunning(true);
    expect(useAgentStore.getState().isRunning).toBe(true);

    useAgentStore.getState().setRunning(false);
    expect(useAgentStore.getState().isRunning).toBe(false);
  });

  it("sets usage", () => {
    const usage = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.0042,
    };
    useAgentStore.getState().setUsage(usage);
    expect(useAgentStore.getState().usage).toEqual(usage);
  });

  it("clears usage", () => {
    useAgentStore.getState().setUsage({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCostUsd: 0.0042,
    });
    useAgentStore.getState().setUsage(null);
    expect(useAgentStore.getState().usage).toBeNull();
  });
});
