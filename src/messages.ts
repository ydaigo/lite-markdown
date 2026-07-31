// ============================================================================
// UI 文言の辞書（単一の情報源）
// ============================================================================
// ja を正とし、en は同じキーを必ず持つ（型で強制）。
// 取り出し方（現在の言語の解決・t()）は i18n.ts が持ち、ここはデータだけを置く。

export type Lang = "ja" | "en";

// 設定画面に出す選択肢。ラベルはその言語自身の表記で固定する。
export const LANGS: readonly { value: Lang; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

// Intl 用のロケール。日付表示に使う。
export const LOCALE: Record<Lang, string> = { ja: "ja-JP", en: "en-US" };

const ja = {
  appName: "lite-markdown",

  // メモ / 一覧
  newNote: "新規メモ",
  noExtraText: "追加テキストなし",
  emptyNote: "（このメモは空です）",
  noSearchResult: "該当するメモがありません",
  sectionPinned: "ピン留め",
  sectionRecent: "最近のメモ",
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
  openFolderFailed: "フォルダを開けませんでした",
  openLinkFailed: "リンクを開けませんでした",
  noteLinkMissing: "リンク先のメモが見つかりません",
  newWindowFailed: "新しいウィンドウを開けませんでした",

  // 自動更新
  updateLabel: "更新",
  tipUpdate: "新しいバージョンがあります",
  updateConfirm: "更新を適用しますか？",
  updateRestartNote: "アプリはいったん終了し、自動的に再起動します。",
  updateDownloading: "更新中",
  updateAppliedNextLaunch: "更新しました。次回の起動から反映されます",
  updateFailed: "更新に失敗しました",

  // 操作メニュー（メモ / ワークスペース）
  menuMore: "操作",
  menuPin: "ピン留め",
  menuUnpin: "ピン留めを解除",
  menuOpenInNewWindow: "新規ウィンドウで開く",
  menuCopyPath: "パスをコピー",
  menuOpenFolder: "ディレクトリを開く",
  menuRemoveFromHistory: "履歴から削除",
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

  // プレビュー内検索（index.html の静的ラベル）
  pvFindPlaceholder: "プレビュー内を検索…",
  tipFindPrev: "前へ (Shift+Enter)",
  tipFindNext: "次へ (Enter)",

  // Mermaid 図
  diagramFailed: "図を描けませんでした",
  tipDiagramZoom: "クリックで拡大",
  tipZoomIn: "拡大",
  tipZoomOut: "縮小",
  tipZoomReset: "等倍に戻す",

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
  scSearch: "エディタ / プレビュー内検索",
  scSearchNotes: "メモ検索（一覧）",
  scReplace: "エディタ内 置換",
  scIndent: "インデント / 解除",
  scTabFocus: "Tab をフォーカス移動に戻す（一時）",
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
  sectionPinned: "Pinned",
  sectionRecent: "Recent",
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
  openFolderFailed: "Failed to open the folder",
  openLinkFailed: "Failed to open the link",
  noteLinkMissing: "Linked note not found",
  newWindowFailed: "Failed to open a new window",

  updateLabel: "Update",
  tipUpdate: "A new version is available",
  updateConfirm: "Apply this update?",
  updateRestartNote: "The app will close and restart automatically.",
  updateDownloading: "Updating",
  updateAppliedNextLaunch: "Updated. It will take effect on the next launch",
  updateFailed: "Failed to update",

  menuMore: "Actions",
  menuPin: "Pin",
  menuUnpin: "Unpin",
  menuOpenInNewWindow: "Open in new window",
  menuCopyPath: "Copy path",
  menuOpenFolder: "Open folder",
  menuRemoveFromHistory: "Remove from history",
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

  pvFindPlaceholder: "Find in preview…",
  tipFindPrev: "Previous (Shift+Enter)",
  tipFindNext: "Next (Enter)",

  diagramFailed: "Failed to render the diagram",
  tipDiagramZoom: "Click to zoom",
  tipZoomIn: "Zoom in",
  tipZoomOut: "Zoom out",
  tipZoomReset: "Reset zoom",

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
  scSearch: "Search in editor / preview",
  scSearchNotes: "Search notes (list)",
  scReplace: "Replace in editor",
  scIndent: "Indent / outdent",
  scTabFocus: "Restore Tab as focus move (temporary)",
  scSettings: "Open settings",
  scEscape: "Close search / dialog",
};

export const DICT: Record<Lang, Record<MsgKey, string>> = { ja, en };
