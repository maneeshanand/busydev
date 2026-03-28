import { describe, expect, it } from "vitest";
import type { SavedPromptEntry } from "../types";
import {
  buildAliasMap,
  expandPromptAliases,
  getMentionedAliases,
  getMentionSuggestions,
  normalizeAlias,
} from "./promptAliases";

const entries: SavedPromptEntry[] = [
  {
    id: "1",
    name: "Ship It",
    alias: "shipit",
    kind: "function",
    content: "Add the changes, commit, push, and open a PR.",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "2",
    name: "Release Notes",
    alias: "release-notes",
    kind: "prompt",
    content: "Draft release notes from commits.",
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "3",
    name: "Refactor Auth",
    alias: "rf-auth",
    kind: "prompt",
    content: "Refactor authentication flow.",
    createdAt: 1,
    updatedAt: 1,
  },
];

describe("normalizeAlias", () => {
  it("normalizes to lowercase kebab with underscore support", () => {
    expect(normalizeAlias(" Ship It! ")).toBe("ship-it");
    expect(normalizeAlias("rf_auth")).toBe("rf_auth");
  });
});

describe("getMentionSuggestions", () => {
  it("returns prefix matches before weaker fuzzy matches", () => {
    const map = buildAliasMap(entries);
    const results = getMentionSuggestions(map, "sh");
    expect(results[0].alias).toBe("shipit");
  });

  it("supports fuzzy subsequence matching", () => {
    const map = buildAliasMap(entries);
    const results = getMentionSuggestions(map, "rfa");
    expect(results.some((r) => r.alias === "rf-auth")).toBe(true);
  });
});

describe("mentions and expansion", () => {
  it("extracts unique aliases present in prompt", () => {
    const map = buildAliasMap(entries);
    const found = getMentionedAliases("run #shipit then #shipit and #release-notes", map);
    expect(found.map((x) => x.alias)).toEqual(["shipit", "release-notes"]);
  });

  it("expands known aliases and leaves unknown ones unchanged", () => {
    const map = buildAliasMap(entries);
    const out = expandPromptAliases("Please #shipit and then #missing.", map);
    expect(out).toContain("Add the changes, commit, push, and open a PR.");
    expect(out).toContain("#missing");
  });
});
