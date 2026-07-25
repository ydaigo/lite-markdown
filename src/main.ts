import "./styles.css";
import "./events"; // 副作用: DOM イベントの配線と購読の登録
import { registerGlobalErrorHandlers } from "./errors";
import { initTheme } from "./view-modes";
import { applyLanguage } from "./localize";
import { isAutoUpdateEnabled } from "./settings";
import { initWorkspace } from "./workspace";
import { UPDATE_CHECK_DELAY_MS } from "./constants";

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

void init();

// 自動更新はリリースビルドのみ。ローカルでは VITE_UPDATER が無いので
// updater のコードごとバンドルから外れる。設定でオフにしていれば確認しない。
if (import.meta.env.VITE_UPDATER === "1" && isAutoUpdateEnabled()) {
  // 起動直後は避け、UI が落ち着いてから更新確認する。
  setTimeout(() => {
    void import("./updater").then((m) => m.checkForUpdates());
  }, UPDATE_CHECK_DELAY_MS);
}
