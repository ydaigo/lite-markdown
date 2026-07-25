import { state, notify } from "./store";
import {
  editorEl,
  emptyEl,
  previewEl,
  btnToggle,
  btnTheme,
  appEl,
  searchBarEl,
  searchInputEl,
} from "./dom";
import { appWindow } from "./app-window";
import { focusEditor, applyEditorTheme, setDoc } from "./editor";
import { renderPreview } from "./preview";
import { LS } from "./constants";
import { t } from "./i18n";

// ============================================================================
// 編集/プレビューの切替
// ============================================================================
export function setMode(next: "edit" | "preview"): void {
  state.mode = next;
  if (state.mode === "preview") {
    renderPreview();
    editorEl.hidden = true;
    previewEl.hidden = false;
  } else {
    previewEl.hidden = true;
    editorEl.hidden = state.currentPath === null;
    if (state.currentPath !== null) focusEditor();
  }
  updateModeLabel();
}

export const toggleMode = (): void => setMode(state.mode === "edit" ? "preview" : "edit");

// 切替ボタンには「切り替えた先」を表示する。言語切替後の貼り直しにも使う。
export function updateModeLabel(): void {
  btnToggle.textContent = state.mode === "preview" ? t("editLabel") : t("previewLabel");
}

// メモが無い / 開けないときの表示に切り替える。
export function showEmptyState(): void {
  setDoc("");
  editorEl.hidden = true;
  emptyEl.hidden = false;
}

// ============================================================================
// テーマ
// ============================================================================
export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", state.theme);
  btnTheme.textContent = state.theme === "dark" ? "☀️" : "🌙";
  applyEditorTheme();
}

// 保存済みのテーマを復元して適用する。未保存なら OS の設定に従う（store の既定値）。
export function initTheme(): void {
  const saved = localStorage.getItem(LS.theme);
  if (saved === "light" || saved === "dark") state.theme = saved;
  applyTheme();
}

export function toggleTheme(): void {
  state.theme = state.theme === "dark" ? "light" : "dark";
  // テーマは生の文字列で保存（読み取り側と対称に保つ）。
  localStorage.setItem(LS.theme, state.theme);
  applyTheme();
}

// ============================================================================
// タイトルバー
// ============================================================================
export async function updateTitle(): Promise<void> {
  const cur = state.notes.find((n) => n.path === state.currentPath);
  const name = cur ? cur.title : t("appName");
  await appWindow.setTitle(`${name} — ${t("appName")}`);
}

// ============================================================================
// 検索バーの開閉。検索時はサイドバーを必ず表示する。
// ============================================================================
export function toggleSearch(show?: boolean): void {
  const willShow = show ?? searchBarEl.hidden;
  if (willShow) {
    appEl.classList.remove("sidebar-hidden");
    searchBarEl.hidden = false;
    searchInputEl.focus();
    searchInputEl.select();
  } else {
    searchBarEl.hidden = true;
    if (state.searchQuery) {
      state.searchQuery = "";
      searchInputEl.value = "";
      notify();
    }
  }
}
