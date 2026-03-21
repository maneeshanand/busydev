import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../../stores";
import "./AddWorkspaceForm.css";

interface AddWorkspaceFormProps {
  projectId: string;
  onDone: () => void;
}

const ADAPTERS = ["claude", "codex"];

export function AddWorkspaceForm({ projectId, onDone }: AddWorkspaceFormProps) {
  const { createWorkspace } = useWorkspaceStore();
  const [branch, setBranch] = useState("");
  const [ticket, setTicket] = useState("");
  const [worktreePath, setWorktreePath] = useState("");
  const [agentAdapter, setAgentAdapter] = useState("claude");

  async function handleBrowse() {
    try {
      const selected = await open({ directory: true, title: "Select worktree folder" });
      if (selected) {
        setWorktreePath(selected);
      }
    } catch {
      // Dialog not available
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch.trim() || !worktreePath.trim()) return;
    const result = await createWorkspace({
      projectId,
      branch: branch.trim(),
      ticket: ticket.trim() || null,
      worktreePath: worktreePath.trim(),
      agentAdapter,
    });
    if (result) onDone();
  }

  return (
    <form className="add-workspace-form" onSubmit={handleSubmit}>
      <input
        className="add-workspace-form__input"
        type="text"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="Branch name"
        autoFocus
        required
      />
      <input
        className="add-workspace-form__input"
        type="text"
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        placeholder="Ticket (optional)"
      />
      <div className="add-workspace-form__path-row">
        <input
          className="add-workspace-form__input add-workspace-form__input--path"
          type="text"
          value={worktreePath}
          onChange={(e) => setWorktreePath(e.target.value)}
          placeholder="Worktree path"
          required
        />
        <button
          className="add-workspace-form__browse"
          type="button"
          onClick={handleBrowse}
          title="Browse for folder"
        >
          {"\uD83D\uDCC2"}
        </button>
      </div>
      <select
        className="add-workspace-form__select"
        value={agentAdapter}
        onChange={(e) => setAgentAdapter(e.target.value)}
      >
        {ADAPTERS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <div className="add-workspace-form__actions">
        <button className="add-workspace-form__submit" type="submit">
          Add
        </button>
        <button className="add-workspace-form__cancel" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
