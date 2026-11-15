mod commands;
mod open_files;

use open_files::OpenFiles;
use tauri::webview::PageLoadEvent;

// ウィンドウは非表示で作られ、描画を終えたフロント側が show() する
// （起動時の白いちらつき対策。src/app-window.ts）。フロントが動かなかった場合に
// 備えた保険として、一定時間で必ず表示する。表示済みなら show() は何もしない。
const REVEAL_FALLBACK_SECS: u64 = 3;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // 起動中に「このアプリで開く」をされたとき、2 つ目のプロセスを立てずに
    // 引数のファイルをこちらで開く（Windows。macOS は RunEvent::Opened で届く）。
    // 他のプラグインより先に登録する必要がある。
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        // 相対パスで渡されることもあるので、2 つ目のプロセスの作業フォルダで解決する。
        let cwd = std::path::Path::new(&cwd);
        let paths = argv.into_iter().skip(1).map(|a| cwd.join(a));
        open_files::deliver(app, open_files::md_paths(paths));
    }));

    let builder = builder
        .manage(OpenFiles::default())
        .invoke_handler(tauri::generate_handler![
            commands::allow_dir,
            commands::open_dir,
            commands::open_terminal,
            open_files::take_launch_files
        ])
        // 起動時のコマンドライン引数で渡されたファイル（Windows の「このアプリで開く」）。
        .setup(|app| {
            let paths = open_files::md_paths_from_args(std::env::args_os());
            open_files::deliver(app.handle(), paths);
            Ok(())
        })
        // メインも別ウィンドウ（note-* / ws-*）も同じ作りなので、ページを読み込んだ
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS の「このアプリで開く」は起動時も起動中もこのイベントで届く。
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths = urls.into_iter().filter_map(|u| u.to_file_path().ok());
                open_files::deliver(_app, open_files::md_paths(paths));
            }
        });
}
