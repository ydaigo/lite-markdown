import { getCurrentWindow } from "@tauri-apps/api/window";

// 自作タイトルバーやウィンドウ操作で使う現在のウィンドウ参照。
export const appWindow = getCurrentWindow();
