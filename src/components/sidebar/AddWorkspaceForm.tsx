import { useState } from "react";
import { useWorkspaceStore, useSettingsStore } from "../../stores";
import "./AddWorkspaceForm.css";

interface AddWorkspaceFormProps {
  projectId: string;
  repoPath: string;
  onDone: () => void;
}

export function AddWorkspaceForm({ projectId, repoPath, onDone }: AddWorkspaceFormProps) {
  const { createWorkspace } = useWorkspaceStore();
  const { defaultAdapter } = useSettingsStore();
  const [ticket, setTicket] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    const ticketVal = ticket.trim() || null;
    const slug = ticketVal
      ? ticketVal.toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : `ws-${Date.now()}`;
    const branch = `busydev/${slug}`;
    const worktreePath = `${repoPath}/.worktrees/${slug}`;

    const result = await createWorkspace({
      projectId,
      branch,
      ticket: ticketVal,
      worktreePath,
      agentAdapter: defaultAdapter,
    });

    setIsCreating(false);
    if (result) onDone();
  }

  return (
    <form className="add-workspace-form" onSubmit={handleSubmit}>
      <input
        className="add-workspace-form__input"
        type="text"
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        placeholder="Ticket or description (optional)"
        autoFocus
      />
      <div className="add-workspace-form__preview">
        {ticket.trim()
          ? `branch: busydev/${ticket.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`
          : "Press Enter to create with auto-generated name"}
      </div>
      <div className="add-workspace-form__actions">
        <button
          className="add-workspace-form__submit"
          type="submit"
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create"}
        </button>
        <button
          className="add-workspace-form__cancel"
          type="button"
          onClick={onDone}
          disabled={isCreating}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
