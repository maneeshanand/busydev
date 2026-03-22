import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";
import { AddProjectForm } from "./AddProjectForm";
import { useProjectStore } from "../../stores";

vi.mocked(open);

describe("AddProjectForm", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], isLoading: false, error: null });
    vi.mocked(open).mockResolvedValue(null);
  });

  it("calls onDone when folder picker is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    const onDone = vi.fn();
    render(<AddProjectForm onDone={onDone} />);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("auto-fills name from folder basename", async () => {
    vi.mocked(open).mockResolvedValue("/Users/me/cool-repo");
    render(<AddProjectForm onDone={vi.fn()} />);
    await vi.waitFor(() =>
      expect(screen.getByDisplayValue("cool-repo")).toBeInTheDocument(),
    );
  });

  it("shows path display after selection", async () => {
    vi.mocked(open).mockResolvedValue("/Users/me/cool-repo");
    render(<AddProjectForm onDone={vi.fn()} />);
    await vi.waitFor(() =>
      expect(screen.getByText("/Users/me/cool-repo")).toBeInTheDocument(),
    );
  });

  it("calls onDone on Cancel click", async () => {
    vi.mocked(open).mockResolvedValue("/Users/me/cool-repo");
    const onDone = vi.fn();
    render(<AddProjectForm onDone={onDone} />);
    await vi.waitFor(() => screen.getByText("Cancel"));
    await userEvent.click(screen.getByText("Cancel"));
    expect(onDone).toHaveBeenCalled();
  });
});
