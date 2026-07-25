import { openPath } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { state } from "./store";
import { flushSave } from "./notes";
import { withErrorNotice, showErrorFor, showToast } from "./errors";
import { NOTE_WINDOW } from "./constants";
import { t } from "./i18n";

// ============================================================================
// ネイティブ操作（メモ / フォルダ）
// ============================================================================

// 絶対パスをクリップボードへコピーする。
export async function copyPath(path: string): Promise<void> {
  const ok = await withErrorNotice(t("copyPathFailed"), () => writeText(path));
  if (ok) showToast(t("copyPathDone"));
}

// OS のファイルマネージャ（Finder / エクスプローラー）でフォルダの中身を開く。
export async function openFolder(dir: string): Promise<void> {
  await withErrorNotice(t("openFolderFailed"), () => openPath(dir));
}

// ============================================================================
// 別ウィンドウで開く
// ============================================================================
// ウィンドウのラベルに使える文字は限られる（英数と - _ / :）ため、パスそのものでは
// なくハッシュから作る。同じメモなら必ず同じラベルになるので、二重に開かずに済む。
// 接頭辞 "note-" は capabilities/default.json の windows 指定と対応する。
function windowLabel(path: string): string {
  let h = 5381;
  for (let i = 0; i < path.length; i++) h = ((h * 33) ^ path.charCodeAt(i)) >>> 0;
  return `note-${h.toString(36)}`;
}

// メモを別ウィンドウで開く。既に開いていれば、そのウィンドウを前面に出す。
export async function openInNewWindow(path: string): Promise<void> {
  await withErrorNotice(t("newWindowFailed"), async () => {
    // このウィンドウで編集中のメモなら、開く前に書き出して内容を揃える。
    if (path === state.currentPath) await flushSave();

    const label = windowLabel(path);
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) return existing.setFocus();

    // 開いたウィンドウ側の initWorkspace() が ?note= を見て該当メモを選ぶ。
    // 見た目はメインウィンドウに合わせ、描画後に自分で show() する（白いちらつき対策）。
    const win = new WebviewWindow(label, {
      url: `index.html?note=${encodeURIComponent(path)}`,
      title: t("appName"),
      ...NOTE_WINDOW,
      decorations: false,
      visible: false,
    });
    // 生成はここから非同期に進むので、失敗はイベントで受け取る。
    void win.once<string>("tauri://error", (e) => showErrorFor(t("newWindowFailed"), e.payload));
  });
}
