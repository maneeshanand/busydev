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
  const [dialogFailed, setDialogFailed] = useState(false);

  // Open folder picker immediately on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const selected = await open({ directory: true, title: "Select project repo folder" });
        if (cancelled) return;
        if (selected) {
          // Tauri dialog can return string or string[]
          const path = Array.isArray(selected) ? selected[0] : selected;
          if (path) {
            setRepoPath(path);
            const basename = path.split("/").filter(Boolean).pop() ?? "";
            setName(basename);
          } else {
            onDone();
          }
        } else {
          // User cancelled the picker
          onDone();
        }
      } catch {
        // Dialog not available — show manual fallback form
        setDialogFailed(true);
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

  // Waiting for dialog
  if (!repoPath && !dialogFailed) {
    return (
      <div className="add-project-form add-project-form--loading">
        <span className="add-project-form__hint">Select a folder...</span>
      </div>
    );
  }

  return (
    <form className="add-project-form" onSubmit={handleSubmit}>
      {repoPath ? (
        <div className="add-project-form__path-display">{repoPath}</div>
      ) : (
        <input
          className="add-project-form__input"
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repo path (e.g. /Users/me/myproject)"
          required
        />
      )}
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
