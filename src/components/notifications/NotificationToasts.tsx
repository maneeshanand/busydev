import { useEffect } from "react";
import { useNotificationStore, type AppNotification } from "../../stores";
import "./NotificationToasts.css";

const AUTO_DISMISS_MS = 5000;

function NotificationToast({ notification }: { notification: AppNotification }) {
  const dismiss = useNotificationStore((state) => state.dismissNotification);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismiss(notification.id);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [dismiss, notification.id]);

  return (
    <div
      className={`notification-toast notification-toast--${notification.level}`}
      role="status"
      aria-live="polite"
    >
      <div className="notification-toast__content">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button
        type="button"
        className="notification-toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => dismiss(notification.id)}
      >
        ×
      </button>
    </div>
  );
}

export function NotificationToasts() {
  const notifications = useNotificationStore((state) => state.notifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-stack" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
