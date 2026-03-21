import { useEffect, useState } from "react";
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

  // Open folder picker immediately on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const selected = await open({ directory: true, title: "Select project repo folder" });
        if (cancelled) return;
        if (selected) {
          setRepoPath(selected);
          // Auto-fill name from folder basename
          const basename = selected.split("/").filter(Boolean).pop() ?? "";
          setName(basename);
        } else {
          // User cancelled the picker
          onDone();
        }
      } catch {
        // Dialog not available (Vite-only dev) — show manual form
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !repoPath.trim()) return;
    const result = await createProject(name.trim(), repoPath.trim());
    if (result) onDone();
  }

  // Don't render form until we have a path (or dialog failed)
  if (!repoPath) {
    return (
      <div className="add-project-form add-project-form--loading">
        <span className="add-project-form__hint">Select a folder...</span>
      </div>
    );
  }

  return (
    <form className="add-project-form" onSubmit={handleSubmit}>
      <div className="add-project-form__path-display">{repoPath}</div>
      <input
        className="add-project-form__input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name"
        autoFocus
        required
      />
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
