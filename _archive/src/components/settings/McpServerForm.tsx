import { useState } from "react";
import { useMcpStore } from "../../stores";
import "./McpServerForm.css";

const TRANSPORTS = ["stdio", "sse"];
const SCOPES = ["global", "project"];

interface McpServerFormProps {
  onDone: () => void;
}

export function McpServerForm({ onDone }: McpServerFormProps) {
  const { createServer } = useMcpStore();
  const [name, setName] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [commandOrUrl, setCommandOrUrl] = useState("");
  const [scope, setScope] = useState("global");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !commandOrUrl.trim()) return;
    const result = await createServer({
      name: name.trim(),
      transport,
      commandOrUrl: commandOrUrl.trim(),
      scope,
    });
    if (result) onDone();
  }

  return (
    <form className="mcp-server-form" onSubmit={handleSubmit}>
      <input
        className="mcp-server-form__input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Server name"
        required
      />
      <select
        className="mcp-server-form__select"
        value={transport}
        onChange={(e) => setTransport(e.target.value)}
      >
        {TRANSPORTS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        className="mcp-server-form__input"
        type="text"
        value={commandOrUrl}
        onChange={(e) => setCommandOrUrl(e.target.value)}
        placeholder={transport === "stdio" ? "Command (e.g. npx server)" : "URL"}
        required
      />
      <select
        className="mcp-server-form__select"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
      >
        {SCOPES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="mcp-server-form__actions">
        <button className="mcp-server-form__submit" type="submit">
          Add
        </button>
        <button className="mcp-server-form__cancel" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
