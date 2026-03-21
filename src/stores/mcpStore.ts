import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface McpServer {
  id: string;
  name: string;
  transport: string;
  commandOrUrl: string;
  envJson: string | null;
  scope: string;
  enabled: boolean;
}

interface CreateMcpServerInput {
  name: string;
  transport: string;
  commandOrUrl: string;
  envJson?: string | null;
  scope: string;
  enabled?: boolean;
}

interface UpdateMcpServerInput {
  name: string;
  transport: string;
  commandOrUrl: string;
  envJson?: string | null;
  scope: string;
  enabled: boolean;
}

type McpStoreState = {
  servers: McpServer[];
  isLoading: boolean;
  error: string | null;
  fetchServers: () => Promise<void>;
  createServer: (input: CreateMcpServerInput) => Promise<McpServer | null>;
  updateServer: (id: string, input: UpdateMcpServerInput) => Promise<McpServer | null>;
  deleteServer: (id: string) => Promise<boolean>;
  toggleServer: (id: string, enabled: boolean) => Promise<void>;
};

export const useMcpStore = create<McpStoreState>((set, get) => ({
  servers: [],
  isLoading: false,
  error: null,

  fetchServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const servers = await invoke<McpServer[]>("list_mcp_servers");
      set({ servers, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: `Failed to fetch MCP servers: ${String(error)}` });
    }
  },

  createServer: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const server = await invoke<McpServer>("create_mcp_server", { ...input });
      set((state) => ({ servers: [...state.servers, server], isLoading: false }));
      return server;
    } catch (error) {
      set({ isLoading: false, error: `Failed to create MCP server: ${String(error)}` });
      return null;
    }
  },

  updateServer: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const server = await invoke<McpServer>("update_mcp_server", { id, ...input });
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? server : s)),
        isLoading: false,
      }));
      return server;
    } catch (error) {
      set({ isLoading: false, error: `Failed to update MCP server: ${String(error)}` });
      return null;
    }
  },

  deleteServer: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_mcp_server", { id });
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({ isLoading: false, error: `Failed to delete MCP server: ${String(error)}` });
      return false;
    }
  },

  toggleServer: async (id, enabled) => {
    const server = get().servers.find((s) => s.id === id);
    if (!server) return;
    await get().updateServer(id, {
      name: server.name,
      transport: server.transport,
      commandOrUrl: server.commandOrUrl,
      envJson: server.envJson,
      scope: server.scope,
      enabled,
    });
  },
}));
