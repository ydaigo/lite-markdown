import { appEl, editorAreaEl, previewEl, pvResizeEl, pvResizeHandle } from "./dom";
import { PREVIEW_WIDTH } from "./constants";
import { readPreviewWidth, writePreviewWidth } from "./prefs";
import { clampPreviewWidth } from "./utils";

// ============================================================================
// プレビュー本文の横幅
// ============================================================================
// 本文は中央寄せなので、右端を dx 動かすと総幅は 2dx 変わる。幅そのものは CSS 変数
// --preview-w に持たせ、#preview と つまみの入れ物が同じ式で参照する（styles.css）。
// こうしておくと、ウィンドウのリサイズやサイドバーの開閉に JS で追従しなくても
// つまみが本文の右端から離れない。

let width = readPreviewWidth() ?? PREVIEW_WIDTH.default;

// 現在の幅を画面へ反映する。テーマ（data-theme）と同じく documentElement に印を置く。
export function applyPreviewWidth(): void {
  document.documentElement.style.setProperty("--preview-w", `${Math.round(width)}px`);
}

// つまみを出すかどうか。プレビューを見ているときだけ意味があるので view-modes が決める。
export function setPreviewResizerVisible(on: boolean): void {
  pvResizeEl.hidden = !on;
}

function setWidth(px: number): void {
  width = px;
  applyPreviewWidth();
}

// ============================================================================
// ドラッグ（配線は一度きり。要素は index.html にあるので作り直されない）
// ============================================================================
let dragging = false;
let centerX = 0; // 入れ物の中心 ＝ 本文の中心
let available = 0; // 入れ物の実幅（上限の元になる）
let grabDx = 0; // 掴んだ点と本文の右端とのズレ

pvResizeHandle.addEventListener("pointerdown", (e) => {
  // 本文のテキスト選択を始めさせない。
  e.preventDefault();
  const area = editorAreaEl.getBoundingClientRect();
  centerX = area.left + area.width / 2;
  available = area.width;
  // つまみのどこを掴んでも境界が飛ばないよう、掴んだ瞬間のズレを覚えておく。
  grabDx = e.clientX - previewEl.getBoundingClientRect().right;
  dragging = true;
  pvResizeHandle.setPointerCapture(e.pointerId);
  appEl.classList.add("pv-resizing");
});

pvResizeHandle.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  // 差分を積まず、ポインタの絶対位置から毎回出す。丸め誤差が溜まらず、上限や下限に
  // 当てたまま外へ動かしても値が暴走せず、戻す向きへ動かせばすぐ追従する。
  setWidth(clampPreviewWidth(2 * (e.clientX - grabDx - centerX), available));
});

// 保存はドラッグの終わりに 1 回だけ（pointermove ごとに書きに行かない）。
function endDrag(): void {
  if (!dragging) return;
  dragging = false;
  appEl.classList.remove("pv-resizing");
  writePreviewWidth(width);
}

pvResizeHandle.addEventListener("pointerup", endDrag);
pvResizeHandle.addEventListener("pointercancel", endDrag);

// ダブルクリックで既定幅へ戻す（図のズーム表示の「ダブルクリックで等倍」と同じ約束）。
pvResizeHandle.addEventListener("dblclick", () => {
  setWidth(PREVIEW_WIDTH.default);
  writePreviewWidth(width);
});
