import { describe, expect, it } from "vitest";
import type { LlmProvider } from "../types";
import {
  DEFAULT_PROVIDERS,
  getEnabledProviders,
  getModelsForProvider,
  getDefaultModel,
  mergeWithDefaults,
} from "./providers";

describe("DEFAULT_PROVIDERS", () => {
  it("contains codex, claude, and deepseek", () => {
    expect(DEFAULT_PROVIDERS).toHaveLength(3);
    expect(DEFAULT_PROVIDERS.map((p) => p.id)).toEqual([
      "codex",
      "claude",
      "deepseek",
    ]);
  });

  it("has codex and claude enabled, deepseek disabled", () => {
    const codex = DEFAULT_PROVIDERS.find((p) => p.id === "codex")!;
    const claude = DEFAULT_PROVIDERS.find((p) => p.id === "claude")!;
    const deepseek = DEFAULT_PROVIDERS.find((p) => p.id === "deepseek")!;
    expect(codex.enabled).toBe(true);
    expect(claude.enabled).toBe(true);
    expect(deepseek.enabled).toBe(false);
  });

  it("has correct default models", () => {
    const codex = DEFAULT_PROVIDERS.find((p) => p.id === "codex")!;
    const claude = DEFAULT_PROVIDERS.find((p) => p.id === "claude")!;
    const deepseek = DEFAULT_PROVIDERS.find((p) => p.id === "deepseek")!;
    expect(codex.defaultModel).toBe("codex-mini");
    expect(claude.defaultModel).toBe("claude-sonnet-4-6");
    expect(deepseek.defaultModel).toBe("deepseek-reasoner");
  });
});

describe("getEnabledProviders", () => {
  it("filters to enabled providers only", () => {
    const result = getEnabledProviders(DEFAULT_PROVIDERS);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["codex", "claude"]);
  });

  it("returns empty array when none enabled", () => {
    const providers: LlmProvider[] = [
      { id: "x", name: "X", enabled: false, models: ["m1"], defaultModel: "m1" },
    ];
    expect(getEnabledProviders(providers)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(getEnabledProviders([])).toEqual([]);
  });
});

describe("getModelsForProvider", () => {
  it("returns models for a known provider", () => {
    expect(getModelsForProvider(DEFAULT_PROVIDERS, "codex")).toEqual([
      "codex-mini",
      "o3",
      "o4-mini",
    ]);
  });

  it("returns empty array for unknown provider", () => {
    expect(getModelsForProvider(DEFAULT_PROVIDERS, "unknown")).toEqual([]);
  });

  it("returns empty array for empty providers list", () => {
    expect(getModelsForProvider([], "codex")).toEqual([]);
  });
});

describe("getDefaultModel", () => {
  it("returns default model for a known provider", () => {
    expect(getDefaultModel(DEFAULT_PROVIDERS, "claude")).toBe("claude-sonnet-4-6");
  });

  it("returns empty string for unknown provider", () => {
    expect(getDefaultModel(DEFAULT_PROVIDERS, "unknown")).toBe("");
  });

  it("returns empty string for empty providers list", () => {
    expect(getDefaultModel([], "codex")).toBe("");
  });
});

describe("mergeWithDefaults", () => {
  it("returns defaults when user providers is empty", () => {
    const result = mergeWithDefaults([]);
    expect(result).toEqual(DEFAULT_PROVIDERS);
  });

  it("preserves user enabled and defaultModel overrides", () => {
    const userProviders: LlmProvider[] = [
      {
        id: "deepseek",
        name: "DeepSeek",
        enabled: true,
        models: ["old-model"],
        defaultModel: "old-model",
      },
    ];
    const result = mergeWithDefaults(userProviders);
    const deepseek = result.find((p) => p.id === "deepseek")!;
    expect(deepseek.enabled).toBe(true);
    expect(deepseek.defaultModel).toBe("old-model");
  });

  it("updates models list from defaults", () => {
    const userProviders: LlmProvider[] = [
      {
        id: "codex",
        name: "Codex",
        enabled: true,
        models: ["old-codex-model"],
        defaultModel: "codex-mini",
      },
    ];
    const result = mergeWithDefaults(userProviders);
    const codex = result.find((p) => p.id === "codex")!;
    expect(codex.models).toEqual(["codex-mini", "o3", "o4-mini"]);
  });

  it("adds missing providers from defaults", () => {
    const userProviders: LlmProvider[] = [
      {
        id: "codex",
        name: "Codex",
        enabled: false,
        models: [],
        defaultModel: "codex-mini",
      },
    ];
    const result = mergeWithDefaults(userProviders);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.id)).toEqual(["codex", "claude", "deepseek"]);
    // The codex from user should preserve enabled=false
    expect(result.find((p) => p.id === "codex")!.enabled).toBe(false);
    // claude and deepseek should come from defaults
    expect(result.find((p) => p.id === "claude")!.enabled).toBe(true);
    expect(result.find((p) => p.id === "deepseek")!.enabled).toBe(false);
  });
});
