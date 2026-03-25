import type { SavedPromptEntry } from "../types";

export function normalizeAlias(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function fuzzyAliasScore(target: string, query: string): number | null {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 1000 - (t.length - q.length);
  if (t.includes(q)) return 700 - (t.length - q.length);
  let qi = 0;
  let penalty = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi += 1;
    } else {
      penalty += 1;
    }
  }
  if (qi !== q.length) return null;
  return 400 - penalty;
}

export function buildAliasMap(entries: SavedPromptEntry[]): Map<string, SavedPromptEntry> {
  const map = new Map<string, SavedPromptEntry>();
  for (const entry of entries) {
    const alias = normalizeAlias(entry.alias || entry.name);
    if (!alias || map.has(alias)) continue;
    map.set(alias, { ...entry, alias });
  }
  return map;
}

export function getMentionedAliases(prompt: string, aliasMap: Map<string, SavedPromptEntry>): SavedPromptEntry[] {
  const out: SavedPromptEntry[] = [];
  const seen = new Set<string>();
  const mentionRegex = /(^|\s)@([a-zA-Z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(prompt)) !== null) {
    const alias = normalizeAlias(match[2]);
    const entry = aliasMap.get(alias);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function getMentionSuggestions(
  aliasMap: Map<string, SavedPromptEntry>,
  rawQuery: string,
  limit = 8,
): SavedPromptEntry[] {
  const query = normalizeAlias(rawQuery);
  const scored = Array.from(aliasMap.values())
    .map((entry) => {
      const aliasScore = fuzzyAliasScore(entry.alias, query);
      const nameScore = fuzzyAliasScore(normalizeAlias(entry.name), query);
      const score = Math.max(aliasScore ?? -1, nameScore ?? -1);
      return { entry, score };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.entry.alias.localeCompare(b.entry.alias))
    .slice(0, limit);
  return scored.map((item) => item.entry);
}

export function expandPromptAliases(prompt: string, aliasMap: Map<string, SavedPromptEntry>): string {
  return prompt.replace(/(^|\s)@([a-zA-Z0-9_-]+)/g, (full, prefix: string, rawAlias: string) => {
    const alias = normalizeAlias(rawAlias);
    const entry = aliasMap.get(alias);
    if (!entry) return full;
    return `${prefix}${entry.content}`;
  });
}

