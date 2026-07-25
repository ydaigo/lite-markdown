// ============================================================================
// 汎用の純粋関数ヘルパ
// ============================================================================

// パス末尾のフォルダ/ファイル名を取り出す（Windows/Unix 両対応）。
export const baseName = (p: string): string =>
  p
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() || p;

// フォルダ配下のパスを組み立てる。@tauri-apps/api の join は 1 回ごとに
// Rust への呼び出しが発生するため、件数が増える場面ではこちらを使う。
// 区切り文字はフォルダ側の表記に合わせる（Windows なら "\"）。
export const joinPath = (dir: string, name: string): string => {
  const base = dir.replace(/[\\/]+$/, "");
  const sep = base.includes("\\") ? "\\" : "/";
  return `${base}${sep}${name}`;
};
