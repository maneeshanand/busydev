import { describe, expect, it } from "vitest";
import { SETTINGS_VERSION, migrateStoredSettings } from "./settings";

describe("migrateStoredSettings", () => {
  it("returns null for invalid payloads", () => {
    expect(migrateStoredSettings(null)).toBeNull();
    expect(migrateStoredSettings("bad")).toBeNull();
    expect(migrateStoredSettings([])).toBeNull();
  });

  it("migrates legacy workingDirectory into project + session", () => {
    const migrated = migrateStoredSettings({
      workingDirectory: "/tmp/demo",
      agent: "claude",
      model: "claude-opus-4-6",
      approvalPolicy: "never",
      sandboxMode: "workspace-write",
      persistedRuns: [],
      todos: [],
      skipGitRepoCheck: false,
      todoMode: true,
      rightPanelWidth: 320,
      colorMode: "dark",
      debugMode: true,
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.settingsVersion).toBe(SETTINGS_VERSION);
    expect(migrated?.projects).toHaveLength(1);
    expect(migrated?.projects[0].path).toBe("/tmp/demo");
    expect(migrated?.projects[0].sessions).toHaveLength(1);
    const session = migrated?.projects[0].sessions[0];
    expect(session?.agent).toBe("claude");
    expect(session?.model).toBe("claude-opus-4-6");
    expect(session?.approvalPolicy).toBe("never");
    expect(session?.sandboxMode).toBe("workspace-write");
    expect(migrated?.activeProjectId).toBe(migrated?.projects[0].id);
  });

  it("sanitizes invalid enums and width bounds", () => {
    const migrated = migrateStoredSettings({
      colorMode: "bad-mode",
      debugMode: "yes",
      skipGitRepoCheck: "no",
      todoMode: "sure",
      rightPanelWidth: 9999,
      projects: [{
        id: "p1",
        name: "P1",
        path: "/tmp/p1",
        createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1",
          projectId: "p1",
          name: "S1",
          createdAt: Date.now(),
          runs: [],
          todos: [],
          agent: "not-real",
          model: "not-real",
          approvalPolicy: "bad",
          sandboxMode: "bad",
        }],
      }],
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.colorMode).toBe("light");
    expect(migrated?.debugMode).toBe(false);
    expect(migrated?.skipGitRepoCheck).toBe(true);
    expect(migrated?.todoMode).toBe(false);
    expect(migrated?.rightPanelWidth).toBe(500);
    const session = migrated?.projects[0].sessions[0];
    expect(session?.agent).toBe("codex");
    expect(session?.model).toBe("");
    expect(session?.approvalPolicy).toBe("full-auto");
    expect(session?.sandboxMode).toBe("read-only");
  });

  it("keeps valid activeProjectId and falls back when missing", () => {
    const withValid = migrateStoredSettings({
      projects: [{
        id: "p1",
        name: "P1",
        path: "/tmp/p1",
        createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1",
          projectId: "p1",
          name: "S1",
          createdAt: Date.now(),
          runs: [],
          todos: [],
        }],
      }],
      activeProjectId: "p1",
    });
    expect(withValid?.activeProjectId).toBe("p1");

    const withInvalid = migrateStoredSettings({
      projects: [{
        id: "p1",
        name: "P1",
        path: "/tmp/p1",
        createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1",
          projectId: "p1",
          name: "S1",
          createdAt: Date.now(),
          runs: [],
          todos: [],
        }],
      }],
      activeProjectId: "missing",
    });
    expect(withInvalid?.activeProjectId).toBe("p1");
  });

  it("applies defaults and bounds for new ui/runtime settings", () => {
    const migratedWithDefaults = migrateStoredSettings({
      projects: [],
    });

    expect(migratedWithDefaults).not.toBeNull();
    expect(migratedWithDefaults?.uiDensity).toBe("comfortable");
    expect(migratedWithDefaults?.splashEnabled).toBe(true);
    expect(migratedWithDefaults?.splashDurationMs).toBe(3000);
    expect(migratedWithDefaults?.todoAutoPlayDefault).toBe(false);
    expect(migratedWithDefaults?.includeSessionHistoryInPrompt).toBe(true);
    expect(migratedWithDefaults?.claudeAutoContinue).toBe(true);
    expect(migratedWithDefaults?.terminalFontSize).toBe(13);
    expect(migratedWithDefaults?.terminalLineHeight).toBe(1.3);
    expect(migratedWithDefaults?.promptLibrary).toEqual([]);

    const migratedWithInvalids = migrateStoredSettings({
      uiDensity: "tight",
      splashEnabled: "yes",
      splashDurationMs: 20000,
      todoAutoPlayDefault: "true",
      includeSessionHistoryInPrompt: "no",
      claudeAutoContinue: "maybe",
      terminalFontSize: 2,
      terminalLineHeight: 9,
      projects: [],
    });

    expect(migratedWithInvalids).not.toBeNull();
    expect(migratedWithInvalids?.uiDensity).toBe("comfortable");
    expect(migratedWithInvalids?.splashEnabled).toBe(true);
    expect(migratedWithInvalids?.splashDurationMs).toBe(10000);
    expect(migratedWithInvalids?.todoAutoPlayDefault).toBe(false);
    expect(migratedWithInvalids?.includeSessionHistoryInPrompt).toBe(true);
    expect(migratedWithInvalids?.claudeAutoContinue).toBe(true);
    expect(migratedWithInvalids?.terminalFontSize).toBe(10);
    expect(migratedWithInvalids?.terminalLineHeight).toBe(2);
    expect(migratedWithInvalids?.promptLibrary).toEqual([]);
  });

  it("sanitizes saved prompts/functions library entries", () => {
    const migrated = migrateStoredSettings({
      projects: [],
      promptLibrary: [
        { id: "a", name: "Ship It", alias: "shipit", kind: "function", content: "commit and push", createdAt: 1, updatedAt: 2 },
        { id: "d", name: "Release Notes", kind: "prompt", content: "draft notes", createdAt: 3, updatedAt: 4 },
        { id: "b", name: "  ", kind: "prompt", content: "valid content" },
        { id: "c", name: "Valid Prompt", kind: "prompt", content: "   " },
      ],
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.promptLibrary).toHaveLength(2);
    expect(migrated?.promptLibrary[0]).toEqual({
      id: "a",
      name: "Ship It",
      alias: "shipit",
      kind: "function",
      content: "commit and push",
      createdAt: 1,
      updatedAt: 2,
    });
    expect(migrated?.promptLibrary[1].alias).toBe("release-notes");
  });
});
