import { useEffect } from "react";
import { CheckmarkFilled, Close, ErrorFilled, InformationFilled, WarningAltFilled } from "@carbon/icons-react";
import { useNotificationStore, type AppNotification } from "../stores/notificationStore";
import "./NotificationToasts.css";

const AUTO_DISMISS_MS = 5000;

function NotificationToast({
  notification,
  onNavigate,
}: {
  notification: AppNotification;
  onNavigate?: (projectId: string, sessionId: string) => void;
}) {
  const dismiss = useNotificationStore((state) => state.dismissNotification);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismiss(notification.id);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [dismiss, notification.id]);

  const canNavigate = !!(notification.projectId && notification.sessionId && onNavigate);
  const LevelIcon = notification.level === "success"
    ? CheckmarkFilled
    : notification.level === "warning"
      ? WarningAltFilled
      : notification.level === "error"
        ? ErrorFilled
        : InformationFilled;

  return (
    <div
      className={`notification-toast notification-toast--${notification.level} ${canNavigate ? "notification-toast--clickable" : ""}`}
      role="status"
      aria-live="polite"
      onClick={() => {
        if (canNavigate) {
          onNavigate(notification.projectId!, notification.sessionId!);
          dismiss(notification.id);
        }
      }}
    >
      <span className="notification-toast__icon" aria-hidden="true">
        <LevelIcon size={16} />
      </span>
      <div className="notification-toast__content">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button
        type="button"
        className="notification-toast__dismiss"
        aria-label="Dismiss notification"
        onClick={(e) => { e.stopPropagation(); dismiss(notification.id); }}
      >
        <Close size={16} />
      </button>
    </div>
  );
}

export function NotificationToasts({
  onNavigate,
}: {
  onNavigate?: (projectId: string, sessionId: string) => void;
}) {
  const notifications = useNotificationStore((state) => state.notifications);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast-stack" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationToast key={notification.id} notification={notification} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
