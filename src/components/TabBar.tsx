import "./TabBar.css";

export interface Tab {
  id: string;
  label: string;
  agent: string;
  running: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "tab-active" : ""} ${tab.running ? "tab-running" : ""}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-agent">{tab.agent === "claude" ? "CC" : "CX"}</span>
          <span className="tab-label">{tab.label}</span>
          {tab.running && <span className="tab-spinner" />}
          <button
            type="button"
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
