import type { LlmProvider } from "../types";

export const DEFAULT_PROVIDERS: LlmProvider[] = [
  {
    id: "codex",
    name: "Codex",
    enabled: true,
    models: ["codex-mini", "o3", "o4-mini"],
    defaultModel: "codex-mini",
  },
  {
    id: "claude",
    name: "Claude",
    enabled: true,
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    enabled: false,
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-reasoner",
  },
];

export function getEnabledProviders(providers: LlmProvider[]): LlmProvider[] {
  return providers.filter((p) => p.enabled);
}

export function getModelsForProvider(
  providers: LlmProvider[],
  providerId: string,
): string[] {
  return providers.find((p) => p.id === providerId)?.models ?? [];
}

export function getDefaultModel(
  providers: LlmProvider[],
  providerId: string,
): string {
  return providers.find((p) => p.id === providerId)?.defaultModel ?? "";
}

export function mergeWithDefaults(
  userProviders: LlmProvider[],
): LlmProvider[] {
  const userMap = new Map(userProviders.map((p) => [p.id, p]));

  return DEFAULT_PROVIDERS.map((def) => {
    const user = userMap.get(def.id);
    if (!user) return { ...def };
    return {
      ...def,
      enabled: user.enabled,
      defaultModel: user.defaultModel,
    };
  });
}
