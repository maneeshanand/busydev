import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiffHeader } from "./DiffHeader";

describe("DiffHeader", () => {
  it("shows 'No path' when no target path", () => {
    render(<DiffHeader hasTarget={false} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.getByText("No path")).toBeInTheDocument();
  });

  it("shows 'Changes' and file count when path exists", () => {
    render(<DiffHeader hasTarget={true} fileCount={3} onRefresh={vi.fn()} />);
    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows refresh button when path exists", () => {
    render(<DiffHeader hasTarget={true} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.getByTitle("Refresh diff")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh clicked", async () => {
    const onRefresh = vi.fn();
    render(<DiffHeader hasTarget={true} fileCount={0} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByTitle("Refresh diff"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("hides refresh and badge when no path", () => {
    render(<DiffHeader hasTarget={false} fileCount={0} onRefresh={vi.fn()} />);
    expect(screen.queryByTitle("Refresh diff")).not.toBeInTheDocument();
  });
});
