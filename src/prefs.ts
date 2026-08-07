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
  pinned: "lm.pinned",
  previewWidth: "lm.previewWidth",
  imageDir: "lm.imageDir",
  imageUrlPrefix: "lm.imageUrlPrefix",
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
// プレビュー本文の横幅(px)
// ============================================================================
// 数値を持つ唯一の設定。読む側では「数として成立するか」だけ見て、駄目なら未保存と
// 同じ null を返す（Number("") は 0 になるので isFinite だけでは足りない）。
// 範囲として妥当かの判断は呼び出し側（utils.ts の clampPreviewWidth）。
export const readPreviewWidth = (): number | null => {
  const raw = localStorage.getItem(KEY.previewWidth);
  if (raw === null) return null;
  const px = Number(raw);
  return Number.isFinite(px) && px > 0 ? px : null;
};

export const writePreviewWidth = (px: number): void =>
  localStorage.setItem(KEY.previewWidth, String(Math.round(px)));

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

// ============================================================================
// 画像の保存先（ワークスペースごと）
// ============================================================================
// 保存先は絶対パス、プレフィックスは本文に書くパスの頭。どちらもワークスペースごとに
// 持つ。Hugo の記事フォルダと普段のメモ帳とで置き場所も公開 URL も違うため。
// 未設定なら undefined を返す。既定に倒す・正規化するのは呼び出し側（utils.ts）。
type PathMap = Record<string, string>;

export const readImageDir = (workspace: string): string | undefined =>
  readJSON<PathMap>(KEY.imageDir, {})[workspace];

export const writeImageDir = (workspace: string, dir: string): void =>
  writePerWorkspace(KEY.imageDir, workspace, dir);

export const readImageUrlPrefix = (workspace: string): string | undefined =>
  readJSON<PathMap>(KEY.imageUrlPrefix, {})[workspace];

export const writeImageUrlPrefix = (workspace: string, prefix: string): void =>
  writePerWorkspace(KEY.imageUrlPrefix, workspace, prefix);

// 空文字を渡すとキーごと落として未設定に戻す（既定と同じ意味の値を残さない）。
function writePerWorkspace(key: string, workspace: string, value: string): void {
  const map = readJSON<PathMap>(key, {});
  if (value) map[workspace] = value;
  else delete map[workspace];
  writeJSON(key, map);
}

// ============================================================================
// ピン留めしたメモ（ワークスペースごと）
// ============================================================================
type PinMap = Record<string, string[]>;

// 別ウィンドウでの変更を storage イベントで拾う側が、対象のキーか判定するのに使う。
// 値の読み書きはこのモジュールに閉じたまま、キー名だけを渡す。
export const PINNED_KEY: string = KEY.pinned;

export const readPins = (workspace: string): string[] =>
  readJSON<PinMap>(KEY.pinned, {})[workspace] ?? [];

// ピンが無くなったワークスペースはキーごと落とす（空配列を残さない）。
export function writePins(workspace: string, paths: string[]): void {
  const map = readJSON<PinMap>(KEY.pinned, {});
  if (paths.length) map[workspace] = paths;
  else delete map[workspace];
  writeJSON(KEY.pinned, map);
}
