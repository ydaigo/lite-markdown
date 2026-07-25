import { state, notify, type NoteMeta } from "./store";
import { PINNED_KEY, readPins, writePins } from "./prefs";

// ============================================================================
// メモのピン留め（一覧の先頭に固定する）
// ============================================================================
// ピンはワークスペースごとに保存する（保存先の詳細は prefs.ts が持つ）。
// .md には何も書き込まないので、本文・更新時刻・保存処理には触らない。
// state.notes は更新時刻の降順のまま保ち、ピンを踏まえた並びは表示のたびに導く
// （順序の持ち主を増やさないため → splitByPin / topNote）。

// 読み込み済みのワークスペース。state.workspace と食い違っていれば読み直すので、
// 切替時に初期化を呼ぶ必要がない（別ウィンドウでの変更も同じ仕組みで追いつく）。
let loadedFor: string | null = null;
let cache = new Set<string>();

function pins(): Set<string> {
  if (loadedFor !== state.workspace) {
    cache = new Set(readPins(state.workspace));
    loadedFor = state.workspace;
  }
  return cache;
}

// 現在のワークスペースの分だけ書き戻す。
function save(set: Set<string>): void {
  writePins(state.workspace, [...set]);
}

export const isPinned = (path: string): boolean => pins().has(path);

// ピンの付け外し。並びは表示時に導くので、ここは再描画の通知だけで足りる。
export function togglePin(path: string): void {
  const set = pins();
  if (!set.delete(path)) set.add(path);
  save(set);
  notify();
}

// メモが無くなったときにピンも落とす（消えたメモの記録を残さない）。
export function unpin(path: string): void {
  const set = pins();
  if (!set.delete(path)) return;
  save(set);
}

// 表示順（ピン群 → その他）に振り分ける。群の中の順序は入力のままなので、
// 更新時刻の降順で渡せばそれぞれの中でも新しい順に並ぶ。
export function splitByPin(list: NoteMeta[]): { pinned: NoteMeta[]; rest: NoteMeta[] } {
  const set = pins();
  const pinned: NoteMeta[] = [];
  const rest: NoteMeta[] = [];
  for (const note of list) (set.has(note.path) ? pinned : rest).push(note);
  return { pinned, rest };
}

// 表示順での先頭。ピンがあればその先頭になる（削除後などに開くメモの決定に使う）。
export function topNote(list: NoteMeta[]): NoteMeta | undefined {
  const { pinned, rest } = splitByPin(list);
  return pinned[0] ?? rest[0];
}

// 別ウィンドウでの変更を取り込む。storage イベントは書き換えた側には飛ばないため、
// ここへ来るのは常に他ウィンドウの変更（clear() のときは key が null）。
window.addEventListener("storage", (e) => {
  if (e.key !== null && e.key !== PINNED_KEY) return;
  loadedFor = null; // 次に参照したときに読み直す
  notify();
});
