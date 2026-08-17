use std::path::Path;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::process::Command;
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

// OS のターミナルをそのフォルダで開く。open_dir と同じく、フォルダ以外は必ず断る
// （渡されたパスをそのままコマンドへ流すため、ここで絞っておく）。
#[tauri::command]
pub fn open_terminal(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if !dir.is_dir() || is_package(dir) {
        return Err(format!("not a directory: {path}"));
    }
    spawn_terminal(dir).map_err(|e| e.to_string())
}

// macOS は Terminal.app を使う。「既定のターミナル」を知る仕組みが OS に無いため、
// 必ずある標準のものを開く。
#[cfg(target_os = "macos")]
fn spawn_terminal(dir: &Path) -> Result<(), String> {
    let status = Command::new("open")
        .arg("-a")
        .arg("Terminal")
        .arg(dir)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open -a Terminal failed: {status}"))
    }
}

// Windows は Windows Terminal（wt.exe）を優先し、無ければ PowerShell を直に開く。
// wt.exe は Win11 の既定だが、Win10 や無効化されている環境では見つからない。
// GUI プロセスから起動するコンソールアプリには、明示的に新しいコンソールを与える。
#[cfg(target_os = "windows")]
fn spawn_terminal(dir: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

    // wt.exe はウィンドウを出したらすぐ終わるので、待たずに投げっぱなしでよい。
    if Command::new("wt.exe").arg("-d").arg(dir).spawn().is_ok() {
        return Ok(());
    }
    Command::new("powershell.exe")
        .arg("-NoExit")
        .current_dir(dir)
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// 配布しているのは macOS と Windows だけ。ほかの OS ではビルドは通しつつ、
// 呼ばれたら断る。
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn spawn_terminal(_dir: &Path) -> Result<(), String> {
    Err("opening a terminal is not supported on this platform".into())
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
