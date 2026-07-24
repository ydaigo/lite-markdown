import "./styles.css";
import "./events"; // 副作用: DOM イベントの配線と購読の登録
import { homeDir, join } from "@tauri-apps/api/path";
import { state } from "./store";
import { registerGlobalErrorHandlers } from "./errors";
import { applyTheme } from "./view-modes";
import { setWorkspace } from "./workspace";
import { readJSON } from "./storage";
import { checkForUpdates } from "./updater";
import { LS, DEFAULT_WORKSPACE_DIR, UPDATE_CHECK_DELAY_MS } from "./constants";

registerGlobalErrorHandlers();

// ============================================================================
// 初期化
// ============================================================================
async function init(): Promise<void> {
  const savedTheme = localStorage.getItem(LS.theme);
  if (savedTheme === "light" || savedTheme === "dark") state.theme = savedTheme;
  applyTheme();

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

// 起動直後は避け、UI が落ち着いてから更新確認する。
setTimeout(() => void checkForUpdates(), UPDATE_CHECK_DELAY_MS);
