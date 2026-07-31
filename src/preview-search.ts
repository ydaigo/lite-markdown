import {
  previewEl,
  pvFindEl,
  pvFindInput,
  pvFindCount,
  pvFindPrev,
  pvFindNext,
  pvFindClose,
} from "./dom";
import { matchOffsets } from "./utils";

// ============================================================================
// プレビュー内検索
// ============================================================================
// エディタ側は CodeMirror の検索パネルに任せられるが、プレビューは素の DOM なので
// 自前で持つ。ハイライトは CSS Custom Highlight API（Range に色を塗る仕組み）で
// 行い、本文の DOM には一切手を入れない。<mark> で包む方式だと Mermaid の SVG や
// リンクのクリック処理を壊しかねず、再描画のたびに作り直しも要るため採らない。
//
// 登録名は styles.css の ::highlight() と揃えること。
const HL_ALL = "pv-find";
const HL_CURRENT = "pv-find-current";

// 現在の一致（ranges[index]）。ranges が空なら index は -1。
let ranges: Range[] = [];
let index = -1;

// この環境で CSS Custom Highlight API が使えるか。使えなければプレビュー内検索は
// 提供せず、呼び出し元（events.ts）が従来どおりエディタ内検索へ回す。
const supported = (): boolean => typeof CSS !== "undefined" && "highlights" in CSS;

export const previewSearchOpen = (): boolean => !pvFindEl.hidden;

// 検索バーを開く。使えない環境では何もせず false を返す。
export function openPreviewSearch(): boolean {
  if (!supported()) return false;
  pvFindEl.hidden = false;
  pvFindInput.focus();
  pvFindInput.select();
  // 直前の語のまま開くので、内容が変わっていても件数を合わせ直す。
  runSearch(true);
  return true;
}

export function closePreviewSearch(): void {
  if (pvFindEl.hidden) return;
  pvFindEl.hidden = true;
  clearHighlights();
  ranges = [];
  index = -1;
}

// プレビューを描き直した後に呼ぶ。innerHTML の入れ替えで Range は無効になるため、
// 開いたままなら同じ語で引き直す。閉じているときは何もしない。
export function refreshPreviewSearch(): void {
  if (previewSearchOpen()) runSearch(false);
}

function clearHighlights(): void {
  if (!supported()) return;
  CSS.highlights.delete(HL_ALL);
  CSS.highlights.delete(HL_CURRENT);
}

// 入力欄の語でプレビュー全体を引き直す。moveToFirst が true なら先頭の一致へ、
// false なら画面に近い一致へ寄せる（再描画で位置を見失わないようにするため）。
function runSearch(moveToFirst: boolean): void {
  const query = pvFindInput.value;
  ranges = query === "" ? [] : collectRanges(query);
  index = ranges.length === 0 ? -1 : moveToFirst ? 0 : nearestToView();
  paint();
  if (index >= 0 && moveToFirst) scrollToCurrent();
}

// 一致を 1 つ進める / 戻す（端は反対側へ回り込む）。
function step(delta: number): void {
  if (ranges.length === 0) return;
  index = (index + delta + ranges.length) % ranges.length;
  paint();
  scrollToCurrent();
}

// ハイライトと件数表示を今の状態に合わせる。
function paint(): void {
  clearHighlights();
  if (ranges.length > 0) {
    CSS.highlights.set(HL_ALL, new Highlight(...ranges));
    if (index >= 0) CSS.highlights.set(HL_CURRENT, new Highlight(ranges[index]));
  }
  pvFindCount.textContent = `${index + 1}/${ranges.length}`;
  // 該当なしのときだけ入力欄を赤くする（空欄は「まだ打っていない」なので除く）。
  pvFindInput.classList.toggle("no-match", pvFindInput.value !== "" && ranges.length === 0);
}

// プレビュー内のテキストを 1 本の文字列として扱い、一致箇所を Range にして返す。
// テキストノードは空白だけのものも捨てない。marked の出力ではブロック要素の間に
// 改行のテキストノードが入るので、それを残しておけば別の段落の語がつながって
// 誤って一致することを防げる（逆に <strong> などのインラインは素直につながる）。
function collectRanges(query: string): Range[] {
  const nodes: Text[] = [];
  let text = "";
  const walker = document.createTreeWalker(previewEl, NodeFilter.SHOW_TEXT, {
    // Mermaid の図は SVG で、Range を張っても塗れないうえ図中の語まで拾って
    // しまうので中身ごと飛ばす。
    acceptNode: (n) =>
      n.parentElement?.closest("svg") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text);
    text += n.nodeValue ?? "";
  }

  // 連結後の位置 → (テキストノード, ノード内の位置) を引くための索引。
  // 各ノードの開始位置を昇順に持ち、二分探索で引く。
  const starts: number[] = [];
  let at = 0;
  for (const n of nodes) {
    starts.push(at);
    at += n.length;
  }
  const locate = (pos: number): { node: Text; offset: number } => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return { node: nodes[lo], offset: pos - starts[lo] };
  };

  return matchOffsets(text, query).map((start) => {
    const from = locate(start);
    const to = locate(start + query.length - 1);
    const r = document.createRange();
    r.setStart(from.node, from.offset);
    // 終端は「最後の 1 文字の直後」。語がノードをまたいでも正しく閉じられる。
    r.setEnd(to.node, to.offset + 1);
    return r;
  });
}

// いま表示されている範囲にいちばん近い一致。再描画で引き直したときに、
// 見ている場所から離れた先頭へ飛ばされないようにするため。
function nearestToView(): number {
  const top = previewEl.getBoundingClientRect().top;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ranges.length; i++) {
    const dist = Math.abs(ranges[i].getBoundingClientRect().top - top);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

// 現在の一致が見えていなければ、プレビューを上から 1/3 の位置までスクロールする。
function scrollToCurrent(): void {
  if (index < 0) return;
  const rect = ranges[index].getBoundingClientRect();
  const box = previewEl.getBoundingClientRect();
  if (rect.top >= box.top && rect.bottom <= box.bottom) return;
  previewEl.scrollTop += rect.top - box.top - box.height / 3;
}

// ============================================================================
// 配線（要素は index.html にあるので一度だけ登録すればよい）
// ============================================================================
pvFindInput.addEventListener("input", () => runSearch(true));
pvFindInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    step(e.shiftKey ? -1 : 1);
  } else if (e.key === "Escape") {
    closePreviewSearch();
  }
});
pvFindPrev.addEventListener("click", () => step(-1));
pvFindNext.addEventListener("click", () => step(1));
pvFindClose.addEventListener("click", () => closePreviewSearch());
