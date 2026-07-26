import { readTextFile, watch, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";
import { state, notify } from "./store";
import { getDoc, setDoc } from "./editor";
import { listNoteStamps, refreshNotes } from "./notes";
import { hasPendingSave } from "./autosave";
import { renderPreview } from "./preview";
import { showEmptyState, updateTitle } from "./view-modes";
import { statMtime } from "./fs-utils";
import { isMarkdownPath } from "./utils";
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

const sameStamps = (a: Map<string, number>, b: Map<string, number>): boolean => {
  if (a.size !== b.size) return false;
  for (const [path, mtime] of a) if (b.get(path) !== mtime) return false;
  return true;
};

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

// 数え直した結果を反映する。差分が無ければ読み直しも再描画もしない
// （一覧を作り直さないのでスクロール位置が保たれる）。
async function apply(stamps: Map<string, number>): Promise<void> {
  if (seen && sameStamps(seen, stamps)) return;
  seen = stamps;
  await refreshNotes(stamps);
  await adoptCurrentNote();
  notify();
}

// フォルダ全体を数え直して最新にする。多重実行はしない。
export async function syncNow(): Promise<void> {
  if (running || !state.workspace) return;
  running = true;
  try {
    // 読めない状態（フォルダを消された直後など）は次の通知に任せる。
    const stamps = await listNoteStamps().catch(() => null);
    if (stamps) await apply(stamps);
  } finally {
    running = false;
  }
}

// 通知されたファイルだけを stat して最新にする。フォルダ全体を数え直さないので、
// 自分の保存や他ウィンドウでの編集は stat 1 回で済む（メモが増えても増えない）。
async function syncChanged(paths: string[]): Promise<void> {
  if (running || !seen) return;
  running = true;
  try {
    const stamps = await Promise.all(paths.map(statMtime));
    const next = new Map(seen);
    paths.forEach((path, i) => {
      const mtime = stamps[i];
      // null は「消えた」を意味する（fs-utils の statMtime）。
      if (mtime === null) next.delete(path);
      else next.set(path, mtime);
    });
    await apply(next);
  } finally {
    running = false;
  }
}

// 一覧と前回の記録が同じファイル集合を指しているか。
// 自分で作った / 消したメモは state.notes にだけ先に反映されるため、
// ここがずれている間は記録を基準にできない（数え直しが要る）。
function inSyncWithNotes(stamps: Map<string, number>): boolean {
  return stamps.size === state.notes.length && state.notes.every((n) => stamps.has(n.path));
}

// 監視からの通知。既に知っている .md だけが変わったのなら、その分だけ確認する。
// 追加・改名・見慣れないパスが混じるときは、取りこぼさないよう全体を数え直す。
function onWatchEvent(event: WatchEvent): void {
  const md = event.paths.filter(isMarkdownPath);
  const stamps = seen;
  const known =
    stamps !== null && md.length > 0 && md.every((p) => stamps.has(p)) && inSyncWithNotes(stamps);
  void (known ? syncChanged(md) : syncNow());
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
    unwatch = await watch(state.workspace, onWatchEvent, {
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
