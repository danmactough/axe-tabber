// Dev-only stand-in for the Tauri backend so the UI can be previewed in a
// plain browser (`npm run dev`, then open http://localhost:1420). All data
// here is synthetic. Loaded from main.tsx only when not running inside Tauri.
import type { Recording } from "./types";

declare const __APP_VERSION__: string;
// One minor version ahead, so Settings › Check now can preview the update banner.
const NEXT_VERSION = __APP_VERSION__.replace(/^(\d+)\.(\d+)\.\d+.*/, (_, major, minor) => `${major}.${Number(minor) + 1}.0`);

const HOME = "/Users/demo";
const now = Date.now();
const H = 3_600_000;

// The Open dialog cycles through these.
const PICKS = [`${HOME}/Music/Takes/riff in drop D.wav`, `${HOME}/Movies/lesson - travis picking.mov`, `${HOME}/Music/solo take 3.m4a`];
let nextPick = 0;

const settings = new Map<string, string>();

const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  get_setting: ({ key }) => settings.get(key as string) ?? null,
  set_setting: ({ key, value }) => void settings.set(key as string, value as string),
  home_dir: () => HOME,
  inspect_recording: ({ path }): Recording => {
    const p = path as string;
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    if (p.includes("missing")) throw `No such file: ${p}`;
    const kind = ["mov", "mp4", "m4v", "mkv", "webm", "avi"].includes(ext) ? "video" : "audio";
    return { path: p, name: p.split("/").pop() ?? p, kind, size: 4_200_000 + p.length * 91_000, modified_at: now - (p.length % 9) * H };
  },
  reveal: ({ path }) => console.log("reveal", path),
  log_frontend: ({ level, message }) => console.log(`[${level}]`, message),
  "plugin:event|listen": ({ event, handler }) => {
    (listeners[event as string] ??= []).push(handler as number);
    return handler;
  },
  "plugin:event|unlisten": () => null,
  "plugin:dialog|open": () => PICKS[nextPick++ % PICKS.length],
  "plugin:window|set_theme": () => null,
  "plugin:app|version": () => __APP_VERSION__,
  // Settings > Check now always finds this release, so the update banner can be previewed.
  "plugin:updater|check": () => ({ rid: 1, currentVersion: __APP_VERSION__, version: NEXT_VERSION, date: null, body: "", rawJson: {} }),
  "plugin:updater|download": () => 2,
  "plugin:updater|install": () => console.log("install update"),
  "plugin:process|restart": () => console.log("restart"),
  "plugin:resources|close": () => null,
};

let cb = 0;
const callbacks: Record<number, (e: unknown) => void> = {};
const listeners: Record<string, number[]> = {};
Object.assign(window, {
  // Fires an app event from the console, e.g. __emit("open-settings", null), or
  // __emit("tauri://drag-drop", { paths: ["/Users/demo/a.wav"] }) to preview a drop.
  __emit: (event: string, payload: unknown) => listeners[event]?.forEach((id) => callbacks[id]?.({ event, id, payload })),
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback: (f: (e: unknown) => void) => {
      callbacks[++cb] = f;
      return cb;
    },
    invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
      const h = handlers[cmd];
      if (!h) throw new Error(`devBridge: no handler for ${cmd}`);
      return h(args);
    },
  },
  __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
});
