/** Material-style SVG icons for BusyAgents. Pass the agent's `icon` field as the `name` prop. */
export function AgentIcon({ name, size = 16 }: { name: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "crown": // Tech Lead
      return <svg {...props}><path d="M2 20h20L18 8l-4 6-2-8-2 8-4-6z" /><path d="M2 20h20" /></svg>;
    case "monitor": // Frontend
      return <svg {...props}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
    case "server": // Backend
      return <svg {...props}><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><path d="M6 6h.01M6 18h.01" /></svg>;
    case "git-branch": // DevOps
      return <svg {...props}><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M6 9v6a3 3 0 0 0 3 3h6" /></svg>;
    case "flask": // QA
      return <svg {...props}><path d="M9 3h6M10 9V3M14 9V3" /><path d="M5 21h14l-4-8H9z" /></svg>;
    case "shield": // Security
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
    case "search": // Code Review
      return <svg {...props}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>;
    case "file-text": // Documentation
      return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>;
    case "database": // Data Engineer
      return <svg {...props}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>;
    case "pen-tool": // UX Designer
      return <svg {...props}><path d="M12 19l7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>;
    default:
      // Fallback: generic bot icon
      return <svg {...props}><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="4" /><path d="M8 15h.01M16 15h.01" /></svg>;
  }
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
