import { readTheme } from "./prefs";
import { baseName } from "./utils";

// ============================================================================
// アプリ状態と、状態変更を購読者へ通知する軽量ストア
// ============================================================================
export type Theme = "light" | "dark";
export type Mode = "edit" | "preview";

export interface NoteMeta {
  path: string;
  title: string;
  snippet: string;
  mtime: number; // epoch ms
  hay: string; // 検索用に本文を小文字化したもの
}

export interface AppState {
  workspace: string; // 現在のワークスペース（フォルダ）の絶対パス
  workspaces: string[]; // 既知のワークスペース一覧
  notes: NoteMeta[];
  currentPath: string | null;
  mode: Mode;
  searchQuery: string; // 検索クエリ（小文字）
  theme: Theme;
}

// 保存済みのテーマ、無ければ OS の設定に従う。
// エディタの生成時にはもう確定している必要があるため、ここで解決してしまう。
function initialTheme(): Theme {
  const saved = readTheme();
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const state: AppState = {
  workspace: "",
  workspaces: [],
  notes: [],
  currentPath: null,
  mode: "edit",
  searchQuery: "",
  theme: initialTheme(),
};

// ============================================================================
// メモ一覧の操作
// ============================================================================
// 一覧は更新時刻の降順（新しい順）に並べる。並び順と検索はこの 1 か所で揃える。
export const sortNotes = (): void => {
  state.notes.sort((a, b) => b.mtime - a.mtime);
};

export const findNote = (path: string | null): NoteMeta | undefined =>
  state.notes.find((n) => n.path === path);

// プレビュー内のリンクからの解決用。メモはワークスペース直下のフラット構成なので
// ファイル名だけで一意に決まる。大文字小文字の違いは、macOS / Windows のファイル
// システムが区別しないことに合わせて 2 段目で拾う。
export const findNoteByName = (name: string): NoteMeta | undefined => {
  const exact = state.notes.find((n) => baseName(n.path) === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return state.notes.find((n) => baseName(n.path).toLowerCase() === lower);
};

export const removeNote = (path: string): void => {
  state.notes = state.notes.filter((n) => n.path !== path);
};

// ============================================================================
// 変更通知
// ============================================================================
type Listener = () => void;
const listeners = new Set<Listener>();

// 状態変更時に呼ばれる購読者を登録する（例: 一覧の再描画）。
export function subscribe(fn: Listener): void {
  listeners.add(fn);
}

// 全購読者へ状態変更を通知する。
export function notify(): void {
  for (const fn of listeners) fn();
}
