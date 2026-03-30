// ── Types ────────────────────────────────────────────────────────────────────
export type { AgentStreamAdapter, AgentType, ClassifiedRow } from "./types";

// ── Shared helpers ────────────────────────────────────────────────────────────
export {
  cleanCommand,
  shortenPath,
  isNoisyInfraOutput,
  stripTodoMarkers,
  formatToolSummary,
  classifyLifecycleEvent,
  classifyFallbackLine,
} from "./shared";

// ── Individual adapters ───────────────────────────────────────────────────────
export { claudeAdapter } from "./claude";
export { codexAdapter } from "./codex";
export { geminiAdapter } from "./gemini";
export { deepseekAdapter } from "./deepseek";

// ── Adapter registry ──────────────────────────────────────────────────────────
import type { AgentStreamAdapter, AgentType } from "./types";
import { claudeAdapter } from "./claude";
import { codexAdapter } from "./codex";
import { geminiAdapter } from "./gemini";
import { deepseekAdapter } from "./deepseek";

const adapters: Record<AgentType, AgentStreamAdapter> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  deepseek: deepseekAdapter,
  gemini: geminiAdapter,
};

export function getAdapter(agent?: string): AgentStreamAdapter {
  if (agent && agent in adapters) {
    return adapters[agent as AgentType];
  }
  return codexAdapter;
}

export function formatAgentLabel(agent?: string): string {
  switch (agent) {
    case "claude":
      return "Claude";
    case "deepseek":
      return "DeepSeek";
    case "gemini":
      return "Gemini";
    default:
      return "Codex";
  }
}
