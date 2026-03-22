import { useEffect, useState } from "react";
import { useMcpStore } from "../../stores";
import { McpServerForm } from "./McpServerForm";
import "./McpServerList.css";

export function McpServerList() {
  const { servers, error, fetchServers, deleteServer, toggleServer } = useMcpStore();
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="mcp-server-list">
      {error && <p className="mcp-server-list__error">{error}</p>}

      {servers.length === 0 && !error && (
        <p className="mcp-server-list__empty">No MCP servers configured</p>
      )}

      {servers.map((server) => (
        <div key={server.id} className="mcp-server-list__item">
          <div className="mcp-server-list__item-info">
            <div className="mcp-server-list__item-header">
              <span className="mcp-server-list__item-name">{server.name}</span>
              <span className="mcp-server-list__item-transport">{server.transport}</span>
            </div>
            <span className="mcp-server-list__item-url">{server.commandOrUrl}</span>
          </div>
          <div className="mcp-server-list__item-actions">
            <label className="mcp-server-list__toggle">
              <input
                type="checkbox"
                checked={server.enabled}
                onChange={(e) => toggleServer(server.id, e.target.checked)}
              />
            </label>
            <button
              className="mcp-server-list__delete"
              onClick={() => deleteServer(server.id)}
              title="Delete server"
            >
              {"\u2715"}
            </button>
          </div>
        </div>
      ))}

      {showForm ? (
        <McpServerForm onDone={() => setShowForm(false)} />
      ) : (
        <button className="mcp-server-list__add" onClick={() => setShowForm(true)}>
          + Add MCP Server
        </button>
      )}
    </div>
  );
}
