import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it("stores title/message content and trims whitespace", () => {
    const notif = useNotificationStore.getState().addNotification({
      title: "  Agent completed  ",
      message: "  Updated 3 files successfully.  ",
      level: "success",
    });

    expect(notif.title).toBe("Agent completed");
    expect(notif.message).toBe("Updated 3 files successfully.");
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
  });

  it("falls back when title/message are empty", () => {
    const notif = useNotificationStore.getState().addNotification({
      title: "   ",
      message: "",
      level: "info",
    });

    expect(notif.title).toBe("Notification");
    expect(notif.message).toBe("No details available.");
  });
});
