import { useCallback, useState } from "react";
import { Group, Panel, useDefaultLayout } from "react-resizable-panels";
import { IconRail } from "./IconRail";
import { SidebarFlyout } from "./SidebarFlyout";
import { ChatPanel } from "./ChatPanel";
import { ContextPanel } from "./ContextPanel";
import { ResizeHandle } from "./ResizeHandle";
import { StatusBar } from "./StatusBar";
import "./AppLayout.css";

export function AppLayout() {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "busydev-main",
  });

  const handleTogglePanel = useCallback((panel: string) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleCloseFlyout = useCallback(() => {
    setActivePanel(null);
  }, []);

  return (
    <div className="app-layout">
      <div className="app-layout__main">
        <IconRail activePanel={activePanel} onTogglePanel={handleTogglePanel} />
        <div className="app-layout__panels">
          <SidebarFlyout activePanel={activePanel} onClose={handleCloseFlyout} />
          <Group
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
          >
            <Panel id="chat" defaultSize="55%" minSize="20%" collapsible collapsedSize="0%">
              <ChatPanel />
            </Panel>
            <ResizeHandle orientation="horizontal" />
            <Panel id="context" defaultSize="45%" minSize="20%" collapsible collapsedSize="0%">
              <ContextPanel />
            </Panel>
          </Group>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
