import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { Theme } from "../lib/theme";

const THEMES: { key: Theme; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

interface Props {
  onClose: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  recentCount: number;
  onClearRecent: () => void;
  autoCheckUpdates: boolean;
  onAutoCheckUpdates: (on: boolean) => void;
  checkingForUpdates: boolean;
  updateCheckResult: string | null;
  onCheckForUpdates: () => void;
}

export function SettingsSheet({
  onClose,
  theme,
  onTheme,
  recentCount,
  onClearRecent,
  autoCheckUpdates,
  onAutoCheckUpdates,
  checkingForUpdates,
  updateCheckResult,
  onCheckForUpdates,
}: Props) {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet settings" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="ghost" onClick={onClose}>
            Done
          </button>
        </div>
        <h3 className="settings-head">Appearance</h3>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button key={t.key} role="radio" aria-checked={theme === t.key} className={theme === t.key ? "on" : ""} onClick={() => onTheme(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <h3 className="settings-head">Recent recordings</h3>
        <p className="sheet-note">The sidebar lists the recordings you opened most recently. Clearing the list leaves the files where they are.</p>
        <div className="sheet-foot">
          <button className="ghost" disabled={recentCount === 0} onClick={onClearRecent}>
            Clear list
          </button>
          <span className="sheet-stats">
            {recentCount} {recentCount === 1 ? "recording" : "recordings"}
          </span>
        </div>

        <h3 className="settings-head">Updates</h3>
        <label className="setting-toggle">
          <input type="checkbox" checked={autoCheckUpdates} onChange={(e) => onAutoCheckUpdates(e.target.checked)} />
          <span>
            Check for updates automatically
            <span className="setting-note">
              Asks GitHub for the latest version when the app opens and every 6 hours. Your recordings aren&rsquo;t sent,
              and nothing installs until you choose to.
            </span>
          </span>
        </label>
        <div className="sheet-foot">
          <button className="ghost" disabled={checkingForUpdates} onClick={onCheckForUpdates}>
            {checkingForUpdates ? "Checking…" : "Check now"}
          </button>
          {appVersion && <span className="sheet-stats">Version {appVersion}</span>}
        </div>
        {updateCheckResult && <p className="sheet-note">{updateCheckResult}</p>}
      </div>
    </div>
  );
}
