import { listen } from "@tauri-apps/api/event";
import { state } from "./store";
import { appWindow } from "./app-window";
import { openInNewWindow } from "./note-actions";

// ============================================================================
// OS の「このアプリで開く」で渡された .md ファイル
// ============================================================================
// 起動時に渡されたものは、メインウィンドウが initWorkspace() で受け取って自分で開く
// （そのフォルダをワークスペースにする）。起動中に渡されたものはここで受け、
// 今の作業を崩さないよう別ウィンドウで開く。届け先は Rust 側が 1 つのウィンドウに
// 絞る（src-tauri/src/open_files.rs）。

const OPEN_FILES_EVENT = "open-files";

// 起動中に渡されたファイルを開く。このウィンドウで開いているファイルなら前に出すだけ。
export async function openExternalFile(path: string): Promise<void> {
  if (path === state.currentPath) {
    await appWindow.show();
    await appWindow.setFocus();
    return;
  }
  await openInNewWindow(path);
}

export async function listenOpenFiles(): Promise<void> {
  await listen<string[]>(OPEN_FILES_EVENT, (e) => {
    for (const path of e.payload) void openExternalFile(path);
  });
}
