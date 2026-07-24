import { readDir, readTextFile, writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/plugin-dialog";
import type { NoteMeta } from "./store";
import { state, notify } from "./store";
import { editorEl, emptyEl } from "./dom";
import { getDoc, setDoc, focusEditor } from "./editor";
import { renderPreview } from "./preview";
import { setMode, updateTitle } from "./view-modes";
import { deriveMeta } from "./meta";
import { statMtime } from "./fs-utils";
import { readJSON, writeJSON } from "./storage";
import { withErrorNotice } from "./errors";
import { LS, MSG, SAVE_DEBOUNCE_MS } from "./constants";

// 更新時刻の降順（新しい順）に並べ替える。
const sortByMtimeDesc = (list: NoteMeta[]): void => {
  list.sort((a, b) => b.mtime - a.mtime);
};

// 指定パスのメモを一覧から取り除く。
const removeNoteByPath = (path: string): void => {
  state.notes = state.notes.filter((n) => n.path !== path);
};

// 最後に開いたメモをワークスペースごとに記録する。
function saveLastNote(path: string): void {
  const map = readJSON<Record<string, string>>(LS.lastNote, {});
  map[state.workspace] = path;
  writeJSON(LS.lastNote, map);
}

// ============================================================================
// 自動保存
// ============================================================================
export function scheduleSave(): void {
  clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
}

// 現在のメモを書き込み、一覧のメタを更新して先頭へ並べ替える。
export async function flushSave(): Promise<void> {
  clearTimeout(state.saveTimer);
  const path = state.currentPath;
  if (!path) return;
  const text = getDoc();
  const ok = await withErrorNotice(MSG.saveFailed, () => writeTextFile(path, text));
  if (!ok) return;
  const meta = state.notes.find((n) => n.path === path);
  if (meta) {
    const d = deriveMeta(text);
    meta.title = d.title;
    meta.snippet = d.snippet;
    meta.mtime = Date.now();
    meta.hay = text.toLowerCase();
    sortByMtimeDesc(state.notes);
    notify();
    void updateTitle();
  }
}

// 別のメモへ移る前に、現在のメモを確定（空なら破棄）する。
export async function commitCurrent(): Promise<void> {
  clearTimeout(state.saveTimer);
  const path = state.currentPath;
  if (!path) return;
  const text = getDoc();
  if (text.trim() === "") {
    // 空メモは macOS メモ同様に破棄。
    try {
      await remove(path);
    } catch {
      /* すでに無い場合は無視 */
    }
    removeNoteByPath(path);
    state.currentPath = null;
  } else {
    await flushSave();
  }
}

// ============================================================================
// メモ操作
// ============================================================================
export async function refreshNotes(): Promise<void> {
  const entries = await readDir(state.workspace);
  const mdNames = entries.filter((e) => e.isFile && /\.md$/i.test(e.name)).map((e) => e.name);
  const metas: NoteMeta[] = [];
  for (const name of mdNames) {
    const path = await join(state.workspace, name);
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      continue;
    }
    const mtime = await statMtime(path);
    metas.push({ path, ...deriveMeta(text), mtime, hay: text.toLowerCase() });
  }
  sortByMtimeDesc(metas);
  state.notes = metas;
}

export async function selectNote(path: string): Promise<void> {
  if (path === state.currentPath) return;
  await commitCurrent();
  state.currentPath = path;
  let text: string;
  try {
    text = await readTextFile(path);
  } catch {
    await refreshNotes();
    notify();
    return;
  }
  setDoc(text);
  saveLastNote(path);
  if (state.mode === "preview") renderPreview();
  editorEl.hidden = state.mode === "preview";
  emptyEl.hidden = true;
  notify();
  void updateTitle();
  if (state.mode === "edit") focusEditor();
}

export async function newNote(): Promise<void> {
  // 現在のメモが空なら、新規作成せずそれを使う。
  if (state.currentPath && getDoc().trim() === "") {
    setMode("edit");
    focusEditor();
    return;
  }
  await commitCurrent();
  const path = await join(state.workspace, `note-${Date.now()}.md`);
  await writeTextFile(path, "");
  state.notes.unshift({ path, title: MSG.newNote, snippet: "", mtime: Date.now(), hay: "" });
  state.currentPath = path;
  setDoc("");
  saveLastNote(path);
  setMode("edit");
  emptyEl.hidden = true;
  editorEl.hidden = false;
  notify();
  void updateTitle();
  focusEditor();
}

export async function deleteNote(path: string): Promise<void> {
  const ok = await ask(MSG.deleteConfirm, { title: MSG.appName, kind: "warning" });
  if (!ok) return;
  // 削除に失敗したら通知するが、一覧からは取り除く（多くは「既に無い」ため）。
  await withErrorNotice(MSG.deleteFailed, () => remove(path));
  removeNoteByPath(path);
  if (state.currentPath === path) {
    state.currentPath = null;
    if (state.notes.length) {
      await selectNote(state.notes[0].path);
    } else {
      setDoc("");
      editorEl.hidden = true;
      emptyEl.hidden = false;
      void updateTitle();
    }
  }
  notify();
}
