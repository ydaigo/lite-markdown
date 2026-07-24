import { state, notify } from "./store";
import { editorEl, previewEl, btnToggle, btnTheme, appEl, searchBarEl, searchInputEl } from "./dom";
import { appWindow } from "./app-window";
import { focusEditor, applyEditorTheme } from "./editor";
import { renderPreview } from "./preview";
import { LS, MSG } from "./constants";

// ============================================================================
// 編集/プレビューの切替
// ============================================================================
export function setMode(next: "edit" | "preview"): void {
  state.mode = next;
  if (state.mode === "preview") {
    renderPreview();
    editorEl.hidden = true;
    previewEl.hidden = false;
    btnToggle.textContent = MSG.editLabel;
  } else {
    previewEl.hidden = true;
    editorEl.hidden = state.currentPath === null;
    btnToggle.textContent = MSG.previewLabel;
    if (state.currentPath !== null) focusEditor();
  }
}

export const toggleMode = (): void => setMode(state.mode === "edit" ? "preview" : "edit");

// ============================================================================
// テーマ
// ============================================================================
export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", state.theme);
  btnTheme.textContent = state.theme === "dark" ? "☀️" : "🌙";
  applyEditorTheme();
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
  const name = cur ? cur.title : MSG.appName;
  await appWindow.setTitle(`${name} — ${MSG.appName}`);
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
