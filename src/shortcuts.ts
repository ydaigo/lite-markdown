import type { MsgKey } from "./i18n";

// ============================================================================
// キーボードショートカット一覧（単一の情報源）
// ============================================================================
// 表示は設定ダイアログ（settings.ts）が行う。説明文は言語で変わるため
// 文言そのものではなく i18n のキーを保持する。
export interface Shortcut {
  keys: string;
  descKey: MsgKey;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { keys: "Ctrl / Cmd + N", descKey: "scNewNote" },
  { keys: "Ctrl / Cmd + E", descKey: "scToggleMode" },
  { keys: "Ctrl / Cmd + F", descKey: "scSearch" },
  { keys: "Ctrl / Cmd + Shift + F", descKey: "scSearchNotes" },
  { keys: "Ctrl / Cmd + H", descKey: "scReplace" },
  { keys: "?", descKey: "scSettings" },
  { keys: "Esc", descKey: "scEscape" },
];
