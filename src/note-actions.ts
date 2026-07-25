import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { withErrorNotice, showToast } from "./errors";
import { t } from "./i18n";

// ============================================================================
// メモ単位のネイティブ操作
// ============================================================================

// 絶対パスをクリップボードへコピーする。
export async function copyPath(path: string): Promise<void> {
  const ok = await withErrorNotice(t("copyPathFailed"), () => writeText(path));
  if (ok) showToast(t("copyPathDone"));
}

// OS のファイルマネージャ（Finder / エクスプローラー）で当該ファイルを選択表示する。
export async function revealInDir(path: string): Promise<void> {
  await withErrorNotice(t("revealFailed"), () => revealItemInDir(path));
}
