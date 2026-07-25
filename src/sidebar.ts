import { state, subscribe, type NoteMeta } from "./store";
import { listEl, emptyEl, wsNameEl, el } from "./dom";
import { baseName } from "./utils";
import { formatDate } from "./format";
import { t, localeOf } from "./i18n";
import { selectNote, deleteNote } from "./notes";
import { openContextMenu, type MenuItem } from "./context-menu";
import { copyPath, openInNewWindow } from "./note-actions";

// ============================================================================
// サイドバー描画
// ============================================================================

// メモ1件に対するコンテキストメニュー項目。
// フォルダを開く操作はメモごとに出さない（どのメモでもワークスペースは同じ）。
// サイドバー上部の ⋯ から開く（workspace.ts）。
function noteMenuItems(path: string): MenuItem[] {
  return [
    { label: t("menuOpenInNewWindow"), action: () => void openInNewWindow(path) },
    { label: t("menuCopyPath"), action: () => void copyPath(path) },
    { label: t("menuDelete"), danger: true, action: () => void deleteNote(path) },
  ];
}

// メモ 1 件の行。パスは dataset に持たせ、クリックは一覧側でまとめて受ける
// （行ごとにリスナを張らないので、件数が増えても再描画が重くならない）。
function noteRow(note: NoteMeta, locale: string): HTMLDivElement {
  const item = el("div", "note-item" + (note.path === state.currentPath ? " selected" : ""));
  item.dataset.path = note.path;

  const sub = el("div", "note-sub");
  sub.append(
    el("span", "note-date", formatDate(note.mtime, locale)),
    el("span", "note-snippet", note.snippet || t("noExtraText")),
  );

  const more = el("button", "note-more", "⋯");
  more.title = t("menuMore");

  item.append(el("div", "note-title", note.title), sub, more);
  return item;
}

export function renderList(): void {
  const q = state.searchQuery;
  const visible = q
    ? state.notes.filter((n) => n.hay.includes(q) || n.title.toLowerCase().includes(q))
    : state.notes;

  if (q && visible.length === 0) {
    listEl.replaceChildren(el("div", "list-empty", t("noSearchResult")));
    emptyEl.hidden = true;
    return;
  }

  // 表記は全件で同じなので、ロケールの解決は 1 回だけにする。
  const locale = localeOf();
  const frag = document.createDocumentFragment();
  for (const note of visible) frag.append(noteRow(note, locale));
  // 差し替えは 1 回にまとめる（1 件ずつ append すると都度レイアウトが走る）。
  listEl.replaceChildren(frag);
  emptyEl.hidden = state.notes.length > 0 || state.currentPath !== null;
}

// 一覧の操作はこの 2 つで受ける（行ごとにリスナを張らない）。
listEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const path = target.closest<HTMLElement>(".note-item")?.dataset.path;
  if (!path) return;
  const more = target.closest<HTMLElement>(".note-more");
  if (!more) {
    void selectNote(path);
    return;
  }
  // ⋯ ボタンは行の選択ではなくメニューを開く。
  e.stopPropagation();
  const r = more.getBoundingClientRect();
  openContextMenu(noteMenuItems(path), r.left, r.bottom + 2);
});

listEl.addEventListener("contextmenu", (e) => {
  const path = (e.target as HTMLElement).closest<HTMLElement>(".note-item")?.dataset.path;
  if (!path) return;
  e.preventDefault();
  openContextMenu(noteMenuItems(path), e.clientX, e.clientY);
});

export function updateWsName(): void {
  wsNameEl.textContent = state.workspace ? baseName(state.workspace) : t("noWorkspace");
}

// 状態が変わるたびに一覧を再描画する。
subscribe(renderList);
