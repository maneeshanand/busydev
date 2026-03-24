import { create } from "zustand";

export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
  timestampMs: number;
  projectId?: string;
  sessionId?: string;
}

interface AddNotificationInput {
  title: string;
  message: string;
  level?: NotificationLevel;
  projectId?: string;
  sessionId?: string;
}

type NotificationStoreState = {
  notifications: AppNotification[];
  addNotification: (input: AddNotificationInput) => AppNotification;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
};

function createNotificationId() {
  return `notif-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: [],
  addNotification: ({ title, message, level = "info", projectId, sessionId }) => {
    const notification: AppNotification = {
      id: createNotificationId(),
      title,
      message,
      level,
      timestampMs: Date.now(),
      projectId,
      sessionId,
    };

    set((state) => ({
      notifications: [...state.notifications, notification],
    }));

    return notification;
  },
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
