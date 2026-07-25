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

// 外部（別ウィンドウ / 他アプリ）の変更を確認する間隔(ms)。
// 確認するのはパスと更新時刻だけで、差分が無ければ本文の読み直しも再描画もしない。
export const SYNC_INTERVAL_MS = 1000;

// 起動後に更新確認を行うまでの遅延(ms)。UI が落ち着いてから実行する。
export const UPDATE_CHECK_DELAY_MS = 3000;

// 初期化がここまでに終わらなくてもウィンドウを表示する時間切れ(ms)。
// 非表示のまま残さないための保険（Rust 側にはさらに長い保険がある）。
export const REVEAL_DEADLINE_MS = 1500;

// 既定ワークスペースのフォルダ名（ホーム直下に作成）。
export const DEFAULT_WORKSPACE_DIR = "lite-markdown-notes";

// メモを別ウィンドウで開くときの大きさ。
// tauri.conf.json の app.windows（メインウィンドウ）と揃えている。
export const NOTE_WINDOW = {
  width: 1000,
  height: 700,
  minWidth: 480,
  minHeight: 360,
} as const;

// UI 文言は言語ごとに切り替わるため i18n.ts に置く（t() 経由で取得）。
