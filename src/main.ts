import "./styles.css";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { open, ask } from "@tauri-apps/plugin-dialog";
import {
  readDir,
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  stat,
} from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";

// ============================================================================
// 型と状態
// ============================================================================
interface NoteMeta {
  path: string;
  title: string;
  snippet: string;
  mtime: number; // epoch ms
  hay: string; // 検索用に本文を小文字化したもの
}

let workspace = ""; // 現在のワークスペース（フォルダ）の絶対パス
let workspaces: string[] = []; // 既知のワークスペース一覧
let notes: NoteMeta[] = [];
let currentPath: string | null = null;
let mode: "edit" | "preview" = "edit";
let searchQuery = ""; // 検索クエリ（小文字）
let theme: "light" | "dark" =
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

let loading = false; // プログラムからの setDoc 中は自動保存をスキップ
let saveTimer: number | undefined;

const appWindow = getCurrentWindow();

// 予期しないエラーを画面上に可視化（白画面化を防ぐ）
function showError(msg: string) {
  let bar = document.getElementById("error-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "error-bar";
    document.body.appendChild(bar);
  }
  bar.textContent = "⚠ " + msg;
  bar.hidden = false;
}
window.addEventListener("error", (e) => showError(e.message));
window.addEventListener("unhandledrejection", (e) => showError(String((e as PromiseRejectionEvent).reason)));

// localStorage キー
const LS = {
  workspaces: "lm.workspaces",
  current: "lm.workspace",
  theme: "lm.theme",
  lastNote: "lm.lastNote", // { [workspace]: notePath }
};

// ============================================================================
// DOM 参照
// ============================================================================
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const editorEl = $<HTMLDivElement>("editor");
const previewEl = $<HTMLElement>("preview");
const emptyEl = $<HTMLDivElement>("empty-state");
const listEl = $<HTMLDivElement>("note-list");
const wsNameEl = $<HTMLSpanElement>("ws-name");
const wsMenuEl = $<HTMLDivElement>("ws-menu");
const btnToggle = $<HTMLButtonElement>("btn-toggle");
const btnTheme = $<HTMLButtonElement>("btn-theme");
const appEl = $<HTMLDivElement>("app");
const searchBarEl = $<HTMLDivElement>("search-bar");
const searchInputEl = $<HTMLInputElement>("search-input");

// ============================================================================
// CodeMirror
// ============================================================================
const themeCompartment = new Compartment();

const darkTheme = EditorView.theme(
  {
    "&": { color: "#e6e6e6", backgroundColor: "transparent" },
    ".cm-content": { caretColor: "#e6e6e6" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e6e6e6" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#666", border: "none" },
  },
  { dark: true },
);

const lightTheme = EditorView.theme(
  {
    "&": { color: "#1a1a1a", backgroundColor: "transparent" },
    ".cm-content": { caretColor: "#1a1a1a" },
    ".cm-activeLine": { backgroundColor: "rgba(0,0,0,0.03)" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#aaa", border: "none" },
  },
  { dark: false },
);

const mdHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "bold", color: "#3b82f6" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "#0ea5e9", textDecoration: "underline" },
  { tag: tags.monospace, color: "#e11d48" },
  { tag: tags.quote, color: "#8b8b8b", fontStyle: "italic" },
  { tag: tags.list, color: "#a855f7" },
]);

const cmTheme = () => (theme === "dark" ? darkTheme : lightTheme);

const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      lineNumbers(),
      history(),
      highlightActiveLine(),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(mdHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      themeCompartment.of(cmTheme()),
      EditorView.lineWrapping,
      placeholder("メモを入力…"),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !loading) scheduleSave();
      }),
    ],
  }),
  parent: editorEl,
});

const getDoc = () => view.state.doc.toString();

function setDoc(text: string) {
  loading = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  loading = false;
}

// ============================================================================
// メモのタイトル/抜粋の導出
// ============================================================================
function deriveMeta(text: string): { title: string; snippet: string } {
  const lines = text.split(/\r?\n/);
  let title = "";
  let snippet = "";
  for (const line of lines) {
    const t = line.trim().replace(/^#+\s*/, "").replace(/^[-*+]\s+/, "");
    if (!t) continue;
    if (!title) title = t;
    else {
      snippet = t;
      break;
    }
  }
  return { title: title || "新規メモ", snippet };
}

// ============================================================================
// プレビュー
// ============================================================================
marked.setOptions({ gfm: true, breaks: false });

function renderPreview() {
  const text = getDoc();
  if (text.trim() === "") {
    // 空メモをプレビューしたときに真っ白にならないようプレースホルダを表示。
    previewEl.innerHTML = '<p class="preview-empty">（このメモは空です）</p>';
    return;
  }
  const html = marked.parse(text, { async: false }) as string;
  previewEl.innerHTML = DOMPurify.sanitize(html);
}

function setMode(next: "edit" | "preview") {
  mode = next;
  if (mode === "preview") {
    renderPreview();
    editorEl.hidden = true;
    previewEl.hidden = false;
    btnToggle.textContent = "エディタ";
  } else {
    previewEl.hidden = true;
    editorEl.hidden = currentPath === null;
    btnToggle.textContent = "プレビュー";
    if (currentPath !== null) view.focus();
  }
}

const toggleMode = () => setMode(mode === "edit" ? "preview" : "edit");

// ============================================================================
// テーマ
// ============================================================================
function applyTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  btnTheme.textContent = theme === "dark" ? "☀️" : "🌙";
  view.dispatch({ effects: themeCompartment.reconfigure(cmTheme()) });
}

function toggleTheme() {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem(LS.theme, theme);
  applyTheme();
}

// ============================================================================
// タイトルバー
// ============================================================================
async function updateTitle() {
  const cur = notes.find((n) => n.path === currentPath);
  const name = cur ? cur.title : "lite-markdown";
  await appWindow.setTitle(`${name} — lite-markdown`);
}

// ============================================================================
// 日付表示
// ============================================================================
function formatDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ============================================================================
// サイドバー描画
// ============================================================================
function renderList() {
  listEl.replaceChildren();
  const visible = searchQuery
    ? notes.filter((n) => n.hay.includes(searchQuery) || n.title.toLowerCase().includes(searchQuery))
    : notes;

  if (searchQuery && visible.length === 0) {
    const none = document.createElement("div");
    none.className = "list-empty";
    none.textContent = "該当するメモがありません";
    listEl.append(none);
    emptyEl.hidden = true;
    return;
  }

  for (const note of visible) {
    const item = document.createElement("div");
    item.className = "note-item" + (note.path === currentPath ? " selected" : "");
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
    snip.textContent = note.snippet || "追加テキストなし";
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
  emptyEl.hidden = notes.length > 0 || currentPath !== null;
}

function updateWsName() {
  wsNameEl.textContent = workspace ? baseName(workspace) : "（未選択）";
}

const baseName = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;

// ============================================================================
// 自動保存
// ============================================================================
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flushSave(), 400);
}

// 現在のメモを書き込み、一覧のメタを更新して先頭へ並べ替える。
async function flushSave() {
  clearTimeout(saveTimer);
  if (!currentPath) return;
  const text = getDoc();
  await writeTextFile(currentPath, text);
  const meta = notes.find((n) => n.path === currentPath);
  if (meta) {
    const d = deriveMeta(text);
    meta.title = d.title;
    meta.snippet = d.snippet;
    meta.mtime = Date.now();
    meta.hay = text.toLowerCase();
    notes.sort((a, b) => b.mtime - a.mtime);
    renderList();
    void updateTitle();
  }
}

// 別のメモへ移る前に、現在のメモを確定（空なら破棄）する。
async function commitCurrent() {
  clearTimeout(saveTimer);
  if (!currentPath) return;
  const text = getDoc();
  if (text.trim() === "") {
    // 空メモは macOS メモ同様に破棄。
    try {
      await remove(currentPath);
    } catch {
      /* すでに無い場合は無視 */
    }
    notes = notes.filter((n) => n.path !== currentPath);
    currentPath = null;
  } else {
    await flushSave();
  }
}

// ============================================================================
// メモ操作
// ============================================================================
async function refreshNotes() {
  const entries = await readDir(workspace);
  const mdNames = entries
    .filter((e) => e.isFile && /\.md$/i.test(e.name))
    .map((e) => e.name);
  const metas: NoteMeta[] = [];
  for (const name of mdNames) {
    const path = await join(workspace, name);
    let text = "";
    try {
      text = await readTextFile(path);
    } catch {
      continue;
    }
    let mtime = 0;
    try {
      const s = await stat(path);
      mtime = s.mtime ? new Date(s.mtime).getTime() : 0;
    } catch {
      /* stat 失敗時は 0 */
    }
    metas.push({ path, ...deriveMeta(text), mtime, hay: text.toLowerCase() });
  }
  metas.sort((a, b) => b.mtime - a.mtime);
  notes = metas;
}

async function selectNote(path: string) {
  if (path === currentPath) return;
  await commitCurrent();
  currentPath = path;
  let text = "";
  try {
    text = await readTextFile(path);
  } catch {
    await refreshNotes();
    renderList();
    return;
  }
  setDoc(text);
  saveLastNote(path);
  if (mode === "preview") renderPreview();
  editorEl.hidden = mode === "preview";
  emptyEl.hidden = true;
  renderList();
  void updateTitle();
  if (mode === "edit") view.focus();
}

async function newNote() {
  // 現在のメモが空なら、新規作成せずそれを使う。
  if (currentPath && getDoc().trim() === "") {
    setMode("edit");
    view.focus();
    return;
  }
  await commitCurrent();
  const path = await join(workspace, `note-${Date.now()}.md`);
  await writeTextFile(path, "");
  notes.unshift({ path, title: "新規メモ", snippet: "", mtime: Date.now(), hay: "" });
  currentPath = path;
  setDoc("");
  saveLastNote(path);
  setMode("edit");
  emptyEl.hidden = true;
  editorEl.hidden = false;
  renderList();
  void updateTitle();
  view.focus();
}

async function deleteNote(path: string) {
  const ok = await ask("このメモを削除しますか？", { title: "lite-markdown", kind: "warning" });
  if (!ok) return;
  try {
    await remove(path);
  } catch {
    /* 無視 */
  }
  notes = notes.filter((n) => n.path !== path);
  if (currentPath === path) {
    currentPath = null;
    if (notes.length) {
      await selectNote(notes[0].path);
    } else {
      setDoc("");
      editorEl.hidden = true;
      emptyEl.hidden = false;
      void updateTitle();
    }
  }
  renderList();
}

// ============================================================================
// ワークスペース
// ============================================================================
function saveLastNote(path: string) {
  const map = readJSON<Record<string, string>>(LS.lastNote, {});
  map[workspace] = path;
  localStorage.setItem(LS.lastNote, JSON.stringify(map));
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function registerWorkspace(path: string) {
  if (!workspaces.includes(path)) {
    workspaces.unshift(path);
    localStorage.setItem(LS.workspaces, JSON.stringify(workspaces));
  }
}

async function setWorkspace(path: string) {
  await commitCurrent();
  try {
    await mkdir(path, { recursive: true });
  } catch {
    /* 既存なら無視 */
  }
  workspace = path;
  currentPath = null;
  localStorage.setItem(LS.current, path);
  registerWorkspace(path);
  updateWsName();

  try {
    await refreshNotes();
  } catch (e) {
    // ホームフォルダ外など、読み取れないフォルダを選んだ場合の保護。
    notes = [];
    setDoc("");
    editorEl.hidden = true;
    emptyEl.hidden = false;
    renderList();
    showError("このフォルダは開けません（ホームフォルダ内を選んでください）: " + String(e));
    return;
  }

  const last = readJSON<Record<string, string>>(LS.lastNote, {})[path];
  if (last && notes.some((n) => n.path === last)) {
    await selectNote(last);
  } else if (notes.length) {
    await selectNote(notes[0].path);
  } else {
    await newNote();
  }
  renderList();
}

async function chooseWorkspaceFolder() {
  const dir = await open({ directory: true, multiple: false, title: "ワークスペースにするフォルダを選択" });
  if (typeof dir === "string") await setWorkspace(dir);
}

// ワークスペース切替メニュー
function toggleWsMenu(show?: boolean) {
  const willShow = show ?? wsMenuEl.hidden;
  if (!willShow) {
    wsMenuEl.hidden = true;
    return;
  }
  wsMenuEl.replaceChildren();
  for (const ws of workspaces) {
    const b = document.createElement("button");
    b.className = "ws-item" + (ws === workspace ? " active" : "");
    b.innerHTML = `<span class="ws-item-name">${baseName(ws)}</span><span class="ws-item-path">${ws}</span>`;
    b.addEventListener("click", () => {
      toggleWsMenu(false);
      if (ws !== workspace) void setWorkspace(ws);
    });
    wsMenuEl.append(b);
  }
  const sep = document.createElement("div");
  sep.className = "ws-sep";
  wsMenuEl.append(sep);
  const choose = document.createElement("button");
  choose.className = "ws-item ws-choose";
  choose.textContent = "📁 フォルダを選択…";
  choose.addEventListener("click", () => {
    toggleWsMenu(false);
    void chooseWorkspaceFolder();
  });
  wsMenuEl.append(choose);
  wsMenuEl.hidden = false;
}

// 検索バーの開閉。検索時はサイドバーを必ず表示する。
function toggleSearch(show?: boolean) {
  const willShow = show ?? searchBarEl.hidden;
  if (willShow) {
    appEl.classList.remove("sidebar-hidden");
    searchBarEl.hidden = false;
    searchInputEl.focus();
    searchInputEl.select();
  } else {
    searchBarEl.hidden = true;
    if (searchQuery) {
      searchQuery = "";
      searchInputEl.value = "";
      renderList();
    }
  }
}

// ============================================================================
// イベント配線
// ============================================================================
$<HTMLButtonElement>("btn-new").addEventListener("click", () => void newNote());
$<HTMLButtonElement>("ws-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  toggleWsMenu();
});
$<HTMLButtonElement>("btn-sidebar").addEventListener("click", () =>
  appEl.classList.toggle("sidebar-hidden"),
);
$<HTMLButtonElement>("btn-search").addEventListener("click", () => toggleSearch());
btnToggle.addEventListener("click", () => toggleMode());
btnTheme.addEventListener("click", () => toggleTheme());

// ウィンドウ操作（自作タイトルバー）
$<HTMLButtonElement>("win-min").addEventListener("click", () => void appWindow.minimize());
$<HTMLButtonElement>("win-max").addEventListener("click", () => void appWindow.toggleMaximize());
$<HTMLButtonElement>("win-close").addEventListener("click", () => void appWindow.close());

// タイトルバーの空き領域をダブルクリックで最大化トグル
$<HTMLElement>("titlebar").addEventListener("dblclick", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest("button")) return; // ボタン上は無視
  void appWindow.toggleMaximize();
});

// 検索入力
searchInputEl.addEventListener("input", () => {
  searchQuery = searchInputEl.value.trim().toLowerCase();
  renderList();
});
searchInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") toggleSearch(false);
});

// メニュー外クリックで閉じる
document.addEventListener("click", () => toggleWsMenu(false));

// キーボードショートカット
window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    void newNote();
  } else if (key === "s") {
    e.preventDefault();
    void flushSave();
  } else if (key === "e") {
    e.preventDefault();
    toggleMode();
  } else if (key === "f") {
    e.preventDefault();
    toggleSearch(true);
  }
});

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

// ============================================================================
// 初期化
// ============================================================================
async function init() {
  theme = (localStorage.getItem(LS.theme) as "light" | "dark") || theme;
  applyTheme();

  workspaces = readJSON<string[]>(LS.workspaces, []);
  const current = localStorage.getItem(LS.current);
  if (current) {
    await setWorkspace(current);
  } else {
    const def = await join(await homeDir(), "lite-markdown-notes");
    await setWorkspace(def);
  }
}

void init();
