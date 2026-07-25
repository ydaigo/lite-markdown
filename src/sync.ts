import { readTextFile } from "@tauri-apps/plugin-fs";
import { state, notify } from "./store";
import { getDoc, setDoc } from "./editor";
import { listNoteStamps, refreshNotes, hasPendingSave } from "./notes";
import { renderPreview } from "./preview";
import { showEmptyState, updateTitle } from "./view-modes";
import { SYNC_INTERVAL_MS } from "./constants";

// ============================================================================
// 外部からの変更の取り込み
// ============================================================================
// 同じフォルダは別ウィンドウ（note-actions.ts）や他のアプリからも書き換えられる。
// 一覧は更新時刻の降順で並ぶため、外で保存されると並び順も本文も古いままになる。
// 変更通知には頼らず、一定間隔でパスと更新時刻だけを確認し、差分があったときに
// 読み直す。本文の読み直しは変わったメモだけなので、確認そのものは軽い。

// 前回の確認で見えていたディスク上の状態。state.notes の mtime は自分の保存時に
// Date.now() で更新するため、比較の基準にはディスクから見た値をそのまま持つ。
let seen: Map<string, number> | null = null;
let running = false;

const sameStamps = (a: Map<string, number>, b: Map<string, number>): boolean =>
  a.size === b.size && [...a].every(([path, mtime]) => b.get(path) === mtime);

// 開いているメモが外で書き換えられていれば取り込む。
// 自分の未保存の編集があるときは触らない（保存すればこちらの内容が残る）。
async function adoptCurrentNote(): Promise<void> {
  const path = state.currentPath;
  if (!path || hasPendingSave()) return;

  if (!state.notes.some((n) => n.path === path)) {
    // 外で削除された。編集中ではないので閉じる。
    state.currentPath = null;
    showEmptyState();
    void updateTitle();
    return;
  }

  const text = await readTextFile(path).catch(() => null);
  if (text === null || text === getDoc()) return;
  setDoc(text);
  if (state.mode === "preview") renderPreview();
}

// 差分があれば一覧と本文を最新にする。多重実行はしない。
export async function syncNow(): Promise<void> {
  if (running || !state.workspace) return;
  running = true;
  try {
    // 読めない状態（フォルダを消された直後など）は次回の確認に任せる。
    const stamps = await listNoteStamps().catch(() => null);
    if (!stamps) return;
    if (seen && sameStamps(seen, stamps)) return;
    seen = stamps;
    await refreshNotes(stamps);
    await adoptCurrentNote();
    notify(); // 一覧の再描画は差分があったときだけ（スクロール位置を保つ）
  } finally {
    running = false;
  }
}

// 今の状態を「確認済み」として覚える。起動直後やワークスペース切替の直後は
// 読み込んだばかりで最新なので、無駄な読み直しを 1 回省く。
export async function markSynced(): Promise<void> {
  seen = await listNoteStamps().catch(() => null);
}

export function startSync(): void {
  void markSynced();
  window.setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
  // 別ウィンドウから戻ってきたときは、次の確認を待たずに合わせる。
  window.addEventListener("focus", () => void syncNow());
}
