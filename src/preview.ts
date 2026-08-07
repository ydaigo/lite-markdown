import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { previewEl } from "./dom";
import { state, findNoteByName } from "./store";
import { getDoc } from "./editor";
import { withErrorNotice } from "./errors";
import {
  decodePath,
  escapeHtml,
  externalUrl,
  imageSrcPath,
  noteFileName,
  normalizeUrlPrefix,
  relativeNoteName,
  resolveImageDir,
} from "./utils";
import { readImageDir, readImageUrlPrefix } from "./prefs";
import { t } from "./i18n";
import { cancelDiagrams, renderDiagrams } from "./diagrams";
import { openDiagramZoom } from "./diagram-zoom";
import { refreshPreviewSearch } from "./preview-search";

// ============================================================================
// プレビュー（Markdown → HTML）
// ============================================================================
// marked / DOMPurify は起動時には要らないので、バンドルを分けて遅延読み込みする。
// 初回プレビューで待たせないよう、起動が落ち着いた時点で先読みする。
type Renderer = (text: string) => string;

let renderer: Renderer | null = null;
let loading: Promise<Renderer> | null = null;

function loadRenderer(): Promise<Renderer> {
  loading ??= Promise.all([import("marked"), import("dompurify")]).then(
    ([{ marked }, { default: DOMPurify }]) => {
      // Qiita 方式: 単一の改行も <br> として維持する。
      // setOptions では extensions を渡せないので use にまとめる。marked は
      // モジュール全体で 1 つなので登録は累積するが、loading の ??= でここは
      // 1 回しか通らないため二重登録にはならない。
      marked.use({ gfm: true, breaks: true, extensions: [wikiLinkExtension] });
      renderer = (text) => DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
      return renderer;
    },
  );
  return loading;
}

// ============================================================================
// [[メモ名]] リンク
// ============================================================================
// marked の inline 拡張として実装する。描画後の DOM を走査する手もあるが、拡張なら
// `[[foo]]`（コードスパン）やフェンス内の [[foo]] が構造的に対象外になる。
// codespan の tokenizer が先に中身を丸ごと食べ、フェンスはそもそも inline の解析に
// 入らないため。DOM 走査だと pre / code / svg / 既存の a の除外を自前で持つことになる。
//
// [[名前]] と [[名前|表示]] を受ける。![[...]] の画像埋め込みには対応せず、通常の
// リンクとして描く（! を start で拾わないと前のテキストへ取り残されるので含めている）。
const WIKI_LINK = /^!?\[\[([^[\]\n|]+)(?:\|([^[\]\n]*))?\]\]/;

interface WikiLinkToken {
  type: "wikiLink";
  raw: string;
  file: string; // 解決したファイル名（data-note に入れる値）
  label: string; // 画面に出す文字列
  labeled: boolean; // |表示 が書かれていたか（true なら markNoteLinks で差し替えない）
}

const wikiLinkExtension = {
  name: "wikiLink",
  level: "inline" as const,
  start: (src: string) => src.match(/!?\[\[/)?.index,
  tokenizer(src: string): WikiLinkToken | undefined {
    const m = WIKI_LINK.exec(src);
    if (!m) return undefined;
    const file = noteFileName(m[1]);
    // ../ やサブフォルダなど、開けない指定は素通しして生のテキストのまま残す。
    if (!file) return undefined;
    const label = (m[2] ?? m[1]).trim();
    return { type: "wikiLink", raw: m[0], file, label, labeled: m[2] !== undefined };
  },
  renderer(token: { file?: string; label?: string; labeled?: boolean }): string {
    const file = token.file ?? "";
    // href は見た目（リンク色とカーソル）のためだけに置く。実際の行き先は data-note。
    // data-note は DOMPurify が URL として検査しないので、日本語をそのまま往復できる。
    const href = escapeHtml(encodeURIComponent(file));
    // 表示を書き手が決めているものには印を付け、markNoteLinks でタイトルに差し替えない。
    const labeled = token.labeled ? ` data-labeled="1"` : "";
    return `<a class="note-link" data-note="${escapeHtml(file)}"${labeled} href="${href}">${escapeHtml(token.label ?? "")}</a>`;
  },
};

// リンクが指すメモのファイル名。[[...]] は data-note、標準の相対リンクは href から。
const noteNameOf = (a: HTMLAnchorElement): string | null =>
  a.dataset.note ?? relativeNoteName(a.getAttribute("href") ?? "");

// メモへのリンクに、リンク先のタイトルと「今そのメモがあるか」を反映する。
// ファイル名（note-1784965179337 など）のままでは何のメモか分からないので、
// 見つかったものは本文から導いたタイトルに差し替える。
// 文字列を書き換えるため、検索の Range を作り直す refreshPreviewSearch より前に呼ぶこと。
function markNoteLinks(): void {
  previewEl.querySelectorAll("a").forEach((a) => {
    const name = noteNameOf(a);
    if (!name) return;
    a.classList.add("note-link");
    const note = findNoteByName(name);
    if (!note) {
      // 押しても開けないことを見た目でも知らせる（文字は書いたまま残す）。
      a.classList.add("missing");
      a.title = t("noteLinkMissing");
      return;
    }
    a.classList.remove("missing");
    // [[名前|表示]] と [表示](foo.md) は書き手が表示を決めているので触らない。
    if (a.dataset.note && !a.dataset.labeled) a.textContent = note.title;
    a.title = name;
  });
}

// メモへのリンクが押されたときの処理。notes.ts を直接 import すると
// notes → view-modes → preview で循環するため、起動時に events.ts が配線する。
let noteLinkHandler: ((name: string) => void) | null = null;

export function setNoteLinkHandler(fn: (name: string) => void): void {
  noteLinkHandler = fn;
}

export const prefetchRenderer = (): void => void loadRenderer();

export function renderPreview(): void {
  const text = getDoc();
  // 前回の図の描画は非同期で走っているので、本文を入れ替える前に打ち切る。
  cancelDiagrams();
  if (text.trim() === "") {
    // 空メモをプレビューしたときに真っ白にならないようプレースホルダを表示。
    previewEl.innerHTML = `<p class="preview-empty">${t("emptyNote")}</p>`;
    refreshPreviewSearch();
    return;
  }
  if (!renderer) {
    // 未読み込みなら、読み込めた時点で最新の本文を描き直す。
    void loadRenderer().then(() => renderPreview());
    return;
  }
  previewEl.innerHTML = renderer(text);
  resolveLocalImages();
  markNoteLinks();
  renderDiagrams();
  // 本文を入れ替えると検索の Range は無効になるので、開いていれば引き直す。
  refreshPreviewSearch();
}

// プレビュー内のローカル画像を Tauri の asset URL に解決して表示できるようにする。
// 本文のパスは相対（image/...）とは限らず、プレフィックス設定を使っていれば
// 公開 URL の形（/images/...）で入っている。どちらもディスク上の絶対パスへ戻す。
// asset URL はパスを丸ごと 1 つの値として載せるため webview 側では畳まれない。
// .. の解決も percent-encode の復元もここで済ませてから渡す。
function resolveLocalImages(): void {
  const ws = state.workspace;
  if (!ws) return;
  const dir = resolveImageDir(ws, readImageDir(ws));
  const prefix = normalizeUrlPrefix(readImageUrlPrefix(ws) ?? "");
  previewEl.querySelectorAll("img").forEach((img) => {
    const raw = img.getAttribute("src") || "";
    if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(raw)) return;
    const abs = imageSrcPath(decodePath(raw), ws, dir, prefix).replace(/\\/g, "/");
    img.src = convertFileSrc(abs);
  });
}

// プレビュー内のリンククリック。previewEl は innerHTML を入れ替えるだけで
// 作り直さないので、ここで一度だけ登録すれば再描画後も効き続ける。
// リンクを踏むと webview 自体がそのページへ遷移してアプリが消えてしまうため、
// 外部 URL かどうかに関わらず既定動作は必ず止める。
// stopPropagation() はしない（document のクリックでメニューを閉じる処理を殺さない）。
previewEl.addEventListener("click", (e) => {
  // 図は本文幅に収めているので、クリックでズーム表示を開く。
  const diagram = (e.target as HTMLElement).closest<HTMLElement>(".mermaid-diagram");
  if (diagram?.dataset.svg) {
    openDiagramZoom(diagram.dataset.svg);
    return;
  }
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  // ワークスペース内の別のメモを指していれば、外部 URL の判定より先にこちらで開く。
  const note = noteNameOf(a);
  if (note) {
    noteLinkHandler?.(note);
    return;
  }
  // a.href は相対リンクを tauri://localhost/... に解決してしまうので生の値を見る。
  const url = externalUrl(a.getAttribute("href") ?? "");
  // 外部 URL だけ OS の既定アプリ（ブラウザ / メーラー）に渡す。
  // #見出し は今のところ何もしない。
  if (url) void withErrorNotice(t("openLinkFailed"), () => openUrl(url));
});
