import { t } from "./i18n";

// ============================================================================
// メモのタイトル/抜粋の導出（純粋関数）
// ============================================================================
// Hugo などの front matter（--- か +++ で囲んだメタデータ）は本文ではないので飛ばす。
// 本文の開始行を返す。閉じ記号が見つからないときは開始記号の次から本文とみなす
// （全体をメタデータ扱いにしてタイトルを空にするより、1 行ずらすほうが実害が少ない）。
function bodyStart(lines: string[]): number {
  const fence = lines[0]?.trim();
  if (fence !== "---" && fence !== "+++") return 0;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === fence) return i + 1;
  }
  return 1;
}

// タイトルは最初の見出し行から採る。front matter や前置きが先にあっても、
// 一覧には書き手が付けた見出しが出るようにするため。
// 見出しが 1 つも無いメモは、これまで通り最初の行をタイトルにする。
export function deriveMeta(text: string): { title: string; snippet: string } {
  let first = ""; // 最初の非空行
  let second = ""; // 2 番目の非空行
  let heading = ""; // 最初の見出し行
  let headingIsFirst = false;
  const lines = text.split(/\r?\n/);
  for (let i = bodyStart(lines); i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 見出し記号とリストマーカーは飾りなので落とす。
    const body = trimmed.replace(/^#+\s*/, "").replace(/^[-*+]\s+/, "");
    if (!body) continue;
    const isHeading = trimmed.startsWith("#");
    if (!first) {
      first = body;
      headingIsFirst = isHeading;
      if (isHeading) heading = body;
    } else {
      if (!second) second = body;
      if (!heading && isHeading) heading = body;
    }
    if (heading && second) break;
  }
  // 抜粋はタイトルに使った行の次点。見出しが途中にあるときは、
  // タイトルに使われなかった先頭行をそのまま抜粋に回す。
  const snippet = heading && !headingIsFirst ? first : second;
  return { title: heading || first || t("newNote"), snippet };
}
