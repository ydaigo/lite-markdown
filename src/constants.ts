// ============================================================================
// アプリ全体で共有する定数・文言
// ============================================================================

// 画像を保存するワークスペース内サブフォルダ名の既定値。
// 設定（prefs.ts の imageDir）でワークスペースごとに変えられる。
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

// macOS のネイティブなウィンドウボタン（赤・黄・緑の信号機）の位置。
// メインウィンドウの指定は src-tauri/tauri.macos.conf.json にあり、別ウィンドウには
// note-actions.ts から同じ値を渡す（JSON とは値を共有できないので、変えるときは両方）。
//
// 効くのは x だけ。tao の inset_traffic_lights はボタンへ x しか代入せず、y は
// タイトルバーのコンテナ高さを「ボタン高さ + y」にする形で間接的に効かせる作りだが、
// ボタンがコンテナ上端に固定されているため縦位置は動かない。実測では OS がボタン中心
// を上端から 16px に置く（y をどう変えても不変）。ここに合わせて styles.css では
// macOS のタイトルバーを 33px にしている。y は届かないが実測値を記録として残す。
export const MAC_TRAFFIC_LIGHT = { x: 14, y: 16 } as const;

// フルスクリーンの出入りを確かめるまでの待ち時間(ms)。
// リサイズは連続で届くため、落ち着いてから 1 回だけ Rust に問い合わせる。
export const FULLSCREEN_SYNC_DEBOUNCE_MS = 120;

// Mermaid 図の SVG を覚えておく上限（本数）。プレビューは切り替えるたびに全体を
// 作り直すため、同じ図を何度も描き直さないよう結果をキャッシュする。
export const DIAGRAM_CACHE_LIMIT = 64;

// 図のズーム表示で許す倍率の範囲と、ボタン 1 回あたりの変化量。
// pinch は連続的な操作（トラックパッドのピンチ / Cmd+スクロール）用の感度で、
// 変化量 1 あたりの指数。1 イベントで飛びすぎないよう deltaY は clamp で抑える。
export const DIAGRAM_ZOOM = {
  min: 0.2,
  max: 8,
  step: 1.2,
  pinch: 0.01,
  pinchClamp: 40,
} as const;

// プレビュー本文の横幅(px)。右端のドラッグで変えられ、値は prefs.ts が覚える。
// default は初期値で、つまみのダブルクリックで戻す先でもある。min は padding
// （左右 32px）込みの下限で、これ以下だと本文が 300px を切って表が壊れる。
// 上限は入れ物（#editor-area）の実幅なので定数には持たない。gutter はつまみを
// 置く左右の余白で、本文が入れ物いっぱいに広がってつまみが画面外へ出るのを防ぐ。
export const PREVIEW_WIDTH = { default: 860, min: 360, gutter: 12 } as const;

// UI 文言は言語ごとに切り替わるため messages.ts に置く（t() 経由で取得）。
// localStorage のキーは prefs.ts に置く（読み書きも同モジュールに閉じる）。
