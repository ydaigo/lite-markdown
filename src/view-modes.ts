import { state, notify, findNote, type Mode } from "./store";
import { editorEl, emptyEl, previewEl, btnToggle, appEl, searchBarEl, searchInputEl } from "./dom";
import { appWindow } from "./app-window";
import { focusEditor, setDoc } from "./editor";
import { renderPreview } from "./preview";
import { closePreviewSearch } from "./preview-search";
import { setPreviewResizerVisible } from "./preview-width";
import { t } from "./i18n";

// ============================================================================
// 編集/プレビューの切替
// ============================================================================
export function setMode(next: Mode): void {
  state.mode = next;
  if (state.mode === "preview") {
    renderPreview();
    editorEl.hidden = true;
    previewEl.hidden = false;
    // メモが無いときはプレースホルダだけなので、幅を変えるつまみは出さない。
    setPreviewResizerVisible(state.currentPath !== null);
  } else {
    // プレビュー内検索と幅のつまみはプレビューを離れた時点で用済み（どちらも
    // プレビューの上に重ねているので、消さないとエディタの前に残ってしまう）。
    closePreviewSearch();
    setPreviewResizerVisible(false);
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
  // プレビュー中に開いていたメモが消えた場合（削除・外部での削除）に、
  // 幅のつまみだけが残らないようにする。
  setPreviewResizerVisible(false);
}

// ============================================================================
// タイトルバー
// ============================================================================
export async function updateTitle(): Promise<void> {
  const name = findNote(state.currentPath)?.title ?? t("appName");
  await appWindow.setTitle(`${name} — ${t("appName")}`);
}

// ============================================================================
// サイドバーの開閉
// ============================================================================
export function toggleSidebar(): void {
  appEl.classList.toggle("sidebar-hidden");
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
