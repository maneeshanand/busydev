import type { CodexStreamEvent } from "../../invoke";
import type { StreamRow } from "../../types";

export type AgentType = "codex" | "claude" | "deepseek" | "gemini";

export type ClassifiedRow = Omit<StreamRow, "id">;

export interface AgentStreamAdapter {
  classifyEvent(event: CodexStreamEvent): ClassifiedRow;
  extractTextChunk(event: CodexStreamEvent): string | null;
  extractLastMessage(parsedJson: unknown): string | null;
}
