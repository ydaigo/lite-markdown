import { check } from "@tauri-apps/plugin-updater";

// ============================================================================
// 自動更新
// ============================================================================
// 起動後にバックグラウンドで最新版を確認し、新版があれば無音で DL + インストール。
// macOS は次回起動で自然に適用。Windows は NSIS を静かに入れ替える。
// 失敗しても通常のメモ利用を妨げないよう、すべて握りつぶす。
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (update) {
      await update.downloadAndInstall();
    }
  } catch {
    /* オフライン・endpoint 到達不可などは黙って無視 */
  }
}
