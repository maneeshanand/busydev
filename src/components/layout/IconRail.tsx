import "./IconRail.css";

interface IconRailProps {
  activePanel: string | null;
  onTogglePanel: (panel: string) => void;
}

const ICONS = [
  { id: "search", label: "S" },
  { id: "settings", label: "\u2699" },
];

export function IconRail({ activePanel, onTogglePanel }: IconRailProps) {
  return (
    <nav className="icon-rail">
      {ICONS.map((icon) => (
        <button
          key={icon.id}
          className={`icon-rail__button ${
            activePanel === icon.id ? "icon-rail__button--active" : ""
          }`}
          onClick={() => onTogglePanel(icon.id)}
          title={icon.id}
        >
          {icon.label}
        </button>
      ))}
    </nav>
  );
}
