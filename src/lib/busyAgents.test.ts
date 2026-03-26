import { describe, expect, it } from "vitest";
import { PRESET_AGENTS, mergeWithPresets, agentSlug, findAgentBySlug, getPresetAgent, buildAgentRoster } from "./busyAgents";
import type { BusyAgent } from "../types";

describe("PRESET_AGENTS", () => {
  it("has 10 preset agents", () => {
    expect(PRESET_AGENTS).toHaveLength(10);
  });

  it("all presets have isPreset=true and preset- ID prefix", () => {
    for (const agent of PRESET_AGENTS) {
      expect(agent.isPreset).toBe(true);
      expect(agent.id).toMatch(/^preset-/);
    }
  });

  it("all presets have required fields populated", () => {
    for (const agent of PRESET_AGENTS) {
      expect(agent.name.length).toBeGreaterThan(0);
      expect(agent.role.length).toBeGreaterThan(0);
      expect(agent.icon.length).toBeGreaterThan(0);
      expect(agent.systemPrompt.length).toBeGreaterThan(0);
      expect(["codex", "claude"]).toContain(agent.base);
    }
  });
});

describe("getPresetAgent", () => {
  it("finds preset by short ID", () => {
    expect(getPresetAgent("tech-lead")?.name).toBe("Tech Lead");
    expect(getPresetAgent("nonexistent")).toBeUndefined();
  });
});

describe("mergeWithPresets", () => {
  it("returns presets when no user agents", () => {
    const merged = mergeWithPresets([]);
    expect(merged).toHaveLength(10);
    expect(merged[0].name).toBe("Tech Lead");
  });

  it("user override replaces matching preset", () => {
    const custom: BusyAgent = { ...PRESET_AGENTS[0], name: "My Tech Lead", systemPrompt: "custom" };
    const merged = mergeWithPresets([custom]);
    expect(merged).toHaveLength(10);
    expect(merged[0].name).toBe("My Tech Lead");
  });

  it("appends custom non-preset agents after presets", () => {
    const custom: BusyAgent = {
      id: "custom-1", name: "Release Manager", role: "releases", icon: "🚀",
      base: "claude", model: "claude-sonnet-4-6", executionMode: "full-auto",
      approvalPolicy: "full-auto", sandboxMode: "danger-full-access",
      systemPrompt: "handle releases", isPreset: false, createdAt: 1, updatedAt: 1,
    };
    const merged = mergeWithPresets([custom]);
    expect(merged).toHaveLength(11);
    expect(merged[10].name).toBe("Release Manager");
  });
});

describe("agentSlug", () => {
  it("converts name to lowercase hyphenated slug", () => {
    expect(agentSlug("Security Reviewer")).toBe("security-reviewer");
    expect(agentSlug("QA Engineer")).toBe("qa-engineer");
    expect(agentSlug("  Frontend Dev  ")).toBe("frontend-dev");
  });
});

describe("findAgentBySlug", () => {
  it("finds agent by slug match", () => {
    expect(findAgentBySlug(PRESET_AGENTS, "security-reviewer")?.name).toBe("Security Reviewer");
    expect(findAgentBySlug(PRESET_AGENTS, "Security Reviewer")?.name).toBe("Security Reviewer");
  });

  it("returns undefined for no match", () => {
    expect(findAgentBySlug(PRESET_AGENTS, "nonexistent")).toBeUndefined();
  });
});

describe("buildAgentRoster", () => {
  it("lists all agents except Tech Lead with slugs and roles", () => {
    const roster = buildAgentRoster(PRESET_AGENTS);
    expect(roster).toContain("frontend-dev: UI/UX implementation");
    expect(roster).toContain("security-reviewer: Security analysis");
    expect(roster).not.toContain("tech-lead");
  });

  it("includes custom agents", () => {
    const agents = mergeWithPresets([{
      id: "custom-1", name: "Release Manager", role: "Release workflow", icon: "🚀",
      base: "claude" as const, model: "claude-sonnet-4-6", executionMode: "full-auto" as const,
      approvalPolicy: "full-auto", sandboxMode: "danger-full-access",
      systemPrompt: "", isPreset: false, createdAt: 1, updatedAt: 1,
    }]);
    const roster = buildAgentRoster(agents);
    expect(roster).toContain("release-manager: Release workflow");
  });
});
