use std::sync::Mutex;

use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

pub struct TrayState {
    attention_count: Mutex<u32>,
}

impl TrayState {
    pub fn new() -> Self {
        Self {
            attention_count: Mutex::new(0),
        }
    }
}

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let show_item = MenuItemBuilder::with_id("show", "Show busydev")
        .build(app)
        .map_err(|e| format!("failed to build show menu item: {e}"))?;

    let quit_item = MenuItemBuilder::with_id("quit", "Quit")
        .build(app)
        .map_err(|e| format!("failed to build quit menu item: {e}"))?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&quit_item)
        .build()
        .map_err(|e| format!("failed to build tray menu: {e}"))?;

    let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))
        .map_err(|e| format!("failed to load tray icon: {e}"))?;

    TrayIconBuilder::with_id("busydev-tray")
        .icon(icon)
        .tooltip("busydev")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)
        .map_err(|e| format!("failed to build tray icon: {e}"))?;

    Ok(())
}

pub fn update_tray_title(app: &AppHandle, count: u32) -> Result<(), String> {
    let tray = app
        .tray_by_id("busydev-tray")
        .ok_or_else(|| "tray icon not found".to_string())?;

    let tooltip = if count > 0 {
        format!("busydev ({count})")
    } else {
        "busydev".to_string()
    };

    tray.set_tooltip(Some(&tooltip))
        .map_err(|e| format!("failed to set tray tooltip: {e}"))?;

    // Don't set title — it shows text next to the icon in the macOS menu bar
    tray.set_title(Some(""))
        .map_err(|e| format!("failed to set tray title: {e}"))?;

    if let Ok(mut attention) = app.state::<TrayState>().attention_count.lock() {
        *attention = count;
    }

    Ok(())
}

#[tauri::command]
pub fn update_tray_badge(app: AppHandle, count: u32) -> Result<(), String> {
    update_tray_title(&app, count)
}
