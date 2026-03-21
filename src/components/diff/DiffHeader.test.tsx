import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffHeader } from "./DiffHeader";

describe("DiffHeader", () => {
  it("shows 'No workspace' when no workspace", () => {
    render(<DiffHeader hasWorkspace={false} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.getByText("No workspace")).toBeInTheDocument();
  });

  it("shows 'Changes' and file count when workspace exists", () => {
    render(<DiffHeader hasWorkspace={true} fileCount={3} onRefresh={vi.fn()} />);
    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows refresh button when workspace exists", () => {
    render(<DiffHeader hasWorkspace={true} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.getByTitle("Refresh diff")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh clicked", async () => {
    const onRefresh = vi.fn();
    render(<DiffHeader hasWorkspace={true} fileCount={0} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle("Refresh diff"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("hides refresh and badge when no workspace", () => {
    render(<DiffHeader hasWorkspace={false} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.queryByTitle("Refresh diff")).not.toBeInTheDocument();
  });
});
