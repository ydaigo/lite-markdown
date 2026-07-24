import { state, subscribe } from "./store";
import { listEl, emptyEl, wsNameEl } from "./dom";
import { baseName } from "./utils";
import { formatDate } from "./format";
import { MSG } from "./constants";
import { selectNote, deleteNote } from "./notes";

// ============================================================================
// サイドバー描画
// ============================================================================
export function renderList(): void {
  listEl.replaceChildren();
  const q = state.searchQuery;
  const visible = q
    ? state.notes.filter((n) => n.hay.includes(q) || n.title.toLowerCase().includes(q))
    : state.notes;

  if (q && visible.length === 0) {
    const none = document.createElement("div");
    none.className = "list-empty";
    none.textContent = MSG.noSearchResult;
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
    date.textContent = formatDate(note.mtime);
    const snip = document.createElement("span");
    snip.className = "note-snippet";
    snip.textContent = note.snippet || MSG.noExtraText;
    sub.append(date, snip);

    const del = document.createElement("button");
    del.className = "note-del";
    del.title = "削除";
    del.textContent = "🗑";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteNote(note.path);
    });

    item.append(title, sub, del);
    item.addEventListener("click", () => void selectNote(note.path));
    listEl.append(item);
  }
  emptyEl.hidden = state.notes.length > 0 || state.currentPath !== null;
}

export function updateWsName(): void {
  wsNameEl.textContent = state.workspace ? baseName(state.workspace) : MSG.noWorkspace;
}

// 状態が変わるたびに一覧を再描画する。
subscribe(renderList);
