import "./styles.css";
import "./events"; // 副作用: DOM イベントの配線と購読の登録
import { registerGlobalErrorHandlers } from "./errors";
import { initTheme } from "./view-modes";
import { applyLanguage } from "./localize";
import { isAutoUpdateEnabled } from "./settings";
import { initWorkspace } from "./workspace";
import { revealWindow } from "./app-window";
import { prefetchRenderer } from "./preview";
import { UPDATE_CHECK_DELAY_MS, REVEAL_DEADLINE_MS } from "./constants";

registerGlobalErrorHandlers();

// ============================================================================
// 初期化
// ============================================================================
// 保存済み設定の読み出しは各モジュールが持つ（テーマ=view-modes、言語=i18n、
// 自動更新=settings、ワークスペース=workspace）。ここは順序だけを決める。
async function init(): Promise<void> {
  initTheme();
  applyLanguage();
  await initWorkspace();
}

// ウィンドウは中身を描き終えてから出す（起動時の白いちらつき対策）。
// メモの読み込みが失敗・長引いても、必ず出す。
void init().finally(() => {
  revealWindow();
  // 表示後の空き時間にプレビュー用のライブラリを先読みしておく。
  setTimeout(prefetchRenderer, 0);
});
setTimeout(revealWindow, REVEAL_DEADLINE_MS);

// 自動更新はリリースビルドのみ。ローカルでは VITE_UPDATER が無いので
// updater のコードごとバンドルから外れる。設定でオフにしていれば確認しない。
if (import.meta.env.VITE_UPDATER === "1" && isAutoUpdateEnabled()) {
  // 起動直後は避け、UI が落ち着いてから更新確認する。
  setTimeout(() => {
    void import("./updater").then((m) => m.checkForUpdates());
  }, UPDATE_CHECK_DELAY_MS);
}
