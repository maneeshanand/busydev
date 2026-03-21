import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnifiedDiff } from "./UnifiedDiff";
import type { DiffHunk } from "../../lib";

describe("UnifiedDiff", () => {
  const hunks: DiffHunk[] = [
    {
      header: "@@ -1,3 +1,4 @@",
      lines: [
        { type: "context", content: "line one", oldLineNo: 1, newLineNo: 1 },
        { type: "remove", content: "old line", oldLineNo: 2, newLineNo: null },
        { type: "add", content: "new line", oldLineNo: null, newLineNo: 2 },
        { type: "add", content: "added", oldLineNo: null, newLineNo: 3 },
      ],
    },
  ];

  it("renders hunk header", () => {
    render(<UnifiedDiff hunks={hunks} />);
    expect(screen.getByText("@@ -1,3 +1,4 @@")).toBeInTheDocument();
  });

  it("renders diff lines with correct prefixes", () => {
    const { container } = render(<UnifiedDiff hunks={hunks} />);
    const addLines = container.querySelectorAll(".unified-diff__line--add");
    const removeLines = container.querySelectorAll(".unified-diff__line--remove");
    const contextLines = container.querySelectorAll(".unified-diff__line--context");

    expect(addLines).toHaveLength(2);
    expect(removeLines).toHaveLength(1);
    expect(contextLines).toHaveLength(1);
  });

  it("renders line content", () => {
    render(<UnifiedDiff hunks={hunks} />);
    expect(screen.getByText("line one")).toBeInTheDocument();
    expect(screen.getByText("old line")).toBeInTheDocument();
    expect(screen.getByText("new line")).toBeInTheDocument();
  });

  it("renders line numbers in gutter", () => {
    const { container } = render(<UnifiedDiff hunks={hunks} />);
    const gutters = container.querySelectorAll(".unified-diff__gutter");
    // 4 lines * 2 gutters each = 8
    expect(gutters.length).toBe(8);
  });
});
