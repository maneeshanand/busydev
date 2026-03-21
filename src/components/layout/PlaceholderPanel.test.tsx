import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaceholderPanel } from "./PlaceholderPanel";

describe("PlaceholderPanel", () => {
  it("renders the label", () => {
    render(<PlaceholderPanel label="Test Panel" />);
    expect(screen.getByText("Test Panel")).toBeInTheDocument();
  });
});
