import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { runCodexExec, type CodexExecOutput } from "./invoke";

function App() {
  const [approvalPolicy, setApprovalPolicy] = useState("never");
  const [sandboxMode, setSandboxMode] = useState("read-only");
  const [model, setModel] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [skipGitRepoCheck, setSkipGitRepoCheck] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodexExecOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = !running && workingDirectory.length > 0 && prompt.length > 0;

  async function handleBrowse() {
    const dir = await open({ directory: true, multiple: false });
    if (dir) setWorkingDirectory(dir as string);
  }

  async function handleRun() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const out = await runCodexExec({
        prompt,
        approvalPolicy,
        sandboxMode,
        workingDirectory,
        model: model || undefined,
        skipGitRepoCheck,
      });
      setResult(out);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container">
      <h1>busydev</h1>

      <div className="config">
        <label>
          Approval Policy
          <select value={approvalPolicy} onChange={(e) => setApprovalPolicy(e.target.value)}>
            <option value="never">never</option>
            <option value="unless-allow-listed">unless-allow-listed</option>
            <option value="full-auto">full-auto</option>
          </select>
        </label>

        <label>
          Sandbox Mode
          <select value={sandboxMode} onChange={(e) => setSandboxMode(e.target.value)}>
            <option value="read-only">read-only</option>
            <option value="workspace-write">workspace-write</option>
            <option value="danger-full-access">danger-full-access</option>
          </select>
        </label>

        <label>
          Model
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="(default)" />
        </label>

        <label>
          Working Directory
          <div className="row">
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="/path/to/project"
            />
            <button type="button" onClick={handleBrowse}>Browse</button>
          </div>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={skipGitRepoCheck}
            onChange={(e) => setSkipGitRepoCheck(e.target.checked)}
          />
          Skip git repo check
        </label>
      </div>

      <div className="prompt-section">
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
        />
        <button onClick={handleRun} disabled={!canRun}>
          {running ? "Running..." : "Run"}
        </button>
      </div>

      {error && (
        <div className="output-section">
          <h2>Error</h2>
          <pre className="stderr">{error}</pre>
        </div>
      )}

      {result && (
        <div className="output-section">
          <div className="meta">
            <span>Duration: {result.durationMs}ms</span>
            <span>Exit code: {result.exitCode ?? "N/A"}</span>
          </div>

          <h2>Stdout</h2>
          <pre className="stdout">{result.stdoutRaw || "(empty)"}</pre>

          {result.stderrRaw && (
            <>
              <h2>Stderr</h2>
              <pre className="stderr">{result.stderrRaw}</pre>
            </>
          )}

          {result.parsedJson != null && (
            <>
              <h2>Parsed JSON</h2>
              <pre className="json">{JSON.stringify(result.parsedJson, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
