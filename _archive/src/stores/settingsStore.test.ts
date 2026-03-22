import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      defaultAdapter: "Claude Code",
      defaultShell: "",
      defaultModel: "",
      defaultMode: "auto",
    });
  });

  it("starts with default values", () => {
    const state = useSettingsStore.getState();
    expect(state.defaultAdapter).toBe("Claude Code");
    expect(state.defaultShell).toBe("");
    expect(state.defaultModel).toBe("");
    expect(state.defaultMode).toBe("auto");
  });

  it("updates adapter", () => {
    useSettingsStore.getState().setDefaultAdapter("Codex");
    expect(useSettingsStore.getState().defaultAdapter).toBe("Codex");
  });

  it("updates shell", () => {
    useSettingsStore.getState().setDefaultShell("/bin/zsh");
    expect(useSettingsStore.getState().defaultShell).toBe("/bin/zsh");
  });

  it("updates model", () => {
    useSettingsStore.getState().setDefaultModel("claude-opus-4-6");
    expect(useSettingsStore.getState().defaultModel).toBe("claude-opus-4-6");
  });

  it("updates mode", () => {
    useSettingsStore.getState().setDefaultMode("plan");
    expect(useSettingsStore.getState().defaultMode).toBe("plan");
  });
});
