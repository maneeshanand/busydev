import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

interface TerminalProps {
  sessionId: string | null;
  onSessionCreated: (id: string) => void;
  cwd: string;
  visible?: boolean;
}

interface TerminalOutput {
  sessionId: string;
  data: string;
}

export function TerminalPanel({ sessionId, onSessionCreated, cwd, visible }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);

  sessionIdRef.current = sessionId;

  // Initialize xterm + create session on mount
  useEffect(() => {
    if (!containerRef.current || !cwd) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.3,
      theme: {
        background: "#1b1b1f",
        foreground: "#ebebf5",
        cursor: "#a8b1ff",
        selectionBackground: "rgba(168, 177, 255, 0.3)",
        black: "#1b1b1f",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#ebebf5",
        brightBlack: "#2b2f3a",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#a5b4fc",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Listen for PTY output
    let unlisten: UnlistenFn | undefined;
    void listen<TerminalOutput>("terminal://output", (event) => {
      if (event.payload.sessionId === sessionIdRef.current) {
        term.write(event.payload.data);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    // Send user input to PTY
    const onDataDisposable = term.onData((data) => {
      if (sessionIdRef.current) {
        void invoke("write_terminal", { sessionId: sessionIdRef.current, data });
      }
    });

    // Create PTY session
    void invoke<{ sessionId: string }>("create_terminal_session", { cwd }).then(
      (result) => {
        sessionIdRef.current = result.sessionId;
        onSessionCreated(result.sessionId);
      }
    );

    // Resize on container changes
    const observer = new ResizeObserver(() => {
      fit.fit();
      if (sessionIdRef.current) {
        void invoke("resize_terminal", {
          sessionId: sessionIdRef.current,
          cols: term.cols,
          rows: term.rows,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      onDataDisposable.dispose();
      if (unlisten) void unlisten();
      if (sessionIdRef.current) {
        void invoke("close_terminal_session", { sessionId: sessionIdRef.current });
      }
      term.dispose();
    };
  }, [cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refit when panel becomes visible again
  useEffect(() => {
    if (visible && fitRef.current) {
      requestAnimationFrame(() => fitRef.current?.fit());
    }
  }, [visible]);

  return <div className="terminal-container" ref={containerRef} />;
}
