import { useWorkspaceStore } from "../../stores";
import type { Workspace } from "../../stores";
import { StatusIndicator } from "../sidebar/StatusIndicator";
import "./ChatStatusBar.css";

interface ChatStatusBarProps {
  workspace: Workspace | null;
}

const ADAPTER_OPTIONS = ["Claude Code", "Codex"] as const;

function normalizeAdapterName(adapter: string): string {
  const lowered = adapter.trim().toLowerCase();
  if (lowered === "claude" || lowered === "claude-code" || lowered === "claude_code") {
    return "Claude Code";
  }
  if (lowered === "codex") {
    return "Codex";
  }
  return adapter;
}

export function ChatStatusBar({ workspace }: ChatStatusBarProps) {
  const { updateWorkspace } = useWorkspaceStore();

  if (!workspace) {
    return (
      <div className="chat-status-bar">
        <span className="chat-status-bar__empty">No workspace selected</span>
      </div>
    );
  }

  const primaryText = workspace.ticket ?? workspace.branch;
  const selectedAdapter = normalizeAdapterName(workspace.agentAdapter);

  async function handleAdapterChange(nextAdapter: string) {
    if (nextAdapter === selectedAdapter) {
      return;
    }

    await updateWorkspace(workspace.id, {
      ticket: workspace.ticket,
      branch: workspace.branch,
      worktreePath: workspace.worktreePath,
      agentAdapter: nextAdapter,
      agentConfigJson: workspace.agentConfigJson,
      status: workspace.status,
    });
  }

  return (
    <div className="chat-status-bar">
      <StatusIndicator status={workspace.status} />
      <span className="chat-status-bar__name">{primaryText}</span>
      <label className="chat-status-bar__adapter-label" htmlFor="chat-status-adapter">
        Adapter
      </label>
      <select
        id="chat-status-adapter"
        className="chat-status-bar__adapter"
        value={selectedAdapter}
        onChange={(event) => void handleAdapterChange(event.target.value)}
      >
        {ADAPTER_OPTIONS.map((adapter) => (
          <option key={adapter} value={adapter}>
            {adapter}
          </option>
        ))}
      </select>
    </div>
  );
}
