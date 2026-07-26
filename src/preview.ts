import { convertFileSrc } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { previewEl } from "./dom";
import { state } from "./store";
import { getDoc } from "./editor";
import { withErrorNotice } from "./errors";
import { externalUrl } from "./utils";
import { t } from "./i18n";

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
      marked.setOptions({ gfm: true, breaks: true });
      renderer = (text) => DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
      return renderer;
    },
  );
  return loading;
}

export const prefetchRenderer = (): void => void loadRenderer();

export function renderPreview(): void {
  const text = getDoc();
  if (text.trim() === "") {
    // 空メモをプレビューしたときに真っ白にならないようプレースホルダを表示。
    previewEl.innerHTML = `<p class="preview-empty">${t("emptyNote")}</p>`;
    return;
  }
  if (!renderer) {
    // 未読み込みなら、読み込めた時点で最新の本文を描き直す。
    void loadRenderer().then(() => renderPreview());
    return;
  }
  previewEl.innerHTML = renderer(text);
  resolveLocalImages();
}

// プレビュー内のローカル画像（image/... の相対パス）を
// Tauri の asset URL に解決して表示できるようにする。
function resolveLocalImages(): void {
  if (!state.workspace) return;
  previewEl.querySelectorAll("img").forEach((img) => {
    const raw = img.getAttribute("src") || "";
    if (/^(https?:|data:|blob:|asset:|tauri:)/i.test(raw)) return;
    const abs = `${state.workspace}/${raw}`.replace(/\\/g, "/");
    img.src = convertFileSrc(abs);
  });
}

// プレビュー内のリンククリック。previewEl は innerHTML を入れ替えるだけで
// 作り直さないので、ここで一度だけ登録すれば再描画後も効き続ける。
// リンクを踏むと webview 自体がそのページへ遷移してアプリが消えてしまうため、
// 外部 URL かどうかに関わらず既定動作は必ず止める。
// stopPropagation() はしない（document のクリックでメニューを閉じる処理を殺さない）。
previewEl.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest("a");
  if (!a) return;
  e.preventDefault();
  // a.href は相対リンクを tauri://localhost/... に解決してしまうので生の値を見る。
  const url = externalUrl(a.getAttribute("href") ?? "");
  // 外部 URL だけ OS の既定アプリ（ブラウザ / メーラー）に渡す。
  // 相対リンクや #見出し は今のところ何もしない。
  if (url) void withErrorNotice(t("openLinkFailed"), () => openUrl(url));
});
