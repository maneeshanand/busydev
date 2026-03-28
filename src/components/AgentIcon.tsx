import {
  BareMetalServer,
  Bot,
  Branch,
  Chemistry,
  DataBase,
  Document,
  Edit,
  Laptop,
  Search,
  Security,
  UserRole,
} from "@carbon/icons-react";

const ICON_MAP: Record<string, any> = {
  crown: UserRole,
  monitor: Laptop,
  server: BareMetalServer,
  "git-branch": Branch,
  flask: Chemistry,
  shield: Security,
  search: Search,
  "file-text": Document,
  database: DataBase,
  "pen-tool": Edit,
};

/** Carbon icon renderer for BusyAgents. Pass the agent's `icon` field as the `name` prop. */
export function AgentIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = (ICON_MAP[name] ?? Bot) as any;
  return <Icon size={size} />;
}

/** Short text label for use in <select> <option> elements (which can't render SVG) */
export function agentIconLabel(name: string): string {
  const map: Record<string, string> = {
    "crown": "◆",
    "monitor": "▣",
    "server": "▥",
    "git-branch": "⑂",
    "flask": "△",
    "shield": "◇",
    "search": "◎",
    "file-text": "▤",
    "database": "⬡",
    "pen-tool": "◈",
  };
  return map[name] ?? "●";
}
