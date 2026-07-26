import { state } from "./store";
import { btnTheme } from "./dom";
import { applyEditorTheme } from "./editor";
import { writeTheme } from "./prefs";

// ============================================================================
// テーマ（ライト / ダーク）
// ============================================================================
// 現在値の解決は store.ts が起動時に済ませている（index.html の先読みスクリプトと
// 同じ判定）。ここは state.theme を DOM とエディタへ反映する役だけを持つ。

export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", state.theme);
  btnTheme.textContent = state.theme === "dark" ? "☀️" : "🌙";
  applyEditorTheme();
}

export function toggleTheme(): void {
  state.theme = state.theme === "dark" ? "light" : "dark";
  writeTheme(state.theme);
  applyTheme();
}
