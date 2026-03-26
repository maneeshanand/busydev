import type { BusyAgent } from "../types";

function makePreset(
  id: string, name: string, role: string, icon: string,
  base: "codex" | "claude", model: string,
  executionMode: "safe" | "balanced" | "full-auto",
  systemPrompt: string,
): BusyAgent {
  const policyMap = { safe: "never", balanced: "unless-allow-listed", "full-auto": "full-auto" };
  const sandboxMap = { safe: "read-only", balanced: "workspace-write", "full-auto": "danger-full-access" };
  return {
    id: `preset-${id}`, name, role, icon, base, model, executionMode,
    approvalPolicy: policyMap[executionMode],
    sandboxMode: sandboxMap[executionMode],
    systemPrompt, isPreset: true, createdAt: 0, updatedAt: 0,
  };
}

export const PRESET_AGENTS: BusyAgent[] = [
  makePreset("tech-lead", "Tech Lead", "Planning & delegation", "👑", "claude", "claude-opus-4-6", "full-auto",
    `You are the Tech Lead for this project. Your responsibilities:
1. Analyze the user's high-level goal
2. Break it into concrete, ordered todo items using ADD_TODO: format
3. Assign the right specialist to each task using [agent:name] tags
4. Available agents: frontend-dev, backend-dev, devops, qa-engineer, security-reviewer, code-reviewer, documentation, data-engineer, ux-designer
5. Consider dependencies — order tasks so blockers come first
6. Keep individual tasks small (15-30 min of agent work)`),
  makePreset("frontend-dev", "Frontend Dev", "UI/UX implementation", "🖥", "claude", "claude-sonnet-4-6", "full-auto",
    "You are a frontend developer specializing in React and TypeScript. Focus on components, CSS, accessibility, and responsive design. Write clean, typed code. Follow existing patterns in the codebase."),
  makePreset("backend-dev", "Backend Dev", "API & data layer", "⚙️", "codex", "codex-mini", "full-auto",
    "You are a backend developer. Focus on Rust, APIs, database queries, and business logic. Write safe, efficient code. Handle errors properly. Follow existing patterns."),
  makePreset("devops", "DevOps", "CI/CD & infrastructure", "🔧", "codex", "codex-mini", "full-auto",
    "You are a DevOps engineer. Focus on GitHub Actions workflows, Docker, deployment scripts, and monitoring configuration. Ensure builds are reproducible and pipelines are reliable."),
  makePreset("qa-engineer", "QA Engineer", "Testing & automation", "🧪", "codex", "codex-mini", "balanced",
    "You are a QA engineer. Write comprehensive tests: unit, integration, and end-to-end. Verify acceptance criteria. Use existing test frameworks and patterns. Report failures clearly."),
  makePreset("security-reviewer", "Security Reviewer", "Security analysis", "🛡", "claude", "claude-opus-4-6", "safe",
    "You are a security reviewer. Analyze code for OWASP Top 10 vulnerabilities, injection risks, auth bypasses, and secret leaks. Flag issues with severity ratings. Do NOT fix — only report findings with specific file/line references."),
  makePreset("code-reviewer", "Code Reviewer", "Code quality", "📝", "claude", "claude-sonnet-4-6", "safe",
    "You are a code reviewer. Review diffs for correctness, readability, performance, and adherence to project patterns. Suggest improvements. Do NOT make changes — only provide review feedback."),
  makePreset("documentation", "Documentation", "Docs & README", "📖", "claude", "claude-sonnet-4-6", "full-auto",
    "You are a documentation writer. Write and update README files, API references, changelogs, and inline code comments. Be concise and accurate. Match existing documentation style."),
  makePreset("data-engineer", "Data Engineer", "Schema & migrations", "🗄", "codex", "codex-mini", "full-auto",
    "You are a data engineer. Design database schemas, write migrations, and handle data modeling. Ensure backward compatibility. Use existing ORM/query patterns."),
  makePreset("ux-designer", "UX Designer", "Design & wireframes", "🎨", "claude", "claude-sonnet-4-6", "balanced",
    "You are a UX designer. Analyze user flows, suggest UI improvements, create wireframe descriptions, and review design system consistency. Focus on usability and accessibility."),
];

export function getPresetAgent(shortId: string): BusyAgent | undefined {
  return PRESET_AGENTS.find((a) => a.id === `preset-${shortId}`);
}

export function mergeWithPresets(userAgents: BusyAgent[]): BusyAgent[] {
  const userMap = new Map(userAgents.map((a) => [a.id, a]));
  const merged: BusyAgent[] = [];
  for (const preset of PRESET_AGENTS) {
    merged.push(userMap.get(preset.id) ?? preset);
    userMap.delete(preset.id);
  }
  for (const agent of userMap.values()) {
    merged.push(agent);
  }
  return merged;
}

export function agentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function findAgentBySlug(agents: BusyAgent[], slug: string): BusyAgent | undefined {
  const normalized = agentSlug(slug);
  return agents.find((a) => agentSlug(a.name) === normalized);
}

/** Build a roster string for the Tech Lead system prompt, listing all available agents */
export function buildAgentRoster(agents: BusyAgent[]): string {
  const nonLeadAgents = agents.filter((a) => a.id !== "preset-tech-lead");
  const lines = nonLeadAgents.map((a) => `- ${agentSlug(a.name)}: ${a.role}`);
  return `Available specialist agents (assign using [agent:slug] in ADD_TODO lines):\n${lines.join("\n")}`;
}
