export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

const FILE_HEADER_RE = /^diff --git a\/.+ b\/(.+)$/;
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = raw.split("\n");

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const fileMatch = FILE_HEADER_RE.exec(line);
    if (fileMatch) {
      currentFile = { path: fileMatch[1], hunks: [], additions: 0, deletions: 0 };
      files.push(currentFile);
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    // Skip meta lines (index, ---, +++)
    if (line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      continue;
    }

    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentHunk = { header: line, lines: [] };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "add",
        content: line.slice(1),
        oldLineNo: null,
        newLineNo: newLine++,
      });
      currentFile.additions++;
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "remove",
        content: line.slice(1),
        oldLineNo: oldLine++,
        newLineNo: null,
      });
      currentFile.deletions++;
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "context",
        content: line.slice(1),
        oldLineNo: oldLine++,
        newLineNo: newLine++,
      });
    }
  }

  return files;
}
