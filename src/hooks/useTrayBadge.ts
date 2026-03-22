import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useTrayBadge() {
  useEffect(() => {
    invoke("update_tray_badge", { count: 0 }).catch(() => {
      // Tray not available (e.g., Vite-only dev)
    });
  }, []);
}
