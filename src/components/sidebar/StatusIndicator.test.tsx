import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusIndicator } from "./StatusIndicator";

describe("StatusIndicator", () => {
  it("renders with title matching status", () => {
    render(<StatusIndicator status="Running" />);
    expect(screen.getByTitle("Running")).toBeInTheDocument();
  });

  it("applies pulse class for Running status", () => {
    render(<StatusIndicator status="Running" />);
    expect(screen.getByTitle("Running")).toHaveClass("status-indicator--pulse");
  });

  it("does not apply pulse class for non-Running status", () => {
    render(<StatusIndicator status="Idle" />);
    expect(screen.getByTitle("Idle")).not.toHaveClass("status-indicator--pulse");
  });

  it("handles unknown status gracefully", () => {
    render(<StatusIndicator status="Unknown" />);
    expect(screen.getByTitle("Unknown")).toBeInTheDocument();
    expect(screen.getByTitle("Unknown")).not.toHaveClass("status-indicator--pulse");
  });
});
