// ============================================================================
// アプリ全体で共有する定数・文言
// ============================================================================

// localStorage キー
export const LS = {
  workspaces: "lm.workspaces",
  current: "lm.workspace",
  theme: "lm.theme",
  lastNote: "lm.lastNote", // { [workspace]: notePath }
} as const;

// 画像を保存するワークスペース内サブフォルダ名。
export const IMAGE_DIR = "image";

// 自動保存のデバウンス時間(ms)。
export const SAVE_DEBOUNCE_MS = 400;

// 起動後に更新確認を行うまでの遅延(ms)。UI が落ち着いてから実行する。
export const UPDATE_CHECK_DELAY_MS = 3000;

// 既定ワークスペースのフォルダ名（ホーム直下に作成）。
export const DEFAULT_WORKSPACE_DIR = "lite-markdown-notes";

// UI 文言。
export const MSG = {
  appName: "lite-markdown",
  newNote: "新規メモ",
  noExtraText: "追加テキストなし",
  emptyNote: "（このメモは空です）",
  noSearchResult: "該当するメモがありません",
  noWorkspace: "（未選択）",
  chooseFolder: "📁 フォルダを選択…",
  chooseWorkspaceTitle: "ワークスペースにするフォルダを選択",
  editorPlaceholder: "メモを入力…",
  editLabel: "エディタ",
  previewLabel: "プレビュー",
  deleteConfirm: "このメモを削除しますか？",
  cannotOpenFolder: "このフォルダは開けません（ホームフォルダ内を選んでください）",
  imageSaveFailed: "画像の保存に失敗しました",
  saveFailed: "メモの保存に失敗しました",
  deleteFailed: "メモの削除に失敗しました",
} as const;
