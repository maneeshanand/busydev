import { useEffect, useRef } from "react";
import { ProjectTree } from "../sidebar";
import { SettingsPanel } from "../settings";
import "./SidebarFlyout.css";

interface SidebarFlyoutProps {
  activePanel: string | null;
  onClose: () => void;
}

export function SidebarFlyout({ activePanel, onClose }: SidebarFlyoutProps) {
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activePanel) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(target) &&
        !target.closest(".icon-rail")
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activePanel, onClose]);

  if (!activePanel) return null;

  return (
    <div className="sidebar-flyout" ref={flyoutRef}>
      <div className="sidebar-flyout__header">
        <span className="sidebar-flyout__title">{activePanel}</span>
        <button className="sidebar-flyout__close" onClick={onClose}>
          {"\u2715"}
        </button>
      </div>
      <div className="sidebar-flyout__content">
        {activePanel === "projects" ? (
          <ProjectTree />
        ) : activePanel === "settings" ? (
          <SettingsPanel />
        ) : (
          <p className="sidebar-flyout__placeholder">{activePanel} panel content</p>
        )}
      </div>
    </div>
  );
}
