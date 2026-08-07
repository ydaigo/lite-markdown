import { IMAGE_DIR, PREVIEW_WIDTH } from "./constants";

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

// プレビュー本文の幅を、読める下限と入れ物の実幅の間へ収める。
// 上限を CSS の max-width だけに任せると「入れ物より広い保存値」が作れてしまい、
// 戻す向きへドラッグしても見た目が動かない不感帯ができるので、保存する値も同じ
// ところで止める。入れ物が下限より狭いときは下限を返す（上限と下限が反転しない）。
export const clampPreviewWidth = (px: number, available: number): number => {
  const max = Math.max(PREVIEW_WIDTH.min, available - PREVIEW_WIDTH.gutter * 2);
  return Math.min(Math.max(px, PREVIEW_WIDTH.min), max);
};

// 絶対パス base から相対パス rel をたどった先を、.. を畳んで 1 本の絶対パスにする。
// 区切り文字は base の表記に合わせる（Windows なら "\"）。
// .. を残したまま OS やプラグインへ渡すと、権限の判定や asset URL の解決が
// 実装依存になるため、こちら側で畳んでから渡す。ルートより上へは出さない。
export const resolvePath = (base: string, rel: string): string => {
  const sep = base.includes("\\") ? "\\" : "/";
  const parts = base.replace(/[\\/]+$/, "").split(/[\\/]/);
  for (const seg of rel.split(/[\\/]/)) {
    const s = seg.trim();
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (parts.length > 1) parts.pop();
      continue;
    }
    parts.push(s);
  }
  return parts.join(sep);
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

// Hugo の date に書く RFC3339 の文字列。ローカル時刻とその UTC オフセットで書く
// （archetype が出す形と揃える）。toISOString() は UTC に寄せてしまい、深夜に書いた
// 記事の日付が前日になることがあるため使わない。
export const rfc3339Local = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, "0");
  const offset = -d.getTimezoneOffset(); // 分。日本なら +540
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const time = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  return `${date}T${time}${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
};

// path が base の中（または base そのもの）かを見る。ホームフォルダの外を
// 指していないかの確認に使う。Windows のパスは大文字小文字を区別しないので、
// ドライブ指定があるときだけ畳んでから比べる（手入力で users/Users がずれる）。
export const isUnder = (base: string, path: string): boolean => {
  const norm = (p: string): string => {
    const s = p.replace(/\\/g, "/").replace(/\/+$/, "");
    return /^[a-z]:/i.test(s) ? s.toLowerCase() : s;
  };
  const b = norm(base);
  const p = norm(path);
  return b !== "" && (p === b || p.startsWith(`${b}/`));
};

// ============================================================================
// 画像の保存先と、本文に書く画像パス
// ============================================================================
// 設定は 2 つある。
//   保存先(imageDir)    … 画像ファイルを実際に書き込む絶対パス。
//   プレフィックス(prefix) … 本文に書くパスの頭。空なら相対パスを計算する。
// 2 つに分かれているのは、ディスク上の位置と公開後の URL がずれる構成があるため。
// Hugo は static/ の中身をサイトルートへ配るので、ディスクが static/images でも
// 公開 URL は /images になる。相対パスを書くとアプリのプレビューでは映るが、
// ビルドしたサイトでは 404 になってしまう。

// 保存先として受け付けるのは絶対パスだけ。区切りは "/" に揃えて持つ（Windows の
// "\" 入力も C:/Users/me/images の形に直す）。Tauri は Windows でも "/" 区切りを
// 受け付け、asset URL も "/" に直してから渡しているため、"/" 1 本に寄せておくと
// 比較も相対パス計算も分岐せずに済む。ドライブ文字は大文字に揃える。
// 相対パス・ルート直下・ファイル名に使えない文字は "" を返し、呼び出し側が既定へ倒す。
export const normalizeImageDir = (input: string): string => {
  const path = input.trim().replace(/\\/g, "/");
  const drive = /^[a-z]:/i.exec(path)?.[0] ?? "";
  const rest = path.slice(drive.length);
  if (!rest.startsWith("/")) return "";
  if (/[:*?"<>|]/.test(rest)) return "";
  const parts: string[] = [];
  for (const seg of rest.split("/")) {
    const s = seg.trim();
    if (s === "" || s === ".") continue;
    if (s === "..")
      parts.pop(); // ルートより上へは出さない
    else parts.push(s);
  }
  // ルート自身（"/" や "C:/"）は保存先として意味を成さないので受け付けない。
  return parts.length ? `${drive.toUpperCase()}/${parts.join("/")}` : "";
};

// 本文に書くパスの頭。"/images" のようなサイト内パスでも "https://cdn/img" のような
// URL でも通す。末尾の "/" は落とし、重なった "/" は 1 本に畳む（スキームの // は残す）。
export const normalizeUrlPrefix = (input: string): string => {
  const raw = input.trim().replace(/\\/g, "/");
  const scheme = /^[a-z][a-z\d+.-]*:\/\//i.exec(raw)?.[0] ?? "";
  const rest = raw.slice(scheme.length).replace(/\/{2,}/g, "/");
  const trimmed = rest.replace(/\/+$/, "");
  // "/" だけの指定はサイトルート直下の意味なので "/" として残す。
  return scheme + (trimmed || (rest === "" ? "" : "/"));
};

// ワークスペースの画像保存先（絶対パス）。未設定ならワークスペース直下の IMAGE_DIR。
// v0.2.7 まではワークスペースからの相対パスで保存していたため、相対のまま入っている
// 値はワークスペース基準で解決してから絶対として扱う（設定し直さずに済む）。
export const resolveImageDir = (workspace: string, saved?: string): string => {
  const abs = saved
    ? normalizeImageDir(saved) || normalizeImageDir(resolvePath(workspace, saved))
    : "";
  return abs || normalizeImageDir(joinPath(workspace, IMAGE_DIR));
};

// 絶対パス from から to へたどる相対パスを返す。同じ場所なら ""。
// 別ドライブ（C: から D:）は相対では表せないので null。
export const relativePath = (from: string, to: string): string | null => {
  const split = (p: string): string[] => p.replace(/\\/g, "/").split("/").filter(Boolean);
  const a = split(from);
  const b = split(to);
  const driveOf = (parts: string[]): string =>
    /^[a-z]:$/i.test(parts[0] ?? "") ? (parts[0] as string).toLowerCase() : "";
  if (driveOf(a) !== driveOf(b)) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/");
};

// Markdown に載せるためのエスケープ。区切り以外を percent-encode するので、
// 空白を含むフォルダ名（~/My Notes/images）でもリンクが切れない。
export const encodePath = (path: string): string =>
  path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");

// encodePath の逆。エンコードされていない古い本文もそのまま通す。
export const decodePath = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    // "100%達成" のように % の後ろが 16 進 2 桁でないと URIError になる。
    return path;
  }
};

// 本文に書く画像パスを組み立てる。プレフィックスがあればそれを頭に付けるだけ
// （公開 URL は利用者が決めるので、こちらでは encode も加工もしない）。
// 空ならワークスペースからディスク上の相対パスを計算する。
export const imageLinkPath = (
  workspace: string,
  dir: string,
  name: string,
  prefix: string,
): string => {
  if (prefix) return prefix.endsWith("/") ? `${prefix}${name}` : `${prefix}/${name}`;
  const rel = relativePath(workspace, dir);
  if (rel !== null) return encodePath(rel === "" ? name : `${rel}/${name}`);
  // Windows でワークスペースと保存先が別ドライブのときだけここへ来る。相対では
  // 戻れないので絶対パスで書く（そのマシンでだけ映る）。ドライブ指定の ":" は
  // encode すると保存先が読み取れなくなるため、残りの部分だけを encode する。
  const drive = /^[a-z]:/i.exec(dir)?.[0] ?? "";
  return drive + encodePath(`${dir.slice(drive.length)}/${name}`);
};

// imageLinkPath の逆。本文の画像パスからディスク上の絶対パスを求める（プレビュー用）。
// プレフィックスで始まっていれば保存先へ、そうでなければワークスペース基準で解決する。
export const imageSrcPath = (
  src: string,
  workspace: string,
  dir: string,
  prefix: string,
): string => {
  const head = prefix.endsWith("/") ? prefix : `${prefix}/`;
  if (prefix !== "" && src.startsWith(head)) return resolvePath(dir, src.slice(head.length));
  // ドライブ指定付き（D:/img/a.png）は別ドライブの保存先を絶対で書いたもの。
  // 先頭が "/" だけのものは対象にしない（プレフィックス無しで手書きされたサイト内
  // パスをワークスペース基準として扱う、これまでの解釈を変えないため）。
  if (/^[a-z]:/i.test(src)) return src;
  return resolvePath(workspace, src);
};
