import { MSG } from "./constants";

// ============================================================================
// キーボードショートカット一覧（単一の情報源）とモーダル表示
// ============================================================================
export interface Shortcut {
  keys: string;
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl / Cmd + N", description: "新規メモ" },
  { keys: "Ctrl / Cmd + E", description: "編集 / プレビュー切替" },
  { keys: "Ctrl / Cmd + F", description: "メモ検索（一覧）/ エディタ内検索" },
  { keys: "Ctrl / Cmd + H", description: "エディタ内 置換" },
  { keys: "?", description: "このショートカット一覧" },
  { keys: "Esc", description: "検索 / ダイアログを閉じる" },
];

let overlay: HTMLDivElement | null = null;

export const shortcutsOpen = (): boolean => overlay !== null;

export function closeShortcuts(): void {
  overlay?.remove();
  overlay = null;
}

export function openShortcuts(): void {
  if (overlay) return;
  const ov = document.createElement("div");
  ov.id = "sc-overlay";
  // 背景（オーバーレイ自身）クリックで閉じる。
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeShortcuts();
  });

  const dialog = document.createElement("div");
  dialog.className = "sc-dialog";

  const head = document.createElement("div");
  head.className = "sc-head";
  const title = document.createElement("div");
  title.className = "sc-title";
  title.textContent = MSG.shortcutsTitle;
  const close = document.createElement("button");
  close.className = "sc-close";
  close.textContent = "✕";
  close.addEventListener("click", () => closeShortcuts());
  head.append(title, close);
  dialog.append(head);

  for (const s of SHORTCUTS) {
    const row = document.createElement("div");
    row.className = "sc-row";
    const desc = document.createElement("span");
    desc.className = "sc-desc";
    desc.textContent = s.description;
    const keys = document.createElement("span");
    keys.className = "sc-keys";
    keys.textContent = s.keys;
    row.append(desc, keys);
    dialog.append(row);
  }

  ov.append(dialog);
  document.body.append(ov);
  overlay = ov;
}

export function toggleShortcuts(): void {
  if (overlay) closeShortcuts();
  else openShortcuts();
}
