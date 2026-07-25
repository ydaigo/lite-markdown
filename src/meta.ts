import { t } from "./i18n";

// ============================================================================
// メモのタイトル/抜粋の導出（純粋関数）
// ============================================================================
export function deriveMeta(text: string): { title: string; snippet: string } {
  const lines = text.split(/\r?\n/);
  let title = "";
  let snippet = "";
  for (const line of lines) {
    const t = line
      .trim()
      .replace(/^#+\s*/, "")
      .replace(/^[-*+]\s+/, "");
    if (!t) continue;
    if (!title) title = t;
    else {
      snippet = t;
      break;
    }
  }
  return { title: title || t("newNote"), snippet };
}
