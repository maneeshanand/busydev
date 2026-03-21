import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type Project = {
  id: string;
  name: string;
  repoPath: string;
  createdAt: string;
};

type ProjectStoreState = {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;
  setSelectedProjectId: (id: string | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (name: string, repoPath: string) => Promise<Project | null>;
  updateProject: (id: string, name: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<boolean>;
};

export const useProjectStore = create<ProjectStoreState>((set) => ({
  projects: [],
  selectedProjectId: null,
  isLoading: false,
  error: null,

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await invoke<Project[]>("list_projects");
      set({ projects, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to fetch projects: ${String(error)}`,
      });
    }
  },

  createProject: async (name, repoPath) => {
    set({ isLoading: true, error: null });
    try {
      const project = await invoke<Project>("create_project", { name, repoPath });
      set((state) => ({
        projects: [project, ...state.projects],
        selectedProjectId: state.selectedProjectId ?? project.id,
        isLoading: false,
      }));
      return project;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to create project: ${String(error)}`,
      });
      return null;
    }
  },

  updateProject: async (id, name) => {
    set({ isLoading: true, error: null });
    try {
      const project = await invoke<Project>("update_project", { id, name });
      set((state) => ({
        projects: state.projects.map((existing) => (existing.id === id ? project : existing)),
        isLoading: false,
      }));
      return project;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to update project: ${String(error)}`,
      });
      return null;
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_project", { id });
      set((state) => {
        const remaining = state.projects.filter((project) => project.id !== id);
        return {
          projects: remaining,
          selectedProjectId:
            state.selectedProjectId === id ? (remaining[0]?.id ?? null) : state.selectedProjectId,
          isLoading: false,
        };
      });
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: `Failed to delete project: ${String(error)}`,
      });
      return false;
    }
  },
}));
