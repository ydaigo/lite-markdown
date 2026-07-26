// ============================================================================
// 汎用の純粋関数ヘルパ
// ============================================================================

// 一覧に載せる Markdown ファイルか（ファイル名でもフルパスでも判定できる）。
export const isMarkdownPath = (p: string): boolean => /\.md$/i.test(p);

// プレビュー内リンクのうち、OS の既定アプリに渡してよい外部 URL だけを返す。
// 相対リンク（./other.md）や #見出し、javascript: などは対象外で null。
export const externalUrl = (href: string): string | null => {
  const url = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
};

// パス末尾のフォルダ/ファイル名を取り出す（Windows/Unix 両対応）。
export const baseName = (p: string): string =>
  p
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() || p;

// パスから親フォルダを取り出す（区切り文字は元の表記のまま）。
// ドライブ直下（C:\note.md）は "C:\" のように区切りを残す。
export const dirName = (p: string): string => {
  const s = p.replace(/[\\/]+$/, "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  if (i < 0) return s;
  const dir = s.slice(0, i);
  // ルート直下（/note.md, C:\note.md）は区切りまで含めて返す。
  return dir === "" || dir.endsWith(":") ? s.slice(0, i + 1) : dir;
};

// フォルダ配下のパスを組み立てる。@tauri-apps/api の join は 1 回ごとに
// Rust への呼び出しが発生するため、件数が増える場面ではこちらを使う。
// 区切り文字はフォルダ側の表記に合わせる（Windows なら "\"）。
export const joinPath = (dir: string, name: string): string => {
  const base = dir.replace(/[\\/]+$/, "");
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}${name}`;
};
