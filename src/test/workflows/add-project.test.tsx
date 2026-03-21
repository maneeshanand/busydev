/**
 * Workflow: Add a Project
 *
 * User clicks "+ Add Project" → folder picker opens → project appears in sidebar.
 * After adding, the project should be visible and selectable.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { open } from "@tauri-apps/plugin-dialog";
import { ProjectTree } from "../../components/sidebar/ProjectTree";
import { useProjectStore, useWorkspaceStore } from "../../stores";
import { setupTauriMocks, resetMockDb } from "../mockTauri";

describe("Workflow: Add a Project", () => {
  beforeEach(() => {
    resetMockDb();
    setupTauriMocks();
    useProjectStore.setState({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      selectedWorkspaceId: null,
      isLoading: false,
      error: null,
    });
  });

  it("shows empty state when no projects exist", async () => {
    render(<ProjectTree />);
    await waitFor(() => {
      expect(screen.getByText("No projects yet")).toBeInTheDocument();
    });
  });

  it("shows + Add Project button", async () => {
    render(<ProjectTree />);
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });
  });

  it("opens folder picker when Add Project is clicked", async () => {
    vi.mocked(open).mockResolvedValue("/Users/test/my-repo");
    render(<ProjectTree />);

    await waitFor(() => screen.getByText("+ Add Project"));
    await userEvent.click(screen.getByText("+ Add Project"));

    // Folder picker should have been called
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ directory: true }),
    );
  });

  it("creates project after folder selection and shows it in the tree", async () => {
    vi.mocked(open).mockResolvedValue("/Users/test/my-repo");
    render(<ProjectTree />);

    await waitFor(() => screen.getByText("+ Add Project"));
    await userEvent.click(screen.getByText("+ Add Project"));

    // After picker, name should auto-fill from basename
    await waitFor(() => {
      expect(screen.getByDisplayValue("my-repo")).toBeInTheDocument();
    });

    // Submit the form
    await userEvent.click(screen.getByText("Add"));

    // Project should appear in the tree
    await waitFor(() => {
      expect(screen.getByText("my-repo")).toBeInTheDocument();
    });

    // Store should have the project
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().projects[0].name).toBe("my-repo");
    expect(useProjectStore.getState().projects[0].repoPath).toBe("/Users/test/my-repo");
  });

  it("cancels when folder picker is dismissed", async () => {
    vi.mocked(open).mockResolvedValue(null);
    render(<ProjectTree />);

    await waitFor(() => screen.getByText("+ Add Project"));
    await userEvent.click(screen.getByText("+ Add Project"));

    // Should return to showing the Add button (form dismissed)
    await waitFor(() => {
      expect(screen.getByText("+ Add Project")).toBeInTheDocument();
    });

    // No project created
    expect(useProjectStore.getState().projects).toHaveLength(0);
  });

  it("project is selectable after creation", async () => {
    vi.mocked(open).mockResolvedValue("/Users/test/my-repo");
    render(<ProjectTree />);

    await waitFor(() => screen.getByText("+ Add Project"));
    await userEvent.click(screen.getByText("+ Add Project"));

    await waitFor(() => screen.getByDisplayValue("my-repo"));
    await userEvent.click(screen.getByText("Add"));

    await waitFor(() => screen.getByText("my-repo"));

    // Click to select the project
    await userEvent.click(screen.getByText("my-repo"));

    expect(useProjectStore.getState().selectedProjectId).toBe(
      useProjectStore.getState().projects[0].id,
    );
  });
});
