import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNotificationStore } from "../stores";
import {
  ensureSystemNotificationPermission,
  NOTIFICATION_EVENT,
  showSystemNotification,
  type NotificationPayload,
} from "../lib/notifications";

export function useNotificationBridge() {
  useEffect(() => {
    void ensureSystemNotificationPermission();

    let disposed = false;

    const attach = async () => {
      const unlisten = await listen<NotificationPayload>(NOTIFICATION_EVENT, (event) => {
        const payload = event.payload;
        if (!payload?.title || !payload?.message) {
          return;
        }

        useNotificationStore.getState().addNotification({
          title: payload.title,
          message: payload.message,
          level: payload.level ?? "info",
        });

        showSystemNotification(payload);
      });

      if (disposed) {
        unlisten();
      }

      return unlisten;
    };

    let detach: (() => void) | null = null;
    void attach().then((unlisten) => {
      detach = unlisten ?? null;
    });

    return () => {
      disposed = true;
      if (detach) {
        detach();
      }
    };
  }, []);
}
