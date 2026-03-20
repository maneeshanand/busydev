import "./PlaceholderPanel.css";

interface PlaceholderPanelProps {
  label: string;
}

export function PlaceholderPanel({ label }: PlaceholderPanelProps) {
  return (
    <div className="placeholder-panel">
      <span className="placeholder-panel__label">{label}</span>
    </div>
  );
}
