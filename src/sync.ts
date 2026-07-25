import { readTextFile, watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { state, notify } from "./store";
import { getDoc, setDoc } from "./editor";
import { listNoteStamps, refreshNotes, hasPendingSave } from "./notes";
import { renderPreview } from "./preview";
import { showEmptyState, updateTitle } from "./view-modes";
import { WATCH_DEBOUNCE_MS, SYNC_FALLBACK_INTERVAL_MS } from "./constants";

// ============================================================================
// 外部からの変更の取り込み
// ============================================================================
// 同じフォルダは別ウィンドウ（note-actions.ts）や他のアプリからも書き換えられる。
// 一覧は更新時刻の降順で並ぶため、外で保存されると並び順も本文も古いままになる。
// ワークスペースを監視し、通知が来たときだけ確認する（定期的な確認はしない）。
// 確認するのはパスと更新時刻だけで、差分が無ければ読み直しも再描画もしない。

// 前回の確認で見えていたディスク上の状態。state.notes の mtime は自分の保存時に
// Date.now() で更新するため、比較の基準にはディスクから見た値をそのまま持つ。
let seen: Map<string, number> | null = null;
let running = false;
let unwatch: UnwatchFn | null = null;
let fallbackTimer: number | undefined;

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
    // 読めない状態（フォルダを消された直後など）は次の通知に任せる。
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

// 今の状態を「確認済み」として覚える。読み込んだ直後は最新なので、
// 最初の通知で全件を読み直してしまうのを防ぐ。
async function markSynced(): Promise<void> {
  seen = await listNoteStamps().catch(() => null);
}

// 監視を張れない環境向けの保険。更新が止まるより、間隔を空けて確認する方がよい。
function startFallback(): void {
  if (fallbackTimer !== undefined) return;
  fallbackTimer = window.setInterval(() => void syncNow(), SYNC_FALLBACK_INTERVAL_MS);
}

function stopFallback(): void {
  if (fallbackTimer === undefined) return;
  clearInterval(fallbackTimer);
  fallbackTimer = undefined;
}

// 現在のワークスペースを監視する。切替時は前の監視を止めてから張り替える
// （呼び出しは workspace.ts の setWorkspace）。
export async function watchWorkspace(): Promise<void> {
  unwatch?.();
  unwatch = null;
  if (!state.workspace) return;
  await markSynced();
  try {
    // 画像を置く image/ の変更は一覧に関係しないので再帰はしない。
    unwatch = await watch(state.workspace, () => void syncNow(), {
      recursive: false,
      delayMs: WATCH_DEBOUNCE_MS,
    });
    stopFallback();
  } catch (e) {
    console.error("フォルダの監視を開始できませんでした", e);
    startFallback();
  }
}

// 監視の取りこぼしに備えて、ウィンドウが前面に戻ったときにも確認する。
export function startSync(): void {
  window.addEventListener("focus", () => void syncNow());
}
