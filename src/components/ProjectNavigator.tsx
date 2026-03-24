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
      {projects.map((p) => (
        <div
          key={p.id}
          className={`project-chip ${p.id === activeProjectId ? "project-chip-active" : ""}`}
          onClick={() => onSelect(p.id)}
          title={p.path}
        >
          <span className="project-chip-name">{p.name}</span>
          {runningProjectIds.has(p.id) && (
            <span className="project-chip-spinner" />
          )}
          <button
            type="button"
            className="project-chip-remove"
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
      <button
        type="button"
        className="project-add"
        onClick={onAdd}
        title={addingProject ? "Loading project..." : "Add project"}
        disabled={addingProject}
      >
        {addingProject ? <span className="project-add-spinner" aria-hidden="true" /> : "+"}
      </button>
    </div>
  );
}
