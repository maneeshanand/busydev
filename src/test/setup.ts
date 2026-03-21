import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @tauri-apps/api/core since tests run without Tauri runtime
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockRejectedValue(new Error("Tauri not available in test")),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock @xterm/xterm since jsdom doesn't support canvas
// Mock @tauri-apps/plugin-dialog for folder picker
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    dispose: vi.fn(),
    writeln: vi.fn(),
    cols: 80,
    rows: 24,
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));
