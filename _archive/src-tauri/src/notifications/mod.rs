use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

pub const NOTIFICATION_EVENT: &str = "busydev://notification";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
    pub title: String,
    pub message: String,
    pub level: String,
}

#[tauri::command]
pub fn publish_notification(app: AppHandle, payload: NotificationPayload) -> Result<(), String> {
    emit_notification(&app, payload)
}

pub fn emit_notification(app: &AppHandle, payload: NotificationPayload) -> Result<(), String> {
    app.emit(NOTIFICATION_EVENT, payload)
        .map_err(|err| format!("failed to emit notification event: {err}"))
}
