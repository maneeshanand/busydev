import { invoke } from "@tauri-apps/api/core";
import type { NotificationLevel } from "../stores";

export const NOTIFICATION_EVENT = "busydev://notification";

export interface NotificationPayload {
  title: string;
  message: string;
  level?: NotificationLevel;
}

export async function publishNotification(payload: NotificationPayload): Promise<boolean> {
  const normalizedPayload = {
    ...payload,
    level: payload.level ?? "info",
  };

  try {
    await invoke("publish_notification", { payload: normalizedPayload });
    return true;
  } catch {
    return false;
  }
}

export async function ensureSystemNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied" as const;
  }

  if (window.Notification.permission === "granted") {
    return "granted" as const;
  }

  if (window.Notification.permission === "denied") {
    return "denied" as const;
  }

  try {
    return await window.Notification.requestPermission();
  } catch {
    return "denied" as const;
  }
}

export function showSystemNotification(payload: NotificationPayload): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (window.Notification.permission !== "granted") {
    return false;
  }

  try {
    new window.Notification(payload.title, { body: payload.message });
    return true;
  } catch {
    return false;
  }
}
