import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type Workspace = {
  id: string;
  projectId: string;
  ticket: string | null;
  branch: string;
  worktreePath: string;
  agentAdapter: string;
  agentConfigJson: string | null;
  status: string;
  createdAt: string;
};

type CreateWorkspaceInput = {
  projectId: string;
  ticket?: string | null;
  branch: string;
  worktreePath: string;
  agentAdapter: string;
  agentConfigJson?: string | null;
  status?: string;
};

type UpdateWorkspaceInput = {
  ticket?: string | null;
  branch: string;
  worktreePath: string;
  agentAdapter: string;
  agentConfigJson?: string | null;
  status: string;
};

type WorkspaceStoreState = {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  setSelectedWorkspaceId: (id: string | null) => void;
  fetchWorkspaces: (projectId?: string) => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace | null>;
  updateWorkspace: (id: string, input: UpdateWorkspaceInput) => Promise<Workspace | null>;
  deleteWorkspace: (id: string) => Promise<boolean>;
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspaces: [],
  selectedWorkspaceId: null,
  isLoading: false,
  error: null,

  setSelectedWorkspaceId: (id) => set({ selectedWorkspaceId: id }),

  fetchWorkspaces: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await invoke<Workspace[]>("list_workspaces", { projectId });
      set({ workspaces, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to fetch workspaces: ${String(error)}`,
      });
    }
  },

  createWorkspace: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await invoke<Workspace>("create_workspace", input);
      set((state) => ({
        workspaces: [workspace, ...state.workspaces],
        selectedWorkspaceId: state.selectedWorkspaceId ?? workspace.id,
        isLoading: false,
      }));
      return workspace;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to create workspace: ${String(error)}`,
      });
      return null;
    }
  },

  updateWorkspace: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const workspace = await invoke<Workspace>("update_workspace", { id, ...input });
      set((state) => ({
        workspaces: state.workspaces.map((existing) => (existing.id === id ? workspace : existing)),
        isLoading: false,
      }));
      return workspace;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to update workspace: ${String(error)}`,
      });
      return null;
    }
  },

  deleteWorkspace: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_workspace", { id });
      set((state) => {
        const remaining = state.workspaces.filter((workspace) => workspace.id !== id);
        return {
          workspaces: remaining,
          selectedWorkspaceId:
            state.selectedWorkspaceId === id
              ? (remaining[0]?.id ?? null)
              : state.selectedWorkspaceId,
          isLoading: false,
        };
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to delete workspace: ${String(error)}`,
      });
      return false;
    }
  },
}));
