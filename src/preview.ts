import { marked } from "marked";
import DOMPurify from "dompurify";
import { convertFileSrc } from "@tauri-apps/api/core";
import { previewEl } from "./dom";
import { state } from "./store";
import { getDoc } from "./editor";
import { MSG } from "./constants";

// ============================================================================
// プレビュー（Markdown → HTML）
// ============================================================================
// Qiita 方式: 単一の改行も <br> として維持する。
marked.setOptions({ gfm: true, breaks: true });

export function renderPreview(): void {
  const text = getDoc();
  if (text.trim() === "") {
    // 空メモをプレビューしたときに真っ白にならないようプレースホルダを表示。
    previewEl.innerHTML = `<p class="preview-empty">${MSG.emptyNote}</p>`;
    return;
  }
  const html = marked.parse(text, { async: false }) as string;
  previewEl.innerHTML = DOMPurify.sanitize(html);
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
