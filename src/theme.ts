import { state } from "./store";
import { btnTheme } from "./dom";
import { applyEditorTheme } from "./editor";
import { renderPreview } from "./preview";
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
  // Mermaid 図は色を SVG に焼き込むため CSS 変数では追随できない。プレビュー表示中
  // なら描き直す（テーマ別にキャッシュしているので、戻す側は待ち時間なし）。
  // 起動時は state.mode が "edit" なので main.ts からの呼び出しでは何も起きない。
  if (state.mode === "preview") renderPreview();
}

export function toggleTheme(): void {
  state.theme = state.theme === "dark" ? "light" : "dark";
  writeTheme(state.theme);
  applyTheme();
}
