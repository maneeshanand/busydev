import type { Project } from "../types";
import "./ProjectNavigator.css";

interface ProjectNavigatorProps {
  projects: Project[];
  activeProjectId: string | null;
  runningProjectIds: Set<string>;
  addingProject: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function ProjectNavigator({
  projects,
  activeProjectId,
  runningProjectIds,
  addingProject,
  onSelect,
  onAdd,
  onRemove,
}: ProjectNavigatorProps) {
  return (
    <div className="project-nav">
      <button
        type="button"
        className="project-add-button"
        onClick={onAdd}
        title={addingProject ? "Loading project..." : "Add project"}
        disabled={addingProject}
      >
        <span className="project-add-icon">{addingProject ? "..." : "+"}</span>
        <span className="project-add-text">Add project</span>
      </button>

      <div className="project-nav-header">PROJECTS</div>
      <div className="project-list">
        {projects.map((p) => (
          <div
            key={p.id}
            className={`project-item ${p.id === activeProjectId ? "project-item-active" : ""}`}
            onClick={() => onSelect(p.id)}
            title={p.path}
          >
            <span className="project-item-name">{p.name}</span>
            <div className="project-item-status-container">
              {runningProjectIds.has(p.id) && (
                <span className="project-item-status-dot" />
              )}
            </div>
            <button
              type="button"
              className="project-item-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(p.id);
              }}
              title="Remove project"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
