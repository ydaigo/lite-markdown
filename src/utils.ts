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

// Mermaid のテーマ名。state.theme（light/dark）から素直に対応させる。
// 引数に Theme 型を使わないのは意図的。store.ts は読み込み時に window.matchMedia を
// 触るため node 環境のテストから import できず、ここが巻き込まれてしまう。
export const mermaidThemeName = (theme: string): "dark" | "default" =>
  theme === "dark" ? "dark" : "default";

// Mermaid の構文エラーは矢印付きの図解を含む複数行で届くため、
// 画面に添えるのは最初の 1 行だけにする。
export const diagramErrorLine = (e: unknown, limit = 120): string => {
  const msg = e instanceof Error ? e.message : String(e);
  const line =
    msg
      .split("\n")
      .find((l) => l.trim() !== "")
      ?.trim() ?? "";
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
};

// 挿入順で古いものから捨てる、上限付きのキャッシュ（Map は挿入順を保つ）。
// メモを渡り歩いても伸び続けないように上限を設ける。
// 並び直しは set のときだけで、get では動かさない（get に副作用を持たせない）。
export interface BoundedCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function boundedCache<T>(limit: number): BoundedCache<T> {
  const map = new Map<string, T>();
  return {
    get: (key) => map.get(key),
    set(key, value) {
      map.delete(key); // 再登録は「新しいもの」として並べ直す
      map.set(key, value);
      for (const oldest of map.keys()) {
        if (map.size <= limit) break;
        map.delete(oldest);
      }
    },
  };
}

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
