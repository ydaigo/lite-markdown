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

// [[メモ名]] の中身を、ワークスペース内のファイル名へ正規化する。
// メモはワークスペース直下のフラット構成なので、区切りを含むもの（サブフォルダ・親）は
// 受け付けない。拡張子が無ければ .md を補う。開けない書き方は null（リンクにしない）。
export const noteFileName = (target: string): string | null => {
  // 末尾の #断片 は落とす（見出しへのアンカーは今のところ扱わない）。
  const name = target.trim().replace(/^\.\//, "").replace(/#.*$/, "").trim();
  if (name === "" || name === "." || name === "..") return null;
  if (/[\\/]/.test(name)) return null;
  return isMarkdownPath(name) ? name : `${name}.md`;
};

// 標準の相対リンク（[text](foo.md)）の href が、同じフォルダの .md を指していれば
// そのファイル名を返す。marked は href を encodeURI して出すのでデコードしてから見る。
export const relativeNoteName = (href: string): string | null => {
  const raw = href.trim();
  if (raw === "" || raw.startsWith("#") || externalUrl(raw) !== null) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // "100%達成.md" のように % の後ろが 16 進 2 桁でないと URIError になる。
    // エンコードされていなかっただけなので、生の文字列で続ける。
    decoded = raw;
  }
  // クエリと断片を落としてから .md かどうかを見る（image/img-1.png を横取りしない）。
  const path = decoded.replace(/[?#].*$/, "");
  return isMarkdownPath(path) ? noteFileName(path) : null;
};

// HTML の属性値・本文へ差し込む文字列のエスケープ。
export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

// 大文字小文字を無視して比べるための畳み込み。文字ごとに変換し、長さが変わる文字
// （"İ".toLowerCase() は 2 文字になる）は元のまま残す。プレビュー内検索は変換後の
// 位置をそのまま元の文字列の位置として使うため、長さが動くと対応が崩れる。
const foldCase = (s: string): string =>
  Array.from(s, (ch) => {
    const lower = ch.toLowerCase();
    return lower.length === ch.length ? lower : ch;
  }).join("");

// haystack に needle が現れる位置（先頭の添字）をすべて返す。大文字小文字は区別
// しない。重なりは数えず見つけた長さだけ進める（"aaa" の中の "aa" は 1 件）。
export function matchOffsets(haystack: string, needle: string): number[] {
  if (needle === "") return [];
  const hay = foldCase(haystack);
  const pin = foldCase(needle);
  const out: number[] = [];
  for (let i = hay.indexOf(pin); i >= 0; i = hay.indexOf(pin, i + pin.length)) out.push(i);
  return out;
}

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
