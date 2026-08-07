import { readDir, readTextFile, writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { ask } from "@tauri-apps/plugin-dialog";
import type { NoteMeta } from "./store";
import { state, notify, sortNotes, removeNote, findNoteByName } from "./store";
import { emptyEl } from "./dom";
import { getDoc, setDoc } from "./editor";
import { flushSave, cancelScheduledSave } from "./autosave";
import { setMode, showEmptyState, updateTitle } from "./view-modes";
import { deriveMeta, isBlankNote } from "./meta";
import { statMtime } from "./fs-utils";
import { writeLastNote, readFrontMatterEnabled } from "./prefs";
import { unpin, topNote } from "./pins";
import { withErrorNotice, showToast } from "./errors";
import { isMarkdownPath, joinPath, rfc3339Local } from "./utils";
import { FRONT_MATTER_TEMPLATE } from "./constants";
import { t } from "./i18n";

// 一覧から取り除くときはピンも一緒に落とす（消えたメモの記録を残さない）。
// store の removeNote から呼ばないのは、pins が store を参照していて循環するため。
const forgetNote = (path: string): void => {
  removeNote(path);
  unpin(path);
};

// ============================================================================
// メモ一覧の読み込み
// ============================================================================

// 1 件分のメタを読み取る。読めないファイルは null（一覧から外す）。
async function readNoteMeta(path: string, mtime: number): Promise<NoteMeta | null> {
  let text: string;
  try {
    text = await readTextFile(path);
  } catch {
    return null;
  }
  return { path, ...deriveMeta(text), mtime, hay: text.toLowerCase() };
}

// ワークスペース内の .md のパスと更新時刻を集める。本文は読まないので軽い。
// 一覧の変化を調べるだけの用途（sync.ts の定期確認）にも使う。
export async function listNoteStamps(): Promise<Map<string, number>> {
  const entries = await readDir(state.workspace);
  const paths = entries
    .filter((e) => e.isFile && isMarkdownPath(e.name))
    .map((e) => joinPath(state.workspace, e.name));
  // stat は 1 件ごとに Rust を呼ぶので並行に走らせる。
  const stamps = await Promise.all(paths.map(statMtime));
  const map = new Map<string, number>();
  paths.forEach((p, i) => {
    const mtime = stamps[i];
    // 数え上げてから stat するまでに消えたファイルは載せない。
    if (mtime !== null) map.set(p, mtime);
  });
  return map;
}

// 一覧を作り直す。stamps を渡せば readDir / stat をやり直さない。
// 更新時刻が変わっていないメモは本文を読み直さず、前回のメタを使い回す。
export async function refreshNotes(stamps?: Map<string, number>): Promise<void> {
  const found = stamps ?? (await listNoteStamps());
  const known = new Map(state.notes.map((n) => [n.path, n]));
  // 使い回せるものはその場で確定し、読み直しが要る分だけ並行に読む。
  const list: NoteMeta[] = [];
  const stale: Promise<NoteMeta | null>[] = [];
  for (const [path, mtime] of found) {
    const cached = known.get(path);
    if (cached && cached.mtime === mtime) list.push(cached);
    else stale.push(readNoteMeta(path, mtime));
  }
  for (const meta of await Promise.all(stale)) {
    if (meta) list.push(meta);
  }
  state.notes = list;
  sortNotes();
}

// ============================================================================
// メモ操作
// ============================================================================

// 読み込んだ本文を画面へ出し、記録・一覧・タイトルをまとめて揃える。
// 表示の出し分け（編集/プレビューどちらを見せるか・フォーカス）は setMode に任せる。
function showNote(path: string, text: string, mode = state.mode): void {
  state.currentPath = path;
  setDoc(text);
  writeLastNote(state.workspace, path);
  emptyEl.hidden = true;
  setMode(mode);
  notify();
  void updateTitle();
}

// 別のメモへ移る前に、現在のメモを確定（空なら破棄）する。
export async function commitCurrent(): Promise<void> {
  cancelScheduledSave();
  const path = state.currentPath;
  if (!path) return;
  if (!isBlankNote(getDoc())) {
    await flushSave();
    return;
  }
  // 空メモは macOS メモ同様に破棄。front matter の雛形だけ入って title も空のものは
  // 手つかずとみなして同じく捨てる（雛形を入れる設定でも空メモが溜まらないように）。
  try {
    await remove(path);
  } catch {
    /* すでに無い場合は無視 */
  }
  forgetNote(path);
  state.currentPath = null;
}

export async function selectNote(path: string): Promise<void> {
  if (path === state.currentPath) return;
  await commitCurrent();
  // 読めたときに showNote が currentPath を差し替える（失敗したら元のメモに留まる）。
  let text: string;
  try {
    text = await readTextFile(path);
  } catch {
    await refreshNotes();
    notify();
    return;
  }
  showNote(path, text);
}

// ファイル名（例: note-1784965179337.md）でメモを開く。プレビュー内リンクの入口。
// selectNote は絶対パス前提で、読めなかったときも黙って留まるため、必ず一覧から
// 実際のパスに解決してから渡す。見つからないことは利用者へ知らせる。
export function openNoteByName(name: string): void {
  const note = findNoteByName(name);
  if (!note) {
    showToast(t("noteLinkMissing"));
    return;
  }
  void selectNote(note.path);
}

export async function newNote(): Promise<void> {
  // 現在のメモが手つかずなら、新規作成せずそれを使う。
  if (state.currentPath && isBlankNote(getDoc())) {
    setMode("edit");
    return;
  }
  await commitCurrent();
  const path = joinPath(state.workspace, `note-${Date.now()}.md`);
  // Hugo の記事フォルダでは front matter の雛形から始める（設定で有効にしたときだけ）。
  const text = readFrontMatterEnabled(state.workspace)
    ? FRONT_MATTER_TEMPLATE.replace("{{date}}", rfc3339Local(new Date()))
    : "";
  await writeTextFile(path, text);
  state.notes.unshift({ path, title: t("newNote"), snippet: "", mtime: Date.now(), hay: "" });
  showNote(path, text, "edit");
}

export async function deleteNote(path: string): Promise<void> {
  const ok = await ask(t("deleteConfirm"), { title: t("appName"), kind: "warning" });
  if (!ok) return;
  // 削除に失敗したら通知するが、一覧からは取り除く（多くは「既に無い」ため）。
  await withErrorNotice(t("deleteFailed"), () => remove(path));
  forgetNote(path);
  if (state.currentPath === path) {
    state.currentPath = null;
    // 次に開くのは表示順の先頭（ピンがあればそれ）。
    const next = topNote(state.notes);
    if (next) {
      await selectNote(next.path);
    } else {
      showEmptyState();
      void updateTitle();
    }
  }
  notify();
}
