use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

// ============================================================================
// OS から「このアプリで開く」で渡された .md ファイル
// ============================================================================
// 届き方は OS ごとに違う。
// - macOS: RunEvent::Opened（起動時も起動中も同じイベント。lib.rs）
// - Windows: 起動時はコマンドライン引数、起動中は 2 つ目のプロセスの引数を
//   single-instance プラグインが受け取る（lib.rs）
// どれもここの deliver() に集める。
//
// 起動時に届いたものはフロントの準備ができるまで溜めておき、メインウィンドウが
// take_launch_files で取りに来る（メインウィンドウで開く）。取りに来た後に届いた
// ものは "open-files" イベントで送る（フロントは別ウィンドウで開く。src/open-files.ts）。

pub const OPEN_FILES_EVENT: &str = "open-files";

#[derive(Default)]
struct Inner {
    // フロントが take_launch_files を呼んだ後か。以後は溜めずにイベントで送る。
    ready: bool,
    pending: Vec<String>,
}

#[derive(Default)]
pub struct OpenFiles(Mutex<Inner>);

// 渡されたパスのうち、実在する .md ファイルだけを残す。OS が付ける余計な引数
// （macOS の -psn_… など）やフォルダもここで落ちる。
pub fn md_paths<I, P>(paths: I) -> Vec<String>
where
    I: IntoIterator<Item = P>,
    P: Into<PathBuf>,
{
    paths
        .into_iter()
        .map(Into::into)
        .filter(|p| is_markdown_file(p))
        .filter_map(|p| p.to_str().map(str::to_owned))
        .collect()
}

fn is_markdown_file(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
        && path.is_file()
}

// コマンドライン引数（先頭の実行ファイル自身を除く）から .md を拾う。
pub fn md_paths_from_args(args: impl IntoIterator<Item = OsString>) -> Vec<String> {
    md_paths(args.into_iter().skip(1))
}

pub fn deliver(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let state = app.state::<OpenFiles>();
    // イベントの送信までロックの中で行う。take_launch_files と入れ違っても、
    // 溜める側と送る側のどちらか一方に必ず入る。
    let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if !inner.ready {
        inner.pending.extend(paths);
        return;
    }
    // 受け取るのは 1 つのウィンドウだけにする（全ウィンドウで開くと同じファイルが
    // 何度も開かれる）。メインが閉じられていれば、残っているどれかに任せる。
    let windows = app.webview_windows();
    let target = windows
        .get("main")
        .or_else(|| windows.values().next())
        .map(|w| w.label().to_owned());
    match target {
        Some(label) => {
            let _ = app.emit_to(label.as_str(), OPEN_FILES_EVENT, paths);
        }
        // ウィンドウが 1 つも無ければ受け取り手がいない。捨てずに溜めておく。
        None => inner.pending.extend(paths),
    }
}

// メインウィンドウが起動時に 1 回呼ぶ。それまでに届いたファイルを返し、
// 以後はイベントで送るよう切り替える。
#[tauri::command]
pub fn take_launch_files(state: State<'_, OpenFiles>) -> Vec<String> {
    let mut inner = state.0.lock().unwrap_or_else(|e| e.into_inner());
    inner.ready = true;
    std::mem::take(&mut inner.pending)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "lite-markdown-test-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn keeps_only_existing_markdown_files() {
        let dir = temp_dir("md-paths");
        let md = dir.join("note.md");
        let upper = dir.join("README.MD");
        let txt = dir.join("note.txt");
        let folder = dir.join("folder.md");
        fs::write(&md, "").unwrap();
        fs::write(&upper, "").unwrap();
        fs::write(&txt, "").unwrap();
        fs::create_dir(&folder).unwrap();
        let missing = dir.join("missing.md");

        let got = md_paths([&md, &upper, &txt, &folder, &missing].map(|p| p.to_path_buf()));
        assert_eq!(
            got,
            vec![
                md.to_str().unwrap().to_owned(),
                upper.to_str().unwrap().to_owned()
            ]
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn skips_executable_and_os_arguments() {
        let dir = temp_dir("args");
        let md = dir.join("note.md");
        fs::write(&md, "").unwrap();

        let args = [
            OsString::from(md.as_os_str()), // 先頭は実行ファイル扱いで捨てる
            OsString::from("-psn_0_12345"),
            OsString::from(md.as_os_str()),
        ];
        assert_eq!(
            md_paths_from_args(args),
            vec![md.to_str().unwrap().to_owned()]
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
