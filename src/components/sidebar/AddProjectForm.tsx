import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../../stores";
import "./AddProjectForm.css";

interface AddProjectFormProps {
  onDone: () => void;
}

export function AddProjectForm({ onDone }: AddProjectFormProps) {
  const { createProject } = useProjectStore();
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");

  async function handleBrowse() {
    try {
      const selected = await open({ directory: true, title: "Select repo folder" });
      if (selected) {
        setRepoPath(selected);
      }
    } catch {
      // Dialog not available (e.g., Vite-only dev) — fall back to manual input
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !repoPath.trim()) return;
    const result = await createProject(name.trim(), repoPath.trim());
    if (result) onDone();
  }

  return (
    <form className="add-project-form" onSubmit={handleSubmit}>
      <input
        className="add-project-form__input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        autoFocus
        required
      />
      <div className="add-project-form__path-row">
        <input
          className="add-project-form__input add-project-form__input--path"
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repo path"
          required
        />
        <button
          className="add-project-form__browse"
          type="button"
          onClick={handleBrowse}
          title="Browse for folder"
        >
          {"\uD83D\uDCC2"}
        </button>
      </div>
      <div className="add-project-form__actions">
        <button className="add-project-form__submit" type="submit">
          Add
        </button>
        <button className="add-project-form__cancel" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
