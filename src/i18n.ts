import { LS } from "./constants";

// ============================================================================
// 多言語対応（UI 文言の単一の情報源）
// ============================================================================
// ja を正とし、en は同じキーを必ず持つ（型で強制）。
// 文言の取得は t() 経由。モジュール初期化時ではなく呼び出し時に解決されるため、
// 言語切替後は再描画するだけで新しい文言に入れ替わる。

export type Lang = "ja" | "en";

// 設定画面に出す選択肢。ラベルはその言語自身の表記で固定する。
export const LANGS: readonly { value: Lang; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

const ja = {
  appName: "lite-markdown",

  // メモ / 一覧
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
  emptyStateTitle: "メモがありません。",
  emptyStateHint: "「＋ 新規メモ」で始めましょう。",

  // エラー / 通知
  cannotOpenFolder: "このフォルダは開けません（ホームフォルダ内を選んでください）",
  imageSaveFailed: "画像の保存に失敗しました",
  saveFailed: "メモの保存に失敗しました",
  deleteFailed: "メモの削除に失敗しました",
  copyPathDone: "パスをコピーしました",
  copyPathFailed: "パスのコピーに失敗しました",
  revealFailed: "フォルダを開けませんでした",
  newWindowFailed: "新しいウィンドウを開けませんでした",

  // メモの操作メニュー
  menuMore: "操作",
  menuOpenInNewWindow: "新規ウィンドウで開く",
  menuCopyPath: "パスをコピー",
  menuReveal: "ディレクトリを開く",
  menuDelete: "削除",

  // タイトルバー / サイドバー（index.html の静的ラベル）
  tipSidebar: "サイドバー表示切替 (Ctrl/Cmd+B)",
  tipSearch: "メモ検索 (Ctrl/Cmd+Shift+F)",
  tipSettings: "設定",
  tipToggleMode: "プレビュー切替 (Ctrl/Cmd+E)",
  tipTheme: "テーマ切替",
  tipWorkspace: "ワークスペースを切り替え",
  tipNewNote: "新規メモ (Ctrl/Cmd+N)",
  tipMinimize: "最小化",
  tipMaximize: "最大化",
  tipClose: "閉じる",
  searchPlaceholder: "メモを検索…",

  // 設定ダイアログ
  settingsTitle: "設定",
  sectionLanguage: "言語",
  sectionUpdate: "更新",
  sectionShortcuts: "キーボードショートカット",
  langSelectLabel: "表示言語",
  versionLabel: "バージョン",
  autoUpdateLabel: "起動時に自動で更新を確認する",
  autoUpdateUnavailable: "このビルドでは自動更新は利用できません",

  // ショートカットの説明
  scNewNote: "新規メモ",
  scToggleSidebar: "サイドバー表示切替",
  scToggleMode: "編集 / プレビュー切替",
  scSearch: "エディタ内検索",
  scSearchNotes: "メモ検索（一覧）",
  scReplace: "エディタ内 置換",
  scSettings: "設定を開く",
  scEscape: "検索 / ダイアログを閉じる",
} as const;

export type MsgKey = keyof typeof ja;

const en: Record<MsgKey, string> = {
  appName: "lite-markdown",

  newNote: "New note",
  noExtraText: "No additional text",
  emptyNote: "(This note is empty)",
  noSearchResult: "No matching notes",
  noWorkspace: "(none)",
  chooseFolder: "📁 Choose folder…",
  chooseWorkspaceTitle: "Choose a folder to use as the workspace",
  editorPlaceholder: "Write a note…",
  editLabel: "Editor",
  previewLabel: "Preview",
  deleteConfirm: "Delete this note?",
  emptyStateTitle: "No notes yet.",
  emptyStateHint: 'Start with "＋ New note".',

  cannotOpenFolder: "Cannot open this folder (choose one inside your home folder)",
  imageSaveFailed: "Failed to save the image",
  saveFailed: "Failed to save the note",
  deleteFailed: "Failed to delete the note",
  copyPathDone: "Path copied",
  copyPathFailed: "Failed to copy the path",
  revealFailed: "Failed to open the folder",
  newWindowFailed: "Failed to open a new window",

  menuMore: "Actions",
  menuOpenInNewWindow: "Open in new window",
  menuCopyPath: "Copy path",
  menuReveal: "Show in folder",
  menuDelete: "Delete",

  tipSidebar: "Toggle sidebar (Ctrl/Cmd+B)",
  tipSearch: "Search notes (Ctrl/Cmd+Shift+F)",
  tipSettings: "Settings",
  tipToggleMode: "Toggle preview (Ctrl/Cmd+E)",
  tipTheme: "Toggle theme",
  tipWorkspace: "Switch workspace",
  tipNewNote: "New note (Ctrl/Cmd+N)",
  tipMinimize: "Minimize",
  tipMaximize: "Maximize",
  tipClose: "Close",
  searchPlaceholder: "Search notes…",

  settingsTitle: "Settings",
  sectionLanguage: "Language",
  sectionUpdate: "Updates",
  sectionShortcuts: "Keyboard shortcuts",
  langSelectLabel: "Display language",
  versionLabel: "Version",
  autoUpdateLabel: "Check for updates on startup",
  autoUpdateUnavailable: "Auto update is not available in this build",

  scNewNote: "New note",
  scToggleSidebar: "Toggle sidebar",
  scToggleMode: "Toggle editor / preview",
  scSearch: "Search in editor",
  scSearchNotes: "Search notes (list)",
  scReplace: "Replace in editor",
  scSettings: "Open settings",
  scEscape: "Close search / dialog",
};

export const DICT: Record<Lang, Record<MsgKey, string>> = { ja, en };

const isLang = (v: unknown): v is Lang => v === "ja" || v === "en";

// 表示言語を決める（保存値 → OS/ブラウザの言語 → ja）。
// エディタ生成時にはもう確定している必要があるため、モジュール読み込み時に解決する。
function detectLang(): Lang {
  const saved = localStorage.getItem(LS.lang);
  if (isLang(saved)) return saved;
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

let current: Lang = detectLang();

export const getLang = (): Lang => current;

// 現在の言語での文言を返す。
export const t = (key: MsgKey): string => DICT[current][key];

// Intl 用のロケール。日付表示に使う。
export const localeOf = (lang: Lang = current): string => (lang === "ja" ? "ja-JP" : "en-US");

// 言語を切り替えて保存する。DOM への反映は localize.ts の applyLanguage() が行う。
export function setLang(lang: Lang): void {
  current = lang;
  // 言語は生の文字列で保存（読み取り側と対称に保つ）。
  localStorage.setItem(LS.lang, lang);
}
