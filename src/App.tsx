import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { api } from "./api";
import type { Recording } from "./types";
import { SettingsSheet } from "./components/SettingsSheet";
import { ShortcutsSheet } from "./components/ShortcutsSheet";
import { UpdateBanner } from "./components/UpdateBanner";
import { applyTheme, storedTheme, type Theme } from "./lib/theme";
import { useUpdater } from "./lib/useUpdater";
import { chooseRecording } from "./lib/recordings";
import { formatBytes, relTime, setHome, tildify } from "./lib/format";

const MAX_RECENT = 20;

interface Prefs {
  theme: Theme;
  /** Ask GitHub for a newer release when the app opens and periodically after that. */
  autoCheckUpdates: boolean;
  /** Paths of recordings opened before, newest first. */
  recent: string[];
  /** The recording showing in the main pane. */
  selected: string | null;
}

const DEFAULT_PREFS: Prefs = {
  theme: storedTheme(),
  autoCheckUpdates: true,
  recent: [],
  selected: null,
};

/** What's known about a recent path: its details, or why it can't be opened now (moved, deleted). */
type Entry = { recording: Recording } | { error: string };

export default function App() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [entries, setEntries] = useState<Map<string, Entry>>(new Map());
  const [sheet, setSheet] = useState(false);
  const [help, setHelp] = useState(false);
  const [dragging, setDragging] = useState(false);
  const overlay = sheet || help;

  // A short-lived line over the bottom of the sidebar, like a browser's link preview.
  const [notice, setNotice] = useState<{ text: string; shown: boolean }>({ text: "", shown: false });
  const noticeTimer = useRef<number | undefined>(undefined);
  const showNotice = useCallback((text: string, ms: number) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, shown: true });
    noticeTimer.current = window.setTimeout(() => setNotice((n) => ({ ...n, shown: false })), ms);
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next: Prefs = { ...(prev ?? DEFAULT_PREFS), ...patch };
      void api.setSetting("prefs", JSON.stringify(next));
      return next;
    });
  }, []);

  const inspect = useCallback(async (path: string): Promise<Entry> => {
    const entry: Entry = await api
      .inspectRecording(path)
      .then((recording) => ({ recording }))
      .catch((e) => ({ error: String(e) }));
    setEntries((m) => new Map(m).set(path, entry));
    return entry;
  }, []);

  const openPath = useCallback(
    async (path: string) => {
      const entry = await inspect(path);
      if ("error" in entry) {
        showNotice(entry.error, 6000);
        return;
      }
      setPrefs((prev) => {
        const cur = prev ?? DEFAULT_PREFS;
        const next: Prefs = { ...cur, selected: path, recent: [path, ...cur.recent.filter((p) => p !== path)].slice(0, MAX_RECENT) };
        void api.setSetting("prefs", JSON.stringify(next));
        return next;
      });
    },
    [inspect, showNotice],
  );

  const choose = useCallback(async () => {
    const path = await chooseRecording().catch((e) => {
      api.log("error", `open dialog: ${e}`);
      return null;
    });
    if (path) await openPath(path);
  }, [openPath]);

  useEffect(() => {
    api.homeDir().then(setHome).catch(() => {});
    api
      .getSetting("prefs")
      .then((raw) => {
        const merged: Prefs = { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
        setPrefs(merged);
        for (const path of merged.recent) void inspect(path);
      })
      .catch(() => setPrefs(DEFAULT_PREFS));
  }, [inspect]);

  useEffect(() => {
    const un = [
      // Settings… in the app menu (⌘,).
      listen("open-settings", () => {
        setHelp(false);
        setSheet(true);
      }),
      // Open Recording… in the File menu (⌘O).
      listen("open-recording", () => void choose()),
      getCurrentWebview().onDragDropEvent((e) => {
        const { type } = e.payload;
        if (type === "enter" || type === "over") setDragging(true);
        else if (type === "leave") setDragging(false);
        else if (type === "drop") {
          setDragging(false);
          const [first] = e.payload.paths;
          if (first) void openPath(first);
        }
      }),
    ];
    return () => un.forEach((p) => p.then((f) => f()));
  }, [choose, openPath]);

  const p = prefs ?? DEFAULT_PREFS;
  const updater = useUpdater({ autoCheck: prefs !== null && p.autoCheckUpdates, onNotice: showNotice });
  const { checkNow } = updater;
  useEffect(() => {
    const un = listen("check-for-updates", () => void checkNow());
    return () => void un.then((f) => f());
  }, [checkNow]);

  useEffect(() => applyTheme(p.theme), [p.theme]);

  // Keyboard: j/k or arrows move through the recent list, ? lists the
  // shortcuts. Keep ShortcutsSheet in step with this.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Also in the app menu; these cover the browser preview.
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setHelp(false);
        setSheet(true);
        return;
      }
      // The open sheet handles its own keys; nothing behind it should react.
      if (overlay) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void choose();
        return;
      }
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
        return;
      }
      const dir = e.key === "j" || e.key === "ArrowDown" ? 1 : e.key === "k" || e.key === "ArrowUp" ? -1 : 0;
      if (!dir || !p.recent.length) return;
      e.preventDefault();
      const i = p.selected ? p.recent.indexOf(p.selected) : -1;
      update({ selected: p.recent[i < 0 ? 0 : (i + dir + p.recent.length) % p.recent.length] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, choose, p.recent, p.selected, update]);

  const selectedEntry = p.selected ? entries.get(p.selected) : undefined;

  return (
    <div className={`app ${dragging ? "dragging" : ""}`}>
      <nav className="nav" aria-label="Views" data-tauri-drag-region>
        <button className="nav-button on" aria-label="Recordings" aria-current="page" title="Recordings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>
        {/* Pushes Settings and shortcuts to the bottom. */}
        <span className="nav-gap" />
        <button className="nav-button" title="Settings (⌘,)" aria-label="Settings" onClick={() => setSheet(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button className="nav-button" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
      </nav>

      <aside className="rail">
        <div className="rail-top" data-tauri-drag-region>
          <span className="brand" data-tauri-drag-region>
            axe<span className="brand-dot">·</span>tabber
          </span>
        </div>
        <div className="rail-action">
          <button className="primary" onClick={() => void choose()}>
            Open recording…
          </button>
        </div>
        <div className="rail-head">Recent</div>
        <ul className="recent">
          {p.recent.map((path) => {
            const entry = entries.get(path);
            const missing = entry && "error" in entry;
            return (
              <li key={path}>
                <button
                  className={`recent-item ${p.selected === path ? "on" : ""} ${missing ? "missing" : ""}`}
                  onClick={() => update({ selected: path })}
                  title={tildify(path)}
                >
                  <span className="recent-name">{path.split("/").pop()}</span>
                  <span className="recent-meta">
                    {entry && "recording" in entry ? `${entry.recording.kind} · ${formatBytes(entry.recording.size)}` : missing ? "Not found" : "…"}
                  </span>
                </button>
              </li>
            );
          })}
          {p.recent.length === 0 && <li className="none">Recordings you open appear here.</li>}
        </ul>
        {!updater.bannerHidden && (
          <UpdateBanner
            status={updater.status}
            onInstall={() => void updater.install()}
            onRestart={() => void updater.restart()}
            onLater={updater.later}
          />
        )}
        <div className={`rail-status ${notice.shown ? "on" : ""}`} role="status" title={notice.text}>
          {notice.text}
        </div>
      </aside>

      <main className="detail">
        <div className="detail-top" data-tauri-drag-region />
        {selectedEntry && "recording" in selectedEntry ? (
          <RecordingView recording={selectedEntry.recording} />
        ) : selectedEntry && "error" in selectedEntry ? (
          <div className="empty">
            <p>{selectedEntry.error}</p>
            <button className="ghost" onClick={() => void choose()}>
              Open another recording…
            </button>
          </div>
        ) : (
          <div className="empty drop-target">
            <h2>Turn a recording into tablature</h2>
            <p>Open an audio or video recording of guitar, or drop one on this window.</p>
            <button className="primary" onClick={() => void choose()}>
              Open recording…
            </button>
            <p className="dim hint">⌘O to open · j / k to move · ? for shortcuts</p>
          </div>
        )}
      </main>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <span>Drop to open</span>
        </div>
      )}

      {help && <ShortcutsSheet onClose={() => setHelp(false)} />}
      {sheet && (
        <SettingsSheet
          onClose={() => setSheet(false)}
          theme={p.theme}
          onTheme={(theme) => update({ theme })}
          recentCount={p.recent.length}
          onClearRecent={() => update({ recent: [], selected: null })}
          autoCheckUpdates={p.autoCheckUpdates}
          onAutoCheckUpdates={(autoCheckUpdates) => update({ autoCheckUpdates })}
          checkingForUpdates={updater.checking}
          updateCheckResult={updater.checkResult}
          onCheckForUpdates={() => void updater.checkNow()}
        />
      )}
    </div>
  );
}

function RecordingView({ recording }: { recording: Recording }) {
  return (
    <div className="recording">
      <header className="recording-head">
        <h1>{recording.name}</h1>
        <div className="recording-meta">
          <span className="tag">{recording.kind}</span>
          <span>{formatBytes(recording.size)}</span>
          {recording.modified_at && <span>modified {relTime(recording.modified_at)}</span>}
          <button className="link" onClick={() => void api.reveal(recording.path)}>
            Show in Finder
          </button>
        </div>
        <div className="recording-path">{tildify(recording.path)}</div>
      </header>
      <section className="tab-placeholder">
        <pre aria-label="Empty tablature">
          {["e|", "B|", "G|", "D|", "A|", "E|"].map((s) => `${s}${"-".repeat(48)}|`).join("\n")}
        </pre>
        <p className="dim">Tablature for this recording appears here once transcription is built.</p>
      </section>
    </div>
  );
}
