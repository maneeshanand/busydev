import { useState } from "react";
import type { Project, AgentGroup, BusyAgent } from "../types";
import "./ProjectNavigator.css";

interface ProjectNavigatorProps {
  projects: Project[];
  activeProjectId: string | null;
  runningProjectIds: Set<string>;
  addingProject: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  agentGroups: AgentGroup[];
  busyAgents: BusyAgent[];
  onCreateGroup: (name: string, agentIds: string[], sharedContext: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<AgentGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onActivateGroup: (groupId: string) => void;
}

export function ProjectNavigator({
  projects,
  activeProjectId,
  runningProjectIds,
  addingProject,
  onSelect,
  onAdd,
  onRemove,
  agentGroups,
  busyAgents,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onActivateGroup,
}: ProjectNavigatorProps) {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupAgentIds, setGroupAgentIds] = useState<string[]>([]);
  const [groupContext, setGroupContext] = useState("");

  function openNewGroupForm() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupAgentIds([]);
    setGroupContext("");
    setShowGroupForm(true);
  }

  function openEditGroupForm(group: AgentGroup) {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupAgentIds([...group.agentIds]);
    setGroupContext(group.sharedContext);
    setShowGroupForm(true);
  }

  function handleGroupSubmit() {
    if (!groupName.trim() || groupAgentIds.length === 0) return;
    if (editingGroupId) {
      onUpdateGroup(editingGroupId, { name: groupName.trim(), agentIds: groupAgentIds, sharedContext: groupContext });
    } else {
      onCreateGroup(groupName.trim(), groupAgentIds, groupContext);
    }
    setShowGroupForm(false);
  }

  function toggleGroupAgent(agentId: string) {
    setGroupAgentIds((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  }

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

      <div className="project-nav-header">GROUPS</div>
      <div className="group-list">
        {agentGroups.map((group) => (
          <div key={group.id} className="group-item">
            <span className="group-item-name" onClick={() => onActivateGroup(group.id)} title="Activate group">
              {group.name}
            </span>
            <span className="group-item-count">{group.agentIds.length}</span>
            <button type="button" className="group-item-edit" onClick={() => openEditGroupForm(group)} title="Edit">✎</button>
            <button type="button" className="group-item-remove" onClick={() => onDeleteGroup(group.id)} title="Delete">×</button>
          </div>
        ))}
        <button type="button" className="group-add-button" onClick={openNewGroupForm}>
          + New Group
        </button>
      </div>

      {showGroupForm && (
        <div className="group-form">
          <div className="group-form-header">{editingGroupId ? "Edit Group" : "New Group"}</div>
          <input
            className="group-form-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name..."
            autoFocus
          />
          <div className="group-form-label">Agents</div>
          <div className="group-form-agents">
            {busyAgents.map((ba) => (
              <label key={ba.id} className="group-form-agent">
                <input
                  type="checkbox"
                  checked={groupAgentIds.includes(ba.id)}
                  onChange={() => toggleGroupAgent(ba.id)}
                />
                <span>{ba.name}</span>
              </label>
            ))}
            {busyAgents.length === 0 && <div className="group-form-empty">No BusyAgents defined</div>}
          </div>
          <div className="group-form-label">Shared Context</div>
          <textarea
            className="group-form-context"
            value={groupContext}
            onChange={(e) => setGroupContext(e.target.value)}
            placeholder="System prompt shared by all agents in this group..."
            rows={4}
          />
          <div className="group-form-actions">
            <button type="button" className="group-form-cancel" onClick={() => setShowGroupForm(false)}>Cancel</button>
            <button type="button" className="group-form-save" onClick={handleGroupSubmit} disabled={!groupName.trim() || groupAgentIds.length === 0}>
              {editingGroupId ? "Save" : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
