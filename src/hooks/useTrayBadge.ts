import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores";

const ATTENTION_STATUSES = new Set(["NeedsInput", "Error"]);

export function useTrayBadge() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  useEffect(() => {
    const count = workspaces.filter((w) => ATTENTION_STATUSES.has(w.status)).length;
    invoke("update_tray_badge", { count }).catch(() => {
      // Tray not available (e.g., Vite-only dev)
    });
  }, [workspaces]);
}
