mod commands;

use tauri::webview::PageLoadEvent;

// ウィンドウは非表示で作られ、描画を終えたフロント側が show() する
// （起動時の白いちらつき対策。src/app-window.ts）。フロントが動かなかった場合に
// 備えた保険として、一定時間で必ず表示する。表示済みなら show() は何もしない。
const REVEAL_FALLBACK_SECS: u64 = 3;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::allow_dir,
            commands::open_dir,
            commands::open_terminal
        ])
        // メインもメモ用の別ウィンドウ（note-*）も同じ作りなので、ページを読み込んだ
        // ウィンドウすべてに掛ける。読み込みの完了ではなく開始で掛けるのは、フロントが
        // 途中で止まったときにも効かせるため。
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Started {
                return;
            }
            let window = webview.window();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(REVEAL_FALLBACK_SECS));
                let _ = window.show();
            });
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
