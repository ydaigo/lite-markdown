import { appWindow } from "./app-window";
import {
  btnNew,
  btnSearch,
  btnSettings,
  btnSidebar,
  btnTheme,
  btnToggle,
  searchInputEl,
  titlebarEl,
  winClose,
  winMax,
  winMin,
  wsBtn,
} from "./dom";
import { state, notify } from "./store";
import { newNote, flushSave, scheduleSave } from "./notes";
import { setMode, toggleMode, toggleTheme, toggleSearch, toggleSidebar } from "./view-modes";
import { toggleWsMenu } from "./workspace";
import {
  setDocChangeHandler,
  setImagePasteHandler,
  openEditorSearch,
  openEditorReplace,
} from "./editor";
import { insertPastedImage } from "./images";
import { toggleSettings, closeSettings, settingsOpen } from "./settings";
import { closeContextMenu } from "./context-menu";

// ============================================================================
// イベント配線
// ============================================================================

// エディタ由来のイベントに処理を接続（循環参照回避のためここで配線）。
setDocChangeHandler(scheduleSave);
setImagePasteHandler(insertPastedImage);

btnNew.addEventListener("click", () => void newNote());
wsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleWsMenu();
});
btnSidebar.addEventListener("click", () => toggleSidebar());
btnSearch.addEventListener("click", () => toggleSearch());
btnSettings.addEventListener("click", () => {
  closeContextMenu();
  toggleSettings();
});
btnToggle.addEventListener("click", () => toggleMode());
btnTheme.addEventListener("click", () => toggleTheme());

// ウィンドウ操作（自作タイトルバー）
winMin.addEventListener("click", () => void appWindow.minimize());
winMax.addEventListener("click", () => void appWindow.toggleMaximize());
winClose.addEventListener("click", () => void appWindow.close());

// タイトルバーの空き領域をダブルクリックで最大化トグル
titlebarEl.addEventListener("dblclick", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("button")) return; // ボタン上は無視
  void appWindow.toggleMaximize();
});

// 検索入力
searchInputEl.addEventListener("input", () => {
  state.searchQuery = searchInputEl.value.trim().toLowerCase();
  notify();
});
searchInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleSearch(false);
});

// メニュー外クリックで閉じる
document.addEventListener("click", () => toggleWsMenu(false));

// Ctrl / Cmd と組み合わせるショートカット（一覧は shortcuts.ts、ここは動作）。
const MOD_KEYS: Record<string, (e: KeyboardEvent) => void> = {
  n: () => void newNote(),
  b: () => toggleSidebar(),
  s: () => void flushSave(),
  e: () => toggleMode(),
  h: () => openFindInEditor(true),
  f: (e) => {
    // Shift 付きはメモ一覧の絞り込み。付いていなければ、メモを開いているときは
    // エディタ内検索、開いていなければ一覧の絞り込み。
    if (e.shiftKey || !openFindInEditor(false)) toggleSearch(true);
  },
};

// キーボードショートカット
window.addEventListener("keydown", (e) => {
  // 設定ダイアログが開いていれば Esc で閉じる。
  if (e.key === "Escape" && settingsOpen()) {
    closeSettings();
    return;
  }
  // 入力中でなければ「?」で設定ダイアログを開閉。
  if (e.key === "?" && !isTypingTarget(e.target)) {
    e.preventDefault();
    closeContextMenu();
    toggleSettings();
    return;
  }
  if (!e.ctrlKey && !e.metaKey) return;
  const run = MOD_KEYS[e.key.toLowerCase()];
  if (!run) return;
  e.preventDefault();
  run(e);
});

// エディタ内の検索パネルを開く。withReplace で置換の行を出すか決める。
// プレビュー中は編集モードへ戻す。メモを開いていないときは何もせず false を返す。
function openFindInEditor(withReplace: boolean): boolean {
  if (!state.currentPath) return false;
  if (state.mode === "preview") setMode("edit");
  if (withReplace) openEditorReplace();
  else openEditorSearch();
  return true;
}

// 入力欄やエディタ（contenteditable）、設定ダイアログの選択欄に
// フォーカスがあるかを判定する。
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

// フォーカスが外れたら保存（安全策）
window.addEventListener("blur", () => void flushSave());
// 閉じる前に保存を完了させる。保存失敗でウィンドウが閉じなくならないよう握りつぶす。
appWindow.onCloseRequested(async () => {
  try {
    await flushSave();
  } catch {
    /* 保存に失敗しても閉じる処理は続行 */
  }
});
