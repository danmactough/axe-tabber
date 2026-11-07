// Settings storage and recording handling live in axe-tabber-core, which has no Tauri
// dependency and holds the integration tests.
pub use axe_tabber_core::{media, settings};

use std::path::PathBuf;

use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    db_path: PathBuf,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Settings written by the frontend are namespaced so backend settings can share the table.
fn ui_key(key: &str) -> String {
    format!("ui.{key}")
}

#[tauri::command]
fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = settings::open(&state.db_path).map_err(err)?;
    settings::get(&conn, &ui_key(&key)).map_err(err)
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = settings::open(&state.db_path).map_err(err)?;
    settings::set(&conn, &ui_key(&key), &value).map_err(err)
}

/// The file's name, kind and size, or an error if it isn't a recording the app can open.
#[tauri::command]
fn inspect_recording(path: String) -> Result<media::Recording, String> {
    media::inspect(std::path::Path::new(&path)).map_err(err)
}

#[tauri::command]
fn reveal(path: String) -> Result<(), String> {
    std::process::Command::new("open").arg("-R").arg(&path).spawn().map_err(err)?;
    Ok(())
}

/// Lets the webview report errors to the terminal running the app.
#[tauri::command]
fn log_frontend(level: String, message: String) {
    eprintln!("[webview:{level}] {message}");
}

#[tauri::command]
fn home_dir() -> String {
    dirs::home_dir().map(|h| h.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Whether a navigation leaves the app's own pages. Those go to the default
/// browser instead of replacing the app in its window.
fn is_external(url: &tauri::Url) -> bool {
    let own = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "tauri.localhost"));
    matches!(url.scheme(), "http" | "https" | "mailto") && !own
}

fn external_links<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("external-links")
        .on_navigation(|_, url| {
            let external = is_external(url);
            if external {
                let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
            }
            !external
        })
        .build()
}

/// The standard menu with "Settings…" (⌘,) and "Check for Updates…" added to
/// the app menu, after "About", where macOS apps put them, and "Open
/// Recording…" (⌘O) at the top of the File menu.
fn install_menu(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    let menu = Menu::default(app)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
    let check_updates = MenuItem::with_id(app, "check-for-updates", "Check for Updates…", true, None::<&str>)?;
    let items = menu.items()?;
    if let Some(app_menu) = items.first().and_then(|m| m.as_submenu()) {
        app_menu.insert_items(&[&check_updates, &settings, &PredefinedMenuItem::separator(app)?], 2)?;
    }
    if let Some(file_menu) = items.iter().filter_map(|m| m.as_submenu()).find(|m| m.text().is_ok_and(|t| t == "File")) {
        let open = MenuItem::with_id(app, "open-recording", "Open Recording…", true, Some("CmdOrCtrl+O"))?;
        file_menu.insert_items(&[&open, &PredefinedMenuItem::separator(app)?], 0)?;
    }
    app.set_menu(menu)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(external_links())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("settings.sqlite");
            drop(settings::open(&db_path)?);
            app.manage(AppState { db_path });
            install_menu(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "settings" => {
                let _ = app.emit("open-settings", ());
            }
            "check-for-updates" => {
                let _ = app.emit("check-for-updates", ());
            }
            "open-recording" => {
                let _ = app.emit("open-recording", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_setting,
            set_setting,
            inspect_recording,
            reveal,
            log_frontend,
            home_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> tauri::Url {
        s.parse().unwrap()
    }

    #[test]
    fn web_links_leave_the_app_and_its_own_pages_stay() {
        assert!(is_external(&url("https://example.com/tab")));
        assert!(is_external(&url("mailto:someone@example.com")));
        assert!(!is_external(&url("http://localhost:1420/")));
        assert!(!is_external(&url("http://tauri.localhost/index.html")));
        assert!(!is_external(&url("tauri://localhost/")));
    }
}
