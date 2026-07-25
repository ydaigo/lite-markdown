use tauri::Manager;

// ウィンドウは非表示で作られ、描画を終えたフロント側が show() する
// （起動時の白いちらつき対策）。フロントが動かなかった場合に備えた保険として、
// 一定時間で必ず表示する。表示済みなら show() は何もしない。
const REVEAL_FALLBACK_SECS: u64 = 3;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(REVEAL_FALLBACK_SECS));
                    let _ = win.show();
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // updater はデスクトップ専用プラグイン。--features updater を付けたリリースビルドのみ有効。
    #[cfg(all(desktop, feature = "updater"))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
