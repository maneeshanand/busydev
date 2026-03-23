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
});

