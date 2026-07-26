// ============================================================================
// アプリ全体で共有する定数・文言
// ============================================================================

// 画像を保存するワークスペース内サブフォルダ名。
export const IMAGE_DIR = "image";

// 自動保存のデバウンス時間(ms)。
export const SAVE_DEBOUNCE_MS = 400;

// 外部（別ウィンドウ / 他アプリ）の変更を取り込むまでの待ち時間(ms)。
// 1 回の保存で複数のイベントが届くため、まとめてから 1 回だけ確認する。
export const WATCH_DEBOUNCE_MS = 150;

// フォルダの監視を開始できなかったときだけ使う、確認間隔(ms)。
export const SYNC_FALLBACK_INTERVAL_MS = 1000;

// 軽い一時通知（トースト）を表示しておく時間(ms)。
export const TOAST_DURATION_MS = 1800;

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

// UI 文言は言語ごとに切り替わるため messages.ts に置く（t() 経由で取得）。
// localStorage のキーは prefs.ts に置く（読み書きも同モジュールに閉じる）。
