import { vi } from "vitest";
import { invoke, type InvokeArgs } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

export type MockProject = {
  id: string;
  name: string;
  repoPath: string;
  createdAt: string;
};

export type MockWorkspace = {
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

let projectDb: MockProject[] = [];
let workspaceDb: MockWorkspace[] = [];
let nextId = 1;

export function resetMockDb() {
  projectDb = [];
  workspaceDb = [];
  nextId = 1;
}

export function seedProject(overrides: Partial<MockProject> = {}): MockProject {
  const project: MockProject = {
    id: `proj-${nextId++}`,
    name: "test-project",
    repoPath: "/Users/test/test-project",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  projectDb.push(project);
  return project;
}

export function seedWorkspace(
  projectId: string,
  overrides: Partial<MockWorkspace> = {},
): MockWorkspace {
  const workspace: MockWorkspace = {
    id: `ws-${nextId++}`,
    projectId,
    ticket: null,
    branch: "busydev/test-workspace",
    worktreePath: "/Users/test/test-project/.worktrees/test",
    agentAdapter: "Claude Code",
    agentConfigJson: null,
    status: "Idle",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  workspaceDb.push(workspace);
  return workspace;
}

export function setupTauriMocks() {
  mockedInvoke.mockImplementation(async (command: string, rawArgs?: InvokeArgs) => {
    const args = rawArgs as Record<string, unknown> | undefined;
    switch (command) {
      case "list_projects":
        return [...projectDb];

      case "create_project": {
        const project: MockProject = {
          id: `proj-${nextId++}`,
          name: args?.name as string,
          repoPath: args?.repoPath as string,
          createdAt: new Date().toISOString(),
        };
        projectDb.push(project);
        return project;
      }

      case "list_workspaces": {
        const pid = args?.projectId as string | undefined;
        return pid ? workspaceDb.filter((w) => w.projectId === pid) : [...workspaceDb];
      }

      case "create_workspace": {
        const workspace: MockWorkspace = {
          id: `ws-${nextId++}`,
          projectId: args?.projectId as string,
          ticket: (args?.ticket as string) ?? null,
          branch: args?.branch as string,
          worktreePath: args?.worktreePath as string,
          agentAdapter: args?.agentAdapter as string,
          agentConfigJson: null,
          status: "Idle",
          createdAt: new Date().toISOString(),
        };
        workspaceDb.push(workspace);
        return workspace;
      }

      case "start_agent_session": {
        const input = args?.input as Record<string, unknown>;
        return {
          id: `session-${nextId++}`,
          adapter: input?.adapter as string,
          workspacePath: input?.workspacePath as string,
          status: "Working",
          startedAtMs: Date.now(),
        };
      }

      case "send_agent_input":
        return undefined;

      case "stop_agent_session":
        return undefined;

      case "stream_agent_events": {
        return {
          session: {
            id: args?.id,
            adapter: "Claude Code",
            workspacePath: "/tmp",
            status: "Idle",
            startedAtMs: Date.now(),
          },
          events: [],
          nextSeq: args?.sinceSeq ?? 0,
          usage: null,
        };
      }

      case "generate_unified_diff":
        return "";

      case "accept_file_changes":
        return undefined;

      case "revert_file_changes":
        return undefined;

      case "create_terminal_session":
        return {
          id: `term-${nextId++}`,
          cwd: args?.cwd as string,
          shell: "zsh",
          cols: 80,
          rows: 24,
        };

      case "close_terminal_session":
        return undefined;

      case "resize_terminal_session":
        return {
          id: args?.id,
          cwd: "/tmp",
          shell: "zsh",
          cols: args?.cols,
          rows: args?.rows,
        };

      case "list_mcp_servers":
        return [];

      case "update_tray_badge":
        return undefined;

      case "publish_notification":
        return undefined;

      default:
        throw new Error(`Unmocked Tauri command: ${command}`);
    }
  });

  return mockedInvoke;
}
