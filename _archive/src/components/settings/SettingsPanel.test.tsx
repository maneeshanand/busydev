import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "./SettingsPanel";
import { useSettingsStore } from "../../stores";

describe("SettingsPanel", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      defaultAdapter: "Claude Code",
      defaultShell: "",
      defaultModel: "",
      defaultMode: "auto",
    });
  });

  it("renders general and agent config sections", () => {
    render(<SettingsPanel />);
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Agent Config")).toBeInTheDocument();
  });

  it("renders default adapter selector", () => {
    render(<SettingsPanel />);
    const select = screen.getByDisplayValue("Claude Code");
    expect(select).toBeInTheDocument();
  });

  it("updates adapter in store on change", async () => {
    render(<SettingsPanel />);
    const select = screen.getByDisplayValue("Claude Code");
    await userEvent.selectOptions(select, "Codex");
    expect(useSettingsStore.getState().defaultAdapter).toBe("Codex");
  });

  it("renders mode selector with default auto", () => {
    render(<SettingsPanel />);
    expect(screen.getByDisplayValue("auto")).toBeInTheDocument();
  });

  it("updates shell in store on input", async () => {
    render(<SettingsPanel />);
    const input = screen.getByPlaceholderText("System default");
    await userEvent.type(input, "/bin/zsh");
    expect(useSettingsStore.getState().defaultShell).toBe("/bin/zsh");
  });
});
