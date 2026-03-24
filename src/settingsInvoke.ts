import { invoke } from "@tauri-apps/api/core";
import type { StoredSettings } from "./lib/settings";

export function getSettings(scope = "global"): Promise<StoredSettings | null> {
  return invoke<StoredSettings | null>("get_settings", { scope });
}

export function saveSettings(settings: StoredSettings, scope = "global"): Promise<StoredSettings> {
  return invoke<StoredSettings>("save_settings", { settings, scope });
}

export function resetSettings(scope = "global", section?: string): Promise<StoredSettings | null> {
  return invoke<StoredSettings | null>("reset_settings", { scope, section: section ?? null });
}

export function exportSettings(): Promise<string> {
  return invoke<string>("export_settings");
}

export function importSettings(json: string): Promise<StoredSettings> {
  return invoke<StoredSettings>("import_settings", { json });
}

