import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalTabBar } from "./TerminalTabBar";

const sessions = [
  { id: "s1", cwd: "/tmp", shell: "zsh", cols: 80, rows: 24 },
  { id: "s2", cwd: "/tmp", shell: "zsh", cols: 80, rows: 24 },
];

describe("TerminalTabBar", () => {
  it("renders tabs for each session", () => {
    render(
      <TerminalTabBar
        sessions={sessions}
        activeSessionId="s1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        disabled={false}
      />,
    );
    expect(screen.getByText("Terminal 1")).toBeInTheDocument();
    expect(screen.getByText("Terminal 2")).toBeInTheDocument();
  });

  it("applies active class to selected tab", () => {
    const { container } = render(
      <TerminalTabBar
        sessions={sessions}
        activeSessionId="s1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        disabled={false}
      />,
    );
    expect(container.querySelector(".terminal-tab-bar__tab--active")).toBeInTheDocument();
  });

  it("calls onSelect when tab clicked", async () => {
    const onSelect = vi.fn();
    render(
      <TerminalTabBar
        sessions={sessions}
        activeSessionId="s1"
        onSelect={onSelect}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        disabled={false}
      />,
    );
    await userEvent.click(screen.getByText("Terminal 2"));
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  it("calls onCreate when + clicked", async () => {
    const onCreate = vi.fn();
    render(
      <TerminalTabBar
        sessions={[]}
        activeSessionId={null}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onClose={vi.fn()}
        disabled={false}
      />,
    );
    await userEvent.click(screen.getByTitle("New terminal"));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("disables + button when disabled", () => {
    render(
      <TerminalTabBar
        sessions={[]}
        activeSessionId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClose={vi.fn()}
        disabled={true}
      />,
    );
    expect(screen.getByTitle("New terminal")).toBeDisabled();
  });
});
