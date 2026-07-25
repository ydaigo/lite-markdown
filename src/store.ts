// ============================================================================
// アプリ状態と、状態変更を購読者へ通知する軽量ストア
// ============================================================================
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
  mode: "edit" | "preview";
  searchQuery: string; // 検索クエリ（小文字）
  theme: "light" | "dark";
}

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

export const state: AppState = {
  workspace: "",
  workspaces: [],
  notes: [],
  currentPath: null,
  mode: "edit",
  searchQuery: "",
  theme: prefersDark ? "dark" : "light",
};

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
