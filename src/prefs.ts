import { readJSON, writeJSON } from "./storage";

// ============================================================================
// 保存される設定（localStorage）
// ============================================================================
// localStorage に触るのはこのモジュールだけにする。キー名と保存形式（生の文字列か
// JSON か）が 1 か所に集まるので、読み書きが食い違うことがない。
// 値の意味づけ（"ja" が有効な言語か、など）は呼び出し側が持つ。ここは入れ物に徹する。

const KEY = {
  workspaces: "lm.workspaces",
  currentWorkspace: "lm.workspace",
  theme: "lm.theme",
  lang: "lm.lang",
  autoUpdate: "lm.autoUpdate",
  lastNote: "lm.lastNote",
} as const;

// ============================================================================
// テーマ / 表示言語
// ============================================================================
// どちらも短い固定文字列なので生のまま保存する。未保存なら null（既定に従う）。
// テーマは index.html の先読みスクリプトも同じキーを読む（起動時のちらつき対策）。
export const readTheme = (): string | null => localStorage.getItem(KEY.theme);
export const writeTheme = (theme: string): void => localStorage.setItem(KEY.theme, theme);

export const readLang = (): string | null => localStorage.getItem(KEY.lang);
export const writeLang = (lang: string): void => localStorage.setItem(KEY.lang, lang);

// ============================================================================
// 自動更新
// ============================================================================
// 既定で有効。明示的に切ったときだけ "0" を保存する。
export const isAutoUpdateEnabled = (): boolean => localStorage.getItem(KEY.autoUpdate) !== "0";

export const writeAutoUpdateEnabled = (on: boolean): void =>
  localStorage.setItem(KEY.autoUpdate, on ? "1" : "0");

// ============================================================================
// ワークスペース
// ============================================================================
export const readWorkspaces = (): string[] => readJSON<string[]>(KEY.workspaces, []);
export const writeWorkspaces = (list: string[]): void => writeJSON(KEY.workspaces, list);

export const readCurrentWorkspace = (): string | null => localStorage.getItem(KEY.currentWorkspace);
export const writeCurrentWorkspace = (path: string): void =>
  localStorage.setItem(KEY.currentWorkspace, path);

// ============================================================================
// 最後に開いたメモ（ワークスペースごと）
// ============================================================================
type LastNoteMap = Record<string, string>;

export const readLastNote = (workspace: string): string | undefined =>
  readJSON<LastNoteMap>(KEY.lastNote, {})[workspace];

export function writeLastNote(workspace: string, notePath: string): void {
  const map = readJSON<LastNoteMap>(KEY.lastNote, {});
  map[workspace] = notePath;
  writeJSON(KEY.lastNote, map);
}
