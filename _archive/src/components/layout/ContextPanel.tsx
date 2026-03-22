import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { DiffPanel } from "./DiffPanel";
import { TerminalPanel } from "./TerminalPanel";
import { ResizeHandle } from "./ResizeHandle";
import "./ContextPanel.css";

export function ContextPanel() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "busydev-context",
  });

  return (
    <div className="context-panel">
      <Group orientation="vertical" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
        <Panel id="diff" defaultSize="60%" minSize="20%">
          <DiffPanel />
        </Panel>
        <ResizeHandle orientation="vertical" />
        <Panel id="terminal" defaultSize="40%" minSize="20%">
          <TerminalPanel />
        </Panel>
      </Group>
    </div>
  );
}
