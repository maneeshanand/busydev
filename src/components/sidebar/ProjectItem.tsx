import { useState } from "react";
import type { Workspace } from "../../stores";
import { WorkspaceItem } from "./WorkspaceItem";
import { AddWorkspaceForm } from "./AddWorkspaceForm";
import "./ProjectItem.css";

interface ProjectItemProps {
  id: string;
  name: string;
  workspaces: Workspace[];
  isSelected: boolean;
  selectedWorkspaceId: string | null;
  onSelectProject: (id: string) => void;
  onSelectWorkspace: (workspaceId: string, projectId: string) => void;
}

export function ProjectItem({
  id,
  name,
  workspaces,
  isSelected,
  selectedWorkspaceId,
  onSelectProject,
  onSelectWorkspace,
}: ProjectItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function handleClick() {
    onSelectProject(id);
    setExpanded(true);
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }

  return (
    <div className="project-item">
      <button
        className={`project-item__header ${isSelected ? "project-item__header--selected" : ""}`}
        onClick={handleClick}
      >
        <span
          className={`project-item__chevron ${expanded ? "project-item__chevron--open" : ""}`}
          onClick={handleToggle}
        >
          {"\u25B6"}
        </span>
        <span className="project-item__name">{name}</span>
        <span className="project-item__count">{workspaces.length}</span>
      </button>
      {expanded && (
        <div className="project-item__children">
          {workspaces.map((ws) => (
            <WorkspaceItem
              key={ws.id}
              workspace={ws}
              isSelected={selectedWorkspaceId === ws.id}
              onSelect={onSelectWorkspace}
            />
          ))}
          {showForm ? (
            <AddWorkspaceForm projectId={id} onDone={() => setShowForm(false)} />
          ) : (
            <button
              className="project-item__add-workspace"
              onClick={() => setShowForm(true)}
            >
              + Add Workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
