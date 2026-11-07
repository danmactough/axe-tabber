use axe_tabber_core::settings;

#[test]
fn a_saved_setting_reads_back_and_a_new_value_replaces_it() {
    let dir = std::env::temp_dir().join(format!("axe-tabber-settings-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let conn = settings::open(&dir.join("settings.sqlite")).unwrap();

    assert_eq!(settings::get(&conn, "ui.prefs").unwrap(), None);
    settings::set(&conn, "ui.prefs", "{}").unwrap();
    settings::set(&conn, "ui.prefs", r#"{"theme":"dark"}"#).unwrap();
    assert_eq!(settings::get(&conn, "ui.prefs").unwrap().as_deref(), Some(r#"{"theme":"dark"}"#));

    std::fs::remove_dir_all(&dir).unwrap();
}
