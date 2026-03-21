import { useEffect, useState } from "react";
import { useProjectStore, useWorkspaceStore } from "../../stores";
import { ProjectItem } from "./ProjectItem";
import { AddProjectForm } from "./AddProjectForm";
import "./ProjectTree.css";

export function ProjectTree() {
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    fetchProjects,
    error: projectError,
  } = useProjectStore();
  const [showForm, setShowForm] = useState(false);

  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    fetchWorkspaces,
    error: workspaceError,
  } = useWorkspaceStore();

  useEffect(() => {
    fetchProjects();
    fetchWorkspaces();
  }, [fetchProjects, fetchWorkspaces]);

  const error = projectError ?? workspaceError;

  function handleSelectWorkspace(workspaceId: string, projectId: string) {
    setSelectedWorkspaceId(workspaceId);
    setSelectedProjectId(projectId);
  }

  return (
    <div className="project-tree">
      {error && <p className="project-tree__error">{error}</p>}
      {projects.length === 0 && !error && !showForm ? (
        <p className="project-tree__empty">No projects yet</p>
      ) : (
        projects.map((project) => (
          <ProjectItem
            key={project.id}
            id={project.id}
            name={project.name}
            repoPath={project.repoPath}
            workspaces={workspaces.filter((w) => w.projectId === project.id)}
            isSelected={selectedProjectId === project.id}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectProject={setSelectedProjectId}
            onSelectWorkspace={handleSelectWorkspace}
          />
        ))
      )}
      {showForm ? (
        <AddProjectForm onDone={() => setShowForm(false)} />
      ) : (
        <button className="project-tree__add" onClick={() => setShowForm(true)}>
          + Add Project
        </button>
      )}
    </div>
  );
}
