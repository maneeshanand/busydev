import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IconRail } from "./IconRail";

describe("IconRail", () => {
  it("renders two icon buttons", () => {
    render(<IconRail activePanel={null} onTogglePanel={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("applies active class to selected panel", () => {
    const { container } = render(<IconRail activePanel="search" onTogglePanel={vi.fn()} />);
    expect(container.querySelector(".icon-rail__button--active")).toBeInTheDocument();
  });

  it("calls onTogglePanel with panel id on click", async () => {
    const onToggle = vi.fn();
    render(<IconRail activePanel={null} onTogglePanel={onToggle} />);
    await userEvent.click(screen.getByTitle("search"));
    expect(onToggle).toHaveBeenCalledWith("search");
  });

  it("renders settings button", () => {
    render(<IconRail activePanel={null} onTogglePanel={vi.fn()} />);
    expect(screen.getByTitle("settings")).toBeInTheDocument();
  });
});
