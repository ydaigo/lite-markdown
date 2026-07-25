import { state, subscribe } from "./store";
import { listEl, emptyEl, wsNameEl } from "./dom";
import { baseName } from "./utils";
import { formatDate } from "./format";
import { t, localeOf } from "./i18n";
import { selectNote, deleteNote } from "./notes";
import { openContextMenu, type MenuItem } from "./context-menu";
import { copyPath, revealInDir } from "./note-actions";

// ============================================================================
// サイドバー描画
// ============================================================================

// メモ1件に対するコンテキストメニュー項目。
function noteMenuItems(path: string): MenuItem[] {
  return [
    { label: t("menuCopyPath"), action: () => void copyPath(path) },
    { label: t("menuReveal"), action: () => void revealInDir(path) },
    { label: t("menuDelete"), danger: true, action: () => void deleteNote(path) },
  ];
}

export function renderList(): void {
  listEl.replaceChildren();
  const q = state.searchQuery;
  const visible = q
    ? state.notes.filter((n) => n.hay.includes(q) || n.title.toLowerCase().includes(q))
    : state.notes;

  if (q && visible.length === 0) {
    const none = document.createElement("div");
    none.className = "list-empty";
    none.textContent = t("noSearchResult");
    listEl.append(none);
    emptyEl.hidden = true;
    return;
  }

  for (const note of visible) {
    const item = document.createElement("div");
    item.className = "note-item" + (note.path === state.currentPath ? " selected" : "");
    item.dataset.path = note.path;

    const title = document.createElement("div");
    title.className = "note-title";
    title.textContent = note.title;

    const sub = document.createElement("div");
    sub.className = "note-sub";
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(note.mtime, localeOf());
    const snip = document.createElement("span");
    snip.className = "note-snippet";
    snip.textContent = note.snippet || t("noExtraText");
    sub.append(date, snip);

    const more = document.createElement("button");
    more.className = "note-more";
    more.title = t("menuMore");
    more.textContent = "⋯";
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = more.getBoundingClientRect();
      openContextMenu(noteMenuItems(note.path), r.left, r.bottom + 2);
    });

    item.append(title, sub, more);
    item.addEventListener("click", () => void selectNote(note.path));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(noteMenuItems(note.path), e.clientX, e.clientY);
    });
    listEl.append(item);
  }
  emptyEl.hidden = state.notes.length > 0 || state.currentPath !== null;
}

export function updateWsName(): void {
  wsNameEl.textContent = state.workspace ? baseName(state.workspace) : t("noWorkspace");
}

// 状態が変わるたびに一覧を再描画する。
subscribe(renderList);
