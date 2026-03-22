import { describe, it, expect } from "vitest";
import { parseDiff } from "./parseDiff";

describe("parseDiff", () => {
  it("parses empty string to empty array", () => {
    expect(parseDiff("")).toEqual([]);
  });

  it("parses a single file diff with one hunk", () => {
    const raw = `diff --git a/README.md b/README.md
index abc1234..def5678 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 line one
-old line
+new line
+added line
 line three`;

    const files = parseDiff(raw);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("README.md");
    expect(files[0].additions).toBe(2);
    expect(files[0].deletions).toBe(1);
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0].header).toContain("@@ -1,3 +1,4 @@");
  });

  it("assigns correct line numbers", () => {
    const raw = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,4 @@
 context
-removed
+added
+extra`;

    const files = parseDiff(raw);
    const lines = files[0].hunks[0].lines;

    expect(lines[0]).toMatchObject({ type: "context", oldLineNo: 10, newLineNo: 10 });
    expect(lines[1]).toMatchObject({ type: "remove", oldLineNo: 11, newLineNo: null });
    expect(lines[2]).toMatchObject({ type: "add", oldLineNo: null, newLineNo: 11 });
    expect(lines[3]).toMatchObject({ type: "add", oldLineNo: null, newLineNo: 12 });
  });

  it("parses multiple files", () => {
    const raw = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1 @@
-old
+new
diff --git a/b.ts b/b.ts
--- a/b.ts
+++ b/b.ts
@@ -1 +1,2 @@
 keep
+added`;

    const files = parseDiff(raw);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("a.ts");
    expect(files[1].path).toBe("b.ts");
  });

  it("parses multiple hunks in one file", () => {
    const raw = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-old1
+new1
 ctx
@@ -10,2 +10,2 @@
-old2
+new2
 ctx`;

    const files = parseDiff(raw);
    expect(files[0].hunks).toHaveLength(2);
    expect(files[0].additions).toBe(2);
    expect(files[0].deletions).toBe(2);
  });

  it("handles diff with no changes gracefully", () => {
    const raw = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts`;

    const files = parseDiff(raw);
    expect(files).toHaveLength(1);
    expect(files[0].hunks).toHaveLength(0);
    expect(files[0].additions).toBe(0);
    expect(files[0].deletions).toBe(0);
  });
});
