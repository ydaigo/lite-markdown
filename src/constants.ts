// ============================================================================
// アプリ全体で共有する定数・文言
// ============================================================================

// localStorage キー
export const LS = {
  workspaces: "lm.workspaces",
  current: "lm.workspace",
  theme: "lm.theme",
  lang: "lm.lang",
  autoUpdate: "lm.autoUpdate",
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

// UI 文言は言語ごとに切り替わるため i18n.ts に置く（t() 経由で取得）。
