import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddProjectForm } from "./AddProjectForm";
import { useProjectStore } from "../../stores";

describe("AddProjectForm", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], isLoading: false, error: null });
  });

  it("renders name and repo path inputs", () => {
    render(<AddProjectForm onDone={vi.fn()} />);
    expect(screen.getByPlaceholderText("Project name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Repo path/)).toBeInTheDocument();
  });

  it("renders Add and Cancel buttons", () => {
    render(<AddProjectForm onDone={vi.fn()} />);
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onDone when Cancel clicked", async () => {
    const onDone = vi.fn();
    render(<AddProjectForm onDone={onDone} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("does not submit with empty fields", async () => {
    const onDone = vi.fn();
    render(<AddProjectForm onDone={onDone} />);
    await userEvent.click(screen.getByText("Add"));
    expect(onDone).not.toHaveBeenCalled();
  });
});
