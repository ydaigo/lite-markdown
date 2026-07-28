import { el, previewEl } from "./dom";
import { state } from "./store";
import { t } from "./i18n";
import { boundedCache, diagramErrorLine, mermaidThemeName } from "./utils";
import { DIAGRAM_CACHE_LIMIT } from "./constants";

// ============================================================================
// Mermaid 図（```mermaid フェンス）の描画
// ============================================================================
// mermaid は marked / DOMPurify の数十倍あり、図の無いメモでは一切要らない。
// そのため起動時の先読みはせず、「プレビューの中に実際にフェンスがあった」ときだけ
// 動的 import する。図の種類ごとの読み込みは mermaid 自身が更に遅延させるので、
// 使った種類のチャンクだけが取得される。
type Mermaid = typeof import("mermaid").default;

let loading: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  loading ??= import("mermaid")
    .then(({ default: m }) => {
      m.initialize({
        startOnLoad: false, // 走査は自前で行う
        securityLevel: "strict", // ラベル内の HTML と click 定義を無効化する
        suppressErrorRendering: true, // 失敗時に mermaid 製のエラー図を差し込ませない
        theme: mermaidThemeName(state.theme),
      });
      return m;
    })
    .catch((e: unknown) => {
      // 失敗を握ったままにせず、次の描画で読み込みを再試行できるようにする。
      loading = null;
      throw e;
    });
  return loading;
}

// 図の見た目は「ソース + テーマ」で決まる。プレビューは切り替えるたびに全体を
// 作り直すため、ここで覚えておかないと毎回描き直しになる。
const svgCache = boundedCache<string>(DIAGRAM_CACHE_LIMIT);

// 非同期の描画中に本文やテーマが変わったら、古い結果は捨てる。差し込み先の <pre> は
// 既に DOM から外れているので実害は無いが、無駄な描画も止める。
let generation = 0;

export const cancelDiagrams = (): void => void (generation += 1);

interface Pending {
  pre: Element;
  source: string;
  key: string;
}

// プレビュー内の ```mermaid フェンスを図に置き換える。renderPreview() を同期の
// ままにしたいので、実際の描画は待たずに投げる。
export function renderDiagrams(): void {
  const gen = generation;
  const codes = previewEl.querySelectorAll("pre > code.language-mermaid");
  if (codes.length === 0) return; // 図が無ければ mermaid は読み込まない

  // キャッシュにある図はここで同期的に差し替える（切替のたびにちらつかせない）。
  const pending: Pending[] = [];
  for (const code of codes) {
    const pre = code.parentElement;
    if (!pre) continue;
    const source = code.textContent ?? "";
    if (source.trim() === "") continue;
    const key = `${state.theme}\n${source}`;
    const cached = svgCache.get(key);
    if (cached) putSvg(pre, cached);
    else pending.push({ pre, source, key });
  }
  if (pending.length === 0) return;

  void drawPending(gen, pending);
}

async function drawPending(gen: number, pending: Pending[]): Promise<void> {
  let m: Mermaid;
  try {
    m = await loadMermaid();
  } catch (e) {
    if (gen === generation) for (const p of pending) putError(p.pre, e);
    return;
  }
  if (gen !== generation) return;
  // テーマは切り替わるので、描く直前に現在値を入れ直す。
  m.initialize({ theme: mermaidThemeName(state.theme) });

  for (const [i, p] of pending.entries()) {
    // 同じ図が 2 つ並ぶこともあるので、直前に描いた結果も拾う。
    const done = svgCache.get(p.key);
    if (done) {
      putSvg(p.pre, done);
      continue;
    }
    // id は SVG 内の <style> のスコープになるため、描画のたびに別の値にする。
    const id = `mmd-${gen}-${i}`;
    let svg: string;
    try {
      svg = (await m.render(id, p.source)).svg;
    } catch (e) {
      if (gen === generation) putError(p.pre, e);
      continue;
    } finally {
      // 採寸のため body へ足される一時要素は、失敗すると残ることがある。
      // 出来上がった SVG も同じ id を持つので、差し込む前に必ず片付ける
      // （後で消すと getElementById がプレビュー内の SVG を拾って消してしまう）。
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
    }
    if (gen !== generation) return;
    svgCache.set(p.key, svg);
    putSvg(p.pre, svg);
  }
}

// <pre> ごと図の入れ物に置き換える。
// ここで DOMPurify を通していないのは意図的。mermaid は securityLevel: "strict" で
// ラベルを自前に無害化しており、逆に DOMPurify の既定設定は <foreignObject> を落とす
// ため、通すとラベルの文字が全部消えてしまう。
function putSvg(pre: Element, svg: string): void {
  const box = el("div", "mermaid-diagram");
  box.title = t("tipDiagramZoom");
  box.innerHTML = svg;
  // ズーム表示に元の SVG をそのまま渡せるように持たせておく。
  box.dataset.svg = svg;
  pre.replaceWith(box);
}

// 構文エラーは書いている途中にも普通に起きるので、エラーバーやモーダルは出さない。
// 元のコードブロックを残したまま、理由を 1 行だけ添える。
function putError(pre: Element, e: unknown): void {
  const next = pre.nextElementSibling;
  // 描き直しでエラー行が積み重ならないように、前回の分を消してから足す。
  if (next?.classList.contains("mermaid-error")) next.remove();
  pre.after(el("div", "mermaid-error", `${t("diagramFailed")}: ${diagramErrorLine(e)}`));
}
