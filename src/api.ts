import { invoke } from "@tauri-apps/api/core";
import type { Recording } from "./types";

export const api = {
  /** Rejects when the file is missing or isn't an audio or video file the app can open. */
  inspectRecording: (path: string) => invoke<Recording>("inspect_recording", { path }),
  reveal: (path: string) => invoke<void>("reveal", { path }),
  log: (level: "info" | "error", message: string) => invoke<void>("log_frontend", { level, message }).catch(() => {}),
  homeDir: () => invoke<string>("home_dir"),
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
};
