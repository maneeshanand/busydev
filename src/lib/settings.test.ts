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

  it("accepts deepseek agent/model values", () => {
    const migrated = migrateStoredSettings({
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
          agent: "deepseek",
          model: "deepseek-reasoner",
          approvalPolicy: "never",
          sandboxMode: "read-only",
        }],
      }],
    });

    expect(migrated?.projects[0].sessions[0].agent).toBe("deepseek");
    expect(migrated?.projects[0].sessions[0].model).toBe("deepseek-reasoner");
  });

  it("preserves per-run agent metadata when present", () => {
    const migrated = migrateStoredSettings({
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
          runs: [{
            id: 1,
            prompt: "hello",
            streamRows: [],
            exitCode: 0,
            durationMs: 100,
            finalSummary: "done",
            agent: "deepseek",
          }],
          todos: [],
        }],
      }],
    });

    expect(migrated?.projects[0].sessions[0].runs[0].agent).toBe("deepseek");
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

  it("preserves session-scoped todoMode, autoPlay, and worktree fields through save/load", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1",
        name: "P1",
        path: "/tmp/p1",
        createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [
          {
            id: "s1",
            projectId: "p1",
            name: "Session 1",
            createdAt: Date.now(),
            runs: [],
            todos: [],
            todoMode: true,
            autoPlay: true,
            worktreePath: "/tmp/wt/s1",
            worktreeBranch: "busydev/session-1",
          },
          {
            id: "s2",
            projectId: "p1",
            name: "Session 2",
            createdAt: Date.now(),
            runs: [],
            todos: [],
            todoMode: false,
            autoPlay: false,
          },
        ],
      }],
    });

    expect(migrated).not.toBeNull();
    const sessions = migrated!.projects[0].sessions;

    // Session 1: todoMode and autoPlay preserved as true
    expect(sessions[0].todoMode).toBe(true);
    expect(sessions[0].autoPlay).toBe(true);
    expect(sessions[0].worktreePath).toBe("/tmp/wt/s1");
    expect(sessions[0].worktreeBranch).toBe("busydev/session-1");

    // Session 2: todoMode and autoPlay preserved as false
    expect(sessions[1].todoMode).toBe(false);
    expect(sessions[1].autoPlay).toBe(false);
    expect(sessions[1].worktreePath).toBeUndefined();
    expect(sessions[1].worktreeBranch).toBeUndefined();
  });

  it("defaults todoMode and autoPlay to undefined when not set", () => {
    const migrated = migrateStoredSettings({
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
          // no todoMode, autoPlay, worktree fields
        }],
      }],
    });

    const session = migrated!.projects[0].sessions[0];
    expect(session.todoMode).toBeUndefined();
    expect(session.autoPlay).toBeUndefined();
    expect(session.worktreePath).toBeUndefined();
    expect(session.worktreeBranch).toBeUndefined();
  });

  it("does not leak todoMode/autoPlay between sessions in same project", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1",
        name: "P1",
        path: "/tmp/p1",
        createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [
          {
            id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
            runs: [], todos: [], todoMode: true, autoPlay: true,
          },
          {
            id: "s2", projectId: "p1", name: "S2", createdAt: Date.now(),
            runs: [], todos: [],
            // intentionally no todoMode/autoPlay
          },
        ],
      }],
    });

    const [s1, s2] = migrated!.projects[0].sessions;
    expect(s1.todoMode).toBe(true);
    expect(s1.autoPlay).toBe(true);
    expect(s2.todoMode).toBeUndefined();
    expect(s2.autoPlay).toBeUndefined();
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

  it("preserves TodoItem notes, agent, model, and subtasks through save/load", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
          runs: [],
          todos: [{
            id: "t1", text: "Do thing", done: false, source: "user", createdAt: 1,
            notes: "Use #shipit pattern",
            agent: "claude",
            model: "claude-opus-4-6",
            subtasks: [
              { id: "st1", text: "Step A", done: true },
              { id: "st2", text: "Step B", done: false },
            ],
          }],
        }],
      }],
    });

    const todo = migrated!.projects[0].sessions[0].todos[0];
    expect(todo.notes).toBe("Use #shipit pattern");
    expect(todo.agent).toBe("claude");
    expect(todo.model).toBe("claude-opus-4-6");
    expect(todo.subtasks).toHaveLength(2);
    expect(todo.subtasks![0]).toEqual({ id: "st1", text: "Step A", done: true });
    expect(todo.subtasks![1]).toEqual({ id: "st2", text: "Step B", done: false });
  });

  it("defaults new TodoItem fields to undefined when not set", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
          runs: [], todos: [{ id: "t1", text: "Plain", done: false, source: "user", createdAt: 1 }],
        }],
      }],
    });

    const todo = migrated!.projects[0].sessions[0].todos[0];
    expect(todo.notes).toBeUndefined();
    expect(todo.agent).toBeUndefined();
    expect(todo.model).toBeUndefined();
    expect(todo.subtasks).toBeUndefined();
  });

  it("preserves busyAgentId on Session and TodoItem", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
          runs: [],
          todos: [{
            id: "t1", text: "Do thing", done: false, source: "user", createdAt: 1,
            busyAgentId: "preset-security-reviewer",
          }],
          busyAgentId: "preset-tech-lead",
        }],
      }],
    });

    const session = migrated!.projects[0].sessions[0];
    expect(session.busyAgentId).toBe("preset-tech-lead");
    expect(session.todos[0].busyAgentId).toBe("preset-security-reviewer");
  });

  describe("TodoArchive sanitization", () => {
    const baseProject = (sessions: unknown[]) => ({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions,
      }],
    });

    const baseSession = (extras: Record<string, unknown> = {}) => ({
      id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
      runs: [], todos: [],
      ...extras,
    });

    it("preserves valid todoArchives through sanitization", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession({
          todoArchives: [
            {
              id: "arch-1",
              name: "Sprint 1",
              createdAt: 1000,
              todos: [
                { id: "t1", text: "Done task", done: true, source: "user", createdAt: 1 },
              ],
            },
          ],
        }),
      ]));

      const session = migrated!.projects[0].sessions[0];
      expect(session.todoArchives).toHaveLength(1);
      expect(session.todoArchives![0].id).toBe("arch-1");
      expect(session.todoArchives![0].name).toBe("Sprint 1");
      expect(session.todoArchives![0].createdAt).toBe(1000);
      expect(session.todoArchives![0].todos).toHaveLength(1);
      expect(session.todoArchives![0].todos[0].text).toBe("Done task");
    });

    it("filters out archives with invalid or missing required fields", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession({
          todoArchives: [
            { id: "arch-1", name: "Good", createdAt: 1000, todos: [] },
            { id: "", name: "No id", createdAt: 1000, todos: [] },
            { id: "arch-3", name: "", createdAt: 1000, todos: [] },
            { id: "arch-4", name: "No createdAt", createdAt: 0, todos: [] },
            "not-an-object",
            null,
          ],
        }),
      ]));

      const session = migrated!.projects[0].sessions[0];
      expect(session.todoArchives).toHaveLength(1);
      expect(session.todoArchives![0].id).toBe("arch-1");
    });

    it("defaults todoArchives to undefined when not present", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession(),
      ]));

      const session = migrated!.projects[0].sessions[0];
      expect(session.todoArchives).toBeUndefined();
    });

    it("filters out invalid todos within an archive but keeps the archive", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession({
          todoArchives: [
            {
              id: "arch-1",
              name: "Mixed",
              createdAt: 2000,
              todos: [
                { id: "t1", text: "Valid", done: false, source: "user", createdAt: 1 },
                { id: "t2", text: "  ", done: false, source: "user", createdAt: 2 }, // blank text
                "not-a-todo",
              ],
            },
          ],
        }),
      ]));

      const archive = migrated!.projects[0].sessions[0].todoArchives![0];
      expect(archive.todos).toHaveLength(1);
      expect(archive.todos[0].text).toBe("Valid");
    });
  });

  it("defaults busyAgentId to undefined when not set", () => {
    const migrated = migrateStoredSettings({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions: [{
          id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
          runs: [],
          todos: [{ id: "t1", text: "Plain", done: false, source: "user", createdAt: 1 }],
        }],
      }],
    });

    const session = migrated!.projects[0].sessions[0];
    expect(session.busyAgentId).toBeUndefined();
    expect(session.todos[0].busyAgentId).toBeUndefined();
  });

  it("preserves BusyAgents through save/load", () => {
    const migrated = migrateStoredSettings({
      projects: [],
      busyAgents: [
        {
          id: "preset-tech-lead", name: "My Tech Lead", role: "planning", icon: "👑",
          base: "claude", model: "claude-opus-4-6", executionMode: "full-auto",
          approvalPolicy: "full-auto", sandboxMode: "danger-full-access",
          systemPrompt: "custom prompt", isPreset: true, createdAt: 1, updatedAt: 2,
        },
        {
          id: "custom-1", name: "Release Mgr", role: "releases", icon: "🚀",
          base: "codex", model: "o3", executionMode: "balanced",
          approvalPolicy: "unless-allow-listed", sandboxMode: "workspace-write",
          systemPrompt: "handle releases", isPreset: false, createdAt: 3, updatedAt: 4,
        },
      ],
    });

    expect(migrated?.busyAgents).toHaveLength(2);
    expect(migrated?.busyAgents[0].name).toBe("My Tech Lead");
    expect(migrated?.busyAgents[0].systemPrompt).toBe("custom prompt");
    expect(migrated?.busyAgents[1].name).toBe("Release Mgr");
    expect(migrated?.busyAgents[1].isPreset).toBe(false);
  });

  it("defaults busyAgents to empty array when missing", () => {
    const migrated = migrateStoredSettings({ projects: [] });
    expect(migrated?.busyAgents).toEqual([]);
  });

  it("strips invalid BusyAgent entries", () => {
    const migrated = migrateStoredSettings({
      projects: [],
      busyAgents: [
        { id: "a", name: "", role: "x", icon: "x", base: "claude", model: "m" },
        { id: "b", name: "Good", role: "r", icon: "🔧", base: "codex", model: "m", systemPrompt: "p" },
        "not-an-object",
      ],
    });
    expect(migrated?.busyAgents).toHaveLength(1);
    expect(migrated?.busyAgents[0].name).toBe("Good");
  });

  describe("WizardPlan sanitization", () => {
    const baseProject = (sessions: unknown[]) => ({
      projects: [{
        id: "p1", name: "P", path: "/tmp/p", createdAt: Date.now(),
        activeSessionId: "s1",
        sessions,
      }],
    });

    const baseSession = (extras: Record<string, unknown> = {}) => ({
      id: "s1", projectId: "p1", name: "S1", createdAt: Date.now(),
      runs: [], todos: [],
      ...extras,
    });

    it("preserves valid wizardPlan through sanitization", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession({
          wizardPlan: {
            description: "Build auth flow",
            branch: "feat/auth",
            createdAt: 1000,
            steps: [
              { text: "Scaffold routes", notes: "Use React Router", agentSlug: "codex" },
              { text: "Add login form", notes: "", agentSlug: "claude" },
            ],
          },
        }),
      ]));

      const session = migrated!.projects[0].sessions[0];
      expect(session.wizardPlan).toBeDefined();
      expect(session.wizardPlan!.description).toBe("Build auth flow");
      expect(session.wizardPlan!.branch).toBe("feat/auth");
      expect(session.wizardPlan!.createdAt).toBe(1000);
      expect(session.wizardPlan!.steps).toHaveLength(2);
      expect(session.wizardPlan!.steps[0].text).toBe("Scaffold routes");
      expect(session.wizardPlan!.steps[0].notes).toBe("Use React Router");
      expect(session.wizardPlan!.steps[0].agentSlug).toBe("codex");
      expect(session.wizardPlan!.steps[1].text).toBe("Add login form");
    });

    it("returns undefined for wizardPlan missing description or createdAt", () => {
      const missingDescription = migrateStoredSettings(baseProject([
        baseSession({
          wizardPlan: { branch: "feat/auth", createdAt: 1000, steps: [] },
        }),
      ]));
      expect(missingDescription!.projects[0].sessions[0].wizardPlan).toBeUndefined();

      const missingCreatedAt = migrateStoredSettings(baseProject([
        baseSession({
          wizardPlan: { description: "Do something", branch: "feat/x", steps: [] },
        }),
      ]));
      expect(missingCreatedAt!.projects[0].sessions[0].wizardPlan).toBeUndefined();
    });

    it("filters out steps with empty text", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession({
          wizardPlan: {
            description: "Feature work",
            branch: "feat/x",
            createdAt: 2000,
            steps: [
              { text: "Valid step", notes: "note", agentSlug: "codex" },
              { text: "", notes: "no text", agentSlug: "claude" },
              { text: "Another valid step", notes: "", agentSlug: "" },
              "not-an-object",
            ],
          },
        }),
      ]));

      const plan = migrated!.projects[0].sessions[0].wizardPlan!;
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].text).toBe("Valid step");
      expect(plan.steps[1].text).toBe("Another valid step");
    });

    it("defaults wizardPlan to undefined when not present on session", () => {
      const migrated = migrateStoredSettings(baseProject([
        baseSession(),
      ]));

      const session = migrated!.projects[0].sessions[0];
      expect(session.wizardPlan).toBeUndefined();
    });
  });
});
