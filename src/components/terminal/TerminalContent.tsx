import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./TerminalContent.css";

interface TerminalContentProps {
  activeSessionId: string | null;
  hasWorkspace: boolean;
  onResize: (id: string, cols: number, rows: number) => void;
}

const XTERM_THEME = {
  background: "#0d1117",
  foreground: "#cccccc",
  cursor: "#3b82f6",
  selectionBackground: "#264f78",
};

const XTERM_OPTIONS = {
  fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
  fontSize: 13,
  theme: XTERM_THEME,
  cursorBlink: true,
};

export function TerminalContent({ activeSessionId, hasWorkspace, onResize }: TerminalContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  const doFit = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon || !terminal || !activeSessionId) return;
    try {
      fitAddon.fit();
      onResize(activeSessionId, terminal.cols, terminal.rows);
    } catch {
      // fit can fail if container has zero dimensions
    }
  }, [activeSessionId, onResize]);

  useEffect(() => {
    if (!activeSessionId || !containerRef.current) {
      // Dispose terminal if no session
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
        fitAddonRef.current = null;
        currentSessionRef.current = null;
      }
      return;
    }

    // If same session, do nothing
    if (currentSessionRef.current === activeSessionId && terminalRef.current) {
      return;
    }

    // Dispose old terminal
    if (terminalRef.current) {
      terminalRef.current.dispose();
    }

    // Create new terminal
    const terminal = new Terminal(XTERM_OPTIONS);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    currentSessionRef.current = activeSessionId;

    terminal.open(containerRef.current);

    // Initial fit after a frame
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        onResize(activeSessionId, terminal.cols, terminal.rows);
      } catch {
        // ignore
      }
    });

    terminal.writeln("\x1b[90mTerminal session connected.\x1b[0m");
    terminal.writeln("\x1b[90mPTY I/O streaming not yet available.\x1b[0m");

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      currentSessionRef.current = null;
    };
  }, [activeSessionId, onResize]);

  // ResizeObserver for panel resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      doFit();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [doFit]);

  if (!hasWorkspace) {
    return (
      <div className="terminal-content terminal-content--empty">
        <p className="terminal-content__message">Set a local path</p>
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="terminal-content terminal-content--empty">
        <p className="terminal-content__message">Click + to create a terminal session</p>
      </div>
    );
  }

  return <div className="terminal-content terminal-content--xterm" ref={containerRef} />;
}
