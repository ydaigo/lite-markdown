import { t } from "./i18n";

// ============================================================================
// メモのタイトル/抜粋の導出（純粋関数）
// ============================================================================
export function deriveMeta(text: string): { title: string; snippet: string } {
  let title = "";
  let snippet = "";
  for (const line of text.split(/\r?\n/)) {
    // 見出し記号とリストマーカーは飾りなので落とす。
    const body = line
      .trim()
      .replace(/^#+\s*/, "")
      .replace(/^[-*+]\s+/, "");
    if (!body) continue;
    if (!title) title = body;
    else {
      snippet = body;
      break;
    }
  }
  return { title: title || t("newNote"), snippet };
}
