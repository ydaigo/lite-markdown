import "./styles.css";
import "./events"; // 副作用: DOM イベントの配線と購読の登録
import { homeDir, join } from "@tauri-apps/api/path";
import { state } from "./store";
import { registerGlobalErrorHandlers } from "./errors";
import { applyTheme } from "./view-modes";
import { applyLanguage } from "./localize";
import { isAutoUpdateEnabled } from "./settings";
import { setWorkspace } from "./workspace";
import { readJSON } from "./storage";
import { LS, DEFAULT_WORKSPACE_DIR, UPDATE_CHECK_DELAY_MS } from "./constants";

registerGlobalErrorHandlers();

// ============================================================================
// 初期化
// ============================================================================
async function init(): Promise<void> {
  const savedTheme = localStorage.getItem(LS.theme);
  if (savedTheme === "light" || savedTheme === "dark") state.theme = savedTheme;
  applyTheme();
  applyLanguage();

  state.workspaces = readJSON<string[]>(LS.workspaces, []);
  const current = localStorage.getItem(LS.current);
  if (current) {
    await setWorkspace(current);
  } else {
    const def = await join(await homeDir(), DEFAULT_WORKSPACE_DIR);
    await setWorkspace(def);
  }
}

void init();

// 自動更新は nightly ビルドのみ。開発時は VITE_UPDATER が無いので
// updater のコードごとバンドルから外れる。設定でオフにしていれば確認しない。
if (import.meta.env.VITE_UPDATER === "1" && isAutoUpdateEnabled()) {
  // 起動直後は避け、UI が落ち着いてから更新確認する。
  setTimeout(() => {
    void import("./updater").then((m) => m.checkForUpdates());
  }, UPDATE_CHECK_DELAY_MS);
}
