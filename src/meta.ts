import { t } from "./i18n";

// ============================================================================
// メモのタイトル/抜粋の導出（純粋関数）
// ============================================================================

// Hugo などの front matter（--- か +++ で囲んだメタデータ）を読む。
// 本文の開始行と、書かれていれば title の値を返す。閉じ記号が見つからないときは
// 開始記号の次から本文とみなす（全体をメタデータ扱いにしてタイトルを空にするより、
// 1 行ずらすほうが実害が少ない）。この場合はメタデータではないので title も返さない。
function readFrontMatter(lines: string[]): { start: number; title: string } {
  const fence = lines[0]?.trim();
  if (fence !== "---" && fence !== "+++") return { start: 0, title: "" };
  const end = closingFenceLine(lines, fence);
  if (end < 0) return { start: 1, title: "" };
  let title = "";
  for (let i = 1; i < end && title === ""; i++) {
    // 行頭固定にして最上位のキーだけを拾う（params: の下などの入れ子の title は無視）。
    // YAML の `title: x` と TOML の `title = x` を同じ形で受ける。
    const m = /^title\s*[:=]\s*(.+)$/.exec(lines[i]);
    // 値を囲む引用符は飾りなので外す。
    if (m)
      title = m[1]
        .trim()
        .replace(/^(["'])(.*)\1$/s, "$2")
        .trim();
  }
  return { start: end + 1, title };
}

// front matter を閉じている行の番号。囲みが成立していなければ -1。
function closingFenceLine(lines: string[], fence: string): number {
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === fence) return i;
  return -1;
}

// front matter を落として本文だけを返す。プレビューにそのまま流すと、閉じ記号の
// --- が直前の行に対する setext 見出しとして解釈され、メタデータ全体が巨大な見出しに
// なってしまうため。囲みが成立していないものは front matter ではないと見てそのまま返す
// （deriveMeta は 1 行ずらすが、こちらは消してしまうと本文が丸ごと消えかねない）。
export function stripFrontMatter(text: string): string {
  const lines = text.split(/\r?\n/);
  const fence = lines[0]?.trim();
  if (fence !== "---" && fence !== "+++") return text;
  const end = closingFenceLine(lines, fence);
  return end < 0 ? text : lines.slice(end + 1).join("\n");
}

// 手つかずのメモか（本文が空で、front matter にも title が書かれていない）。
// front matter の雛形を入れる設定では新規メモが空文字にならないため、「空メモは
// 作り直さない / 破棄する」の判定を素の空文字比較ではなくこれで行う。
// 雛形のまま放置したものは捨てるが、title を書いていれば書きかけとして残す。
export function isBlankNote(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const fm = readFrontMatter(lines);
  return fm.title === "" && lines.slice(fm.start).join("\n").trim() === "";
}

// タイトルは front matter の title、無ければ本文の最初の見出し行から採る。
// メタデータや前置きが先にあっても、一覧には書き手が付けた名前が出るようにするため。
// どちらも無いメモは、これまで通り最初の行をタイトルにする。
export function deriveMeta(text: string): { title: string; snippet: string } {
  const lines = text.split(/\r?\n/);
  const fm = readFrontMatter(lines);

  let first = ""; // 本文の最初の非空行
  let second = ""; // 本文の 2 番目の非空行
  let heading = ""; // 本文の最初の見出し行
  for (let i = fm.start; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 見出し記号とリストマーカーは飾りなので落とす。
    const body = trimmed.replace(/^#+\s*/, "").replace(/^[-*+]\s+/, "");
    if (!body) continue;
    if (!heading && trimmed.startsWith("#")) heading = body;
    if (!first) first = body;
    else if (!second) second = body;
    if (heading && second) break;
  }

  const title = fm.title || heading || first || t("newNote");
  // 抜粋はタイトルに使わなかった先頭の行。同じ文字列が 2 行並ぶと情報が増えないので、
  // タイトルと一致する行は飛ばす（front matter の title を本文の見出しでも書いている、
  // 見出しが前置きの後ろにある、といった場合に効く）。
  const snippet = [first, second].find((line) => line && line !== title) ?? "";
  return { title, snippet };
}
