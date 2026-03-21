import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffFileItem } from "./DiffFileItem";
import type { DiffFile } from "../../lib";

const file: DiffFile = {
  path: "src/main.ts",
  additions: 5,
  deletions: 2,
  hunks: [
    {
      header: "@@ -1,3 +1,6 @@",
      lines: [
        { type: "context", content: "keep", oldLineNo: 1, newLineNo: 1 },
        { type: "remove", content: "old", oldLineNo: 2, newLineNo: null },
        { type: "add", content: "new", oldLineNo: null, newLineNo: 2 },
      ],
    },
  ],
};

describe("DiffFileItem", () => {
  it("renders file path", () => {
    render(<DiffFileItem file={file} onAccept={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
  });

  it("renders addition and deletion counts", () => {
    render(<DiffFileItem file={file} onAccept={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("expands to show diff on click", async () => {
    render(<DiffFileItem file={file} onAccept={vi.fn()} onRevert={vi.fn()} />);
    await userEvent.click(screen.getByText("src/main.ts"));
    expect(screen.getByText("@@ -1,3 +1,6 @@")).toBeInTheDocument();
  });

  it("calls onAccept with file path", async () => {
    const onAccept = vi.fn();
    render(<DiffFileItem file={file} onAccept={onAccept} onRevert={vi.fn()} />);
    await userEvent.click(screen.getByTitle("Accept changes (git add)"));
    expect(onAccept).toHaveBeenCalledWith("src/main.ts");
  });

  it("calls onRevert with file path", async () => {
    const onRevert = vi.fn();
    render(<DiffFileItem file={file} onAccept={vi.fn()} onRevert={onRevert} />);
    await userEvent.click(screen.getByTitle("Revert changes"));
    expect(onRevert).toHaveBeenCalledWith("src/main.ts");
  });
});
