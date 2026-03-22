use tauri::AppHandle;

use crate::tray::update_tray_title;

#[tauri::command]
pub fn update_tray_badge(count: u32, app: AppHandle) -> Result<(), String> {
    update_tray_title(&app, count)
}
