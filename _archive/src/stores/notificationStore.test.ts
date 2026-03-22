import { describe, expect, test } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("useNotificationStore", () => {
  test("adds and dismisses notifications", () => {
    const store = useNotificationStore.getState();
    store.clearNotifications();

    const item = store.addNotification({
      title: "Agent completed",
      message: "Finished task successfully",
      level: "success",
    });

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0].id).toBe(item.id);

    useNotificationStore.getState().dismissNotification(item.id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  test("clears all notifications", () => {
    const store = useNotificationStore.getState();
    store.clearNotifications();

    store.addNotification({ title: "One", message: "First" });
    store.addNotification({ title: "Two", message: "Second", level: "warning" });

    expect(useNotificationStore.getState().notifications).toHaveLength(2);

    store.clearNotifications();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
