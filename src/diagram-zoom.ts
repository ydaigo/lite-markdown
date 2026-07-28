import { el } from "./dom";
import { t } from "./i18n";
import { DIAGRAM_ZOOM } from "./constants";

// ============================================================================
// Mermaid 図のズーム表示
// ============================================================================
// プレビューの本文幅（860px）に収めると大きい図が潰れて読めないため、クリックで
// 全画面に開いて拡大・移動できるようにする。中身は SVG なので拡大しても粗くならない。
// 作りは設定ダイアログ（settings.ts）に合わせている（body に足す / 背景クリックで
// 閉じる / Esc は events.ts のグローバル keydown が担当）。

let overlay: HTMLDivElement | null = null;
let stage: HTMLDivElement | null = null;
let figure: HTMLDivElement | null = null;
let label: HTMLButtonElement | null = null;

// 現在の表示状態。移動は transform、拡大は「レイアウトの大きさ」で行う。
// transform: scale() だと、ブラウザが図をいちど元の大きさで画像化してから引き伸ばす
// ため（合成レイヤ化されると特に）拡大しても粗いままになる。幅そのものを変えれば
// ベクタから描き直されるので、どの倍率でも輪郭が鮮明になる。
let scale = 1;
let tx = 0;
let ty = 0;
// 等倍（100%）のときの図の幅(px)。viewBox から取る図本来の大きさ。
let baseWidth = 0;

export const diagramZoomOpen = (): boolean => overlay !== null;

export function closeDiagramZoom(): void {
  overlay?.remove();
  overlay = null;
  stage = null;
  figure = null;
  label = null;
}

function apply(): void {
  if (figure) {
    figure.style.width = `${baseWidth * scale}px`;
    figure.style.transform = `translate(${tx}px, ${ty}px)`;
  }
  if (label) label.textContent = `${Math.round(scale * 100)}%`;
}

function reset(): void {
  scale = 1;
  tx = 0;
  ty = 0;
  apply();
}

// 指定した点を動かさずに倍率だけ変える。座標はステージ中央を原点に取る。
// figure はステージ中央に寄せてあるので、図の中心から p だけ離れた点は
// 画面上では t + p * scale に来る。拡大を幅で行ってもこの関係は同じなので、
// 「その点を固定する」式は t' = c - (next/scale) * (c - t) で変わらない。
function zoomAt(factor: number, cx: number, cy: number): void {
  const next = Math.min(DIAGRAM_ZOOM.max, Math.max(DIAGRAM_ZOOM.min, scale * factor));
  const k = next / scale;
  tx = cx - k * (cx - tx);
  ty = cy - k * (cy - ty);
  scale = next;
  apply();
}

// ステージ中央を原点にした座標へ直す。
function stagePoint(e: { clientX: number; clientY: number }): [number, number] {
  if (!stage) return [0, 0];
  const r = stage.getBoundingClientRect();
  return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2];
}

// 中身を動かす（2 本指スクロール / ドラッグ）。
function panBy(dx: number, dy: number): void {
  tx += dx;
  ty += dy;
  apply();
}

// 連続的な拡大操作の倍率。ピンチは 1 回の変化が小さく何度も届くため、
// ボタンのような固定ステップではなく変化量に比例させる。
function pinchFactor(deltaY: number): number {
  const d = Math.max(-DIAGRAM_ZOOM.pinchClamp, Math.min(DIAGRAM_ZOOM.pinchClamp, deltaY));
  return Math.exp(-d * DIAGRAM_ZOOM.pinch);
}

// Safari / WKWebView はトラックパッドのピンチを独自の gesture イベントで送る
// （scale は開始時を 1 とした累積倍率）。標準ではないので型を自前で置く。
interface GestureLike extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

// ボタンは中央を軸に拡大縮小する。
const zoomCenter = (factor: number): void => zoomAt(factor, 0, 0);

function toolbar(): HTMLDivElement {
  const bar = el("div", "dz-bar");

  const out = el("button", "dz-btn", "−");
  out.title = t("tipZoomOut");
  out.addEventListener("click", () => zoomCenter(1 / DIAGRAM_ZOOM.step));

  const pct = el("button", "dz-pct");
  pct.title = t("tipZoomReset");
  pct.addEventListener("click", () => reset());
  label = pct;

  const inBtn = el("button", "dz-btn", "＋");
  inBtn.title = t("tipZoomIn");
  inBtn.addEventListener("click", () => zoomCenter(DIAGRAM_ZOOM.step));

  const close = el("button", "dz-btn", "✕");
  close.title = t("tipClose");
  close.addEventListener("click", () => closeDiagramZoom());

  bar.append(out, pct, inBtn, close);
  return bar;
}

export function openDiagramZoom(svg: string): void {
  closeDiagramZoom();

  const fig = el("div", "dz-figure");
  // 図の SVG はプレビューに差し込んだものと同じ文字列。mermaid が
  // securityLevel: "strict" で無害化済みのものをそのまま使う。
  fig.innerHTML = svg;
  figure = fig;

  // mermaid は svg のインライン style に max-width（本来の大きさ）を入れるため、
  // そのままでは幅を広げても図が大きくならない。ここで外して入れ物に追従させる。
  const svgEl = fig.querySelector("svg");
  baseWidth = 0;
  if (svgEl) {
    svgEl.style.maxWidth = "none";
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    // 等倍の基準は図本来の大きさ。viewBox が無ければ width 属性を見る。
    baseWidth = svgEl.viewBox?.baseVal?.width || svgEl.width?.baseVal?.value || 0;
  }
  // 大きさが読めない図でも操作できるよう、最後の手段として窓幅を基準にする。
  if (baseWidth <= 0) baseWidth = Math.min(window.innerWidth * 0.9, 800);

  const st = el("div", "dz-stage");
  st.append(fig);
  stage = st;

  const ov = el("div");
  ov.id = "dz-overlay";
  ov.append(st, toolbar());

  // 背景（ステージの余白）クリックで閉じる。図の上やツールバーでは閉じない。
  st.addEventListener("click", (e) => {
    if (e.target === st) closeDiagramZoom();
  });

  // Safari / WKWebView がピンチを gesture イベントで送ってくる場合は、そちらを
  // 使う（放置するとページ全体が拡大されてしまう）。ブラウザによってはピンチが
  // ctrl+wheel としても届くため、二重に掛からないよう進行中は wheel を無視する。
  let gesturing = false;
  let lastGestureScale = 1;
  st.addEventListener("gesturestart", (ev) => {
    ev.preventDefault();
    gesturing = true;
    lastGestureScale = (ev as GestureLike).scale || 1;
  });
  st.addEventListener("gesturechange", (ev) => {
    ev.preventDefault();
    const g = ev as GestureLike;
    const [cx, cy] = stagePoint(g);
    // scale は累積値なので、前回からの比だけを掛ける。
    if (lastGestureScale > 0) zoomAt(g.scale / lastGestureScale, cx, cy);
    lastGestureScale = g.scale;
  });
  const endGesture = (ev: Event): void => {
    ev.preventDefault();
    gesturing = false;
  };
  st.addEventListener("gestureend", endGesture);

  // Mac のトラックパッドに合わせる。2 本指スクロールは移動、ピンチは拡大縮小。
  // ブラウザはピンチを ctrl+wheel として送るため、そこで拡大に振り分ける
  // （Cmd/Ctrl + スクロールも拡大。Windows でも同じ慣習）。
  st.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (gesturing) return;
      if (e.ctrlKey || e.metaKey) {
        const [cx, cy] = stagePoint(e);
        zoomAt(pinchFactor(e.deltaY), cx, cy);
        return;
      }
      // 指を動かした向きに中身が付いてくる（macOS のナチュラルスクロール）。
      panBy(-e.deltaX, -e.deltaY);
    },
    { passive: false },
  );

  // ドラッグで移動。pointer capture を使うので、図の外へ出ても追従する。
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  st.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    st.setPointerCapture(e.pointerId);
    st.classList.add("dragging");
  });
  st.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    panBy(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = (): void => {
    dragging = false;
    st.classList.remove("dragging");
  };
  st.addEventListener("pointerup", endDrag);
  st.addEventListener("pointercancel", endDrag);

  // ダブルクリックで等倍に戻す。
  st.addEventListener("dblclick", () => reset());

  document.body.append(ov);
  overlay = ov;
  reset();
}
