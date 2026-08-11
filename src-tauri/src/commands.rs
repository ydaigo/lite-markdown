use std::path::Path;
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;
use tauri_plugin_opener::OpenerExt;

// ============================================================================
// アプリ側のコマンド（プラグインでは足りない分だけ）
// ============================================================================
// どちらも「ホームの外のフォルダを扱う」ためにある。capabilities/default.json の
// スコープはホーム配下しか許しておらず、これは静的にしか書けないため、ユーザーが
// 選んだフォルダをその都度どうにかする必要がある。

// フォルダを読み書きできるようにする。ユーザーが選んだフォルダだけを実行時スコープへ
// 足す（全体を開けっ放しにはしない）。スコープは保存されないので、フロント側は
// フォルダを使う前に毎回呼ぶ（src/native.ts）。
#[tauri::command]
pub fn allow_dir(app: AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    // プレビューの画像は asset プロトコル経由で読むので、そちらのスコープにも足す。
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// OS のファイルマネージャでフォルダの中身を開く。opener のスコープは実行時に足せない
// ので、スコープ判定を通らない Rust 側から開く。その分、中身を見せるフォルダ以外は
// 必ず断る。open_path はファイルを渡されると既定のプログラムで開いてしまい、
// 実行ファイルなら起動させられるため。
#[tauri::command]
pub fn open_dir(app: AppHandle, path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if !dir.is_dir() || is_package(dir) {
        return Err(format!("not a directory: {path}"));
    }
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

// macOS の .app などのパッケージは中身のあるフォルダだが、open するとアプリとして
// 起動してしまう。フォルダとしては扱わない。拡張子だけでは .bundle や .framework を
// 取りこぼすので、パッケージの目印である Contents/Info.plist も見る。
#[cfg(target_os = "macos")]
fn is_package(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
        || path.join("Contents/Info.plist").is_file()
}

#[cfg(not(target_os = "macos"))]
fn is_package(_path: &Path) -> bool {
    false
}
