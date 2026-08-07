import { describe, it, expect } from "vitest";
import {
  baseName,
  boundedCache,
  clampPreviewWidth,
  decodePath,
  diagramErrorLine,
  dirName,
  encodePath,
  escapeHtml,
  externalUrl,
  imageLinkPath,
  imageSrcPath,
  isMarkdownPath,
  isUnder,
  joinPath,
  matchOffsets,
  mermaidThemeName,
  normalizeImageDir,
  normalizeUrlPrefix,
  noteFileName,
  relativeNoteName,
  relativePath,
  rfc3339Local,
  resolveImageDir,
  resolvePath,
} from "./utils";

describe("isMarkdownPath", () => {
  it("拡張子 .md を大文字小文字を問わず判定する", () => {
    expect(isMarkdownPath("note.md")).toBe(true);
    expect(isMarkdownPath("C:\\Users\\daigo\\notes\\note.MD")).toBe(true);
  });

  it("他の拡張子は対象外", () => {
    expect(isMarkdownPath("image/img-1.png")).toBe(false);
    expect(isMarkdownPath("note.markdown")).toBe(false);
    expect(isMarkdownPath("note.md.bak")).toBe(false);
    expect(isMarkdownPath("notes")).toBe(false);
  });
});

describe("baseName", () => {
  it("Unix パスの末尾要素を返す", () => {
    expect(baseName("/home/user/notes")).toBe("notes");
  });

  it("Windows パスの末尾要素を返す", () => {
    expect(baseName("C:\\Users\\daigo\\notes")).toBe("notes");
  });

  it("末尾の区切り文字を無視する", () => {
    expect(baseName("/home/user/notes/")).toBe("notes");
    expect(baseName("C:\\Users\\daigo\\notes\\")).toBe("notes");
  });

  it("区切りが無ければそのまま返す", () => {
    expect(baseName("notes")).toBe("notes");
  });

  it("混在した区切りにも対応する", () => {
    expect(baseName("C:/Users\\daigo/notes")).toBe("notes");
  });
});

describe("dirName", () => {
  it("親フォルダを返す（区切り文字は元の表記のまま）", () => {
    expect(dirName("/home/user/notes/a.md")).toBe("/home/user/notes");
    expect(dirName("C:\\Users\\daigo\\notes\\a.md")).toBe("C:\\Users\\daigo\\notes");
  });

  it("ルート直下は区切りを残す", () => {
    expect(dirName("/a.md")).toBe("/");
    expect(dirName("C:\\a.md")).toBe("C:\\");
  });

  it("区切りが無ければそのまま返す", () => {
    expect(dirName("a.md")).toBe("a.md");
  });
});

describe("joinPath", () => {
  it("フォルダ側の区切り文字に合わせて連結する", () => {
    expect(joinPath("/home/user/notes", "a.md")).toBe("/home/user/notes/a.md");
    expect(joinPath("C:\\Users\\daigo\\notes", "a.md")).toBe("C:\\Users\\daigo\\notes\\a.md");
  });

  it("末尾の区切り文字が重複しない", () => {
    expect(joinPath("/home/user/notes/", "a.md")).toBe("/home/user/notes/a.md");
    expect(joinPath("C:\\Users\\daigo\\notes\\", "a.md")).toBe("C:\\Users\\daigo\\notes\\a.md");
  });

  it("dirName で戻したパスと往復できる", () => {
    const p = "C:\\Users\\daigo\\notes\\a.md";
    expect(joinPath(dirName(p), baseName(p))).toBe(p);
  });
});

describe("externalUrl", () => {
  it("http / https / mailto はそのまま返す", () => {
    expect(externalUrl("https://example.com")).toBe("https://example.com");
    expect(externalUrl("http://example.com/a?b=1#c")).toBe("http://example.com/a?b=1#c");
    expect(externalUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
  });

  it("スキームの大文字小文字は問わない", () => {
    expect(externalUrl("HTTPS://EXAMPLE.COM")).toBe("HTTPS://EXAMPLE.COM");
  });

  it("前後の空白は落とす", () => {
    expect(externalUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("外部 URL でないものは null", () => {
    expect(externalUrl("./other.md")).toBe(null);
    expect(externalUrl("other.md")).toBe(null);
    expect(externalUrl("/abs/path.md")).toBe(null);
    expect(externalUrl("#見出し")).toBe(null);
    expect(externalUrl("javascript:alert(1)")).toBe(null);
    expect(externalUrl("")).toBe(null);
  });
});

describe("mermaidThemeName", () => {
  it("dark はそのまま、それ以外は default", () => {
    expect(mermaidThemeName("dark")).toBe("dark");
    expect(mermaidThemeName("light")).toBe("default");
  });
});

describe("diagramErrorLine", () => {
  it("最初の空でない行だけを返す", () => {
    const e = new Error("\nParse error on line 2:\ngraph TD  A --<> B\n---------^");
    expect(diagramErrorLine(e)).toBe("Parse error on line 2:");
  });

  it("長い行は切り詰める", () => {
    expect(diagramErrorLine(new Error("a".repeat(200)), 10)).toBe(`${"a".repeat(10)}…`);
  });

  it("Error 以外も文字列として扱う", () => {
    expect(diagramErrorLine("こわれています")).toBe("こわれています");
    expect(diagramErrorLine(undefined)).toBe("undefined");
  });
});

describe("boundedCache", () => {
  it("入れた値を引ける", () => {
    const c = boundedCache<number>(2);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBe(undefined);
  });

  it("上限を超えたら古いものから捨てる", () => {
    const c = boundedCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.get("a")).toBe(undefined);
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("同じキーの再登録では件数が増えず、新しいものとして扱われる", () => {
    const c = boundedCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 9); // a が最新になるので、次に押し出されるのは b
    c.set("c", 3);
    expect(c.get("a")).toBe(9);
    expect(c.get("b")).toBe(undefined);
    expect(c.get("c")).toBe(3);
  });
});

describe("matchOffsets", () => {
  it("現れた位置をすべて返す", () => {
    expect(matchOffsets("abcabc", "bc")).toEqual([1, 4]);
  });

  it("大文字小文字を区別しない", () => {
    expect(matchOffsets("Markdown MARKDOWN markdown", "markdown")).toEqual([0, 9, 18]);
  });

  it("重なりは数えず、見つけた長さだけ進める", () => {
    expect(matchOffsets("aaaa", "aa")).toEqual([0, 2]);
  });

  it("空の検索語は 0 件", () => {
    expect(matchOffsets("abc", "")).toEqual([]);
  });

  it("見つからなければ 0 件", () => {
    expect(matchOffsets("abc", "xyz")).toEqual([]);
  });

  it("日本語も位置で返す", () => {
    expect(matchOffsets("メモを検索するメモ", "メモ")).toEqual([0, 7]);
  });

  it("小文字化で長さが変わる文字があっても位置がずれない", () => {
    // "İ".toLowerCase() は 2 文字になるため、そのまま畳み込むと以降がずれる。
    const text = `Aİ${"B"}`;
    expect(matchOffsets(text, "b")).toEqual([2]);
  });

  it("サロゲートペアを含んでも元の文字列の位置で返す", () => {
    expect(matchOffsets("🙂abc", "abc")).toEqual([2]);
  });
});

describe("noteFileName", () => {
  it("拡張子が無ければ .md を補う", () => {
    expect(noteFileName("note-1784965179337")).toBe("note-1784965179337.md");
  });

  it("日本語のファイル名も扱える", () => {
    expect(noteFileName("20260727-ネットワーク経路の使い分け")).toBe(
      "20260727-ネットワーク経路の使い分け.md",
    );
  });

  it("すでに .md なら二重に付けない（大小問わず）", () => {
    expect(noteFileName("foo.md")).toBe("foo.md");
    expect(noteFileName("foo.MD")).toBe("foo.MD");
  });

  it("末尾以外のドットは拡張子として扱わない", () => {
    expect(noteFileName("v1.2 の設計")).toBe("v1.2 の設計.md");
  });

  it("先頭の ./ と前後の空白は落とす", () => {
    expect(noteFileName("./foo")).toBe("foo.md");
    expect(noteFileName("  foo  ")).toBe("foo.md");
  });

  it("末尾の #断片 は落とす", () => {
    expect(noteFileName("foo#見出し")).toBe("foo.md");
    expect(noteFileName("foo.md#見出し")).toBe("foo.md");
  });

  it("区切りを含むもの・親・空は null（フラット構成なので開けない）", () => {
    expect(noteFileName("../foo")).toBe(null);
    expect(noteFileName("sub/foo")).toBe(null);
    expect(noteFileName("/abs/foo")).toBe(null);
    expect(noteFileName("C:\\foo")).toBe(null);
    expect(noteFileName("..")).toBe(null);
    expect(noteFileName(".")).toBe(null);
    expect(noteFileName("")).toBe(null);
    expect(noteFileName("   ")).toBe(null);
    expect(noteFileName("#見出し")).toBe(null);
  });
});

describe("relativeNoteName", () => {
  it("同じフォルダの .md ならファイル名を返す", () => {
    expect(relativeNoteName("foo.md")).toBe("foo.md");
    expect(relativeNoteName("./foo.md")).toBe("foo.md");
  });

  it("marked が encodeURI した href をデコードする", () => {
    expect(relativeNoteName("%E3%83%8D%E3%83%83%E3%83%88.md")).toBe("ネット.md");
  });

  it("不正なパーセントがあっても例外にせず生の文字列で扱う", () => {
    expect(relativeNoteName("100%達成.md")).toBe("100%達成.md");
  });

  it("クエリと断片は落とす", () => {
    expect(relativeNoteName("foo.md?x=1#h")).toBe("foo.md");
  });

  it("外部 URL・#見出し・.md 以外・サブフォルダは null", () => {
    expect(relativeNoteName("https://example.com/a.md")).toBe(null);
    expect(relativeNoteName("mailto:test@example.com")).toBe(null);
    expect(relativeNoteName("#見出し")).toBe(null);
    expect(relativeNoteName("image/img-1.png")).toBe(null);
    expect(relativeNoteName("../other/foo.md")).toBe(null);
    expect(relativeNoteName("")).toBe(null);
  });
});

describe("escapeHtml", () => {
  it("HTML で意味を持つ 5 文字を実体参照にする", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("複合しても & を二重にエスケープしない", () => {
    expect(escapeHtml('a & <b "c">')).toBe("a &amp; &lt;b &quot;c&quot;&gt;");
  });

  it("日本語はそのまま", () => {
    expect(escapeHtml("メモ 20260727")).toBe("メモ 20260727");
  });
});

describe("clampPreviewWidth", () => {
  it("下限より狭い値は下限に丸める", () => {
    expect(clampPreviewWidth(100, 1200)).toBe(360);
    expect(clampPreviewWidth(0, 1200)).toBe(360);
    expect(clampPreviewWidth(-500, 1200)).toBe(360);
  });

  it("入れ物より広い値は、つまみの余白を残した幅で止まる", () => {
    expect(clampPreviewWidth(2000, 1200)).toBe(1176); // 1200 - 12 * 2
  });

  it("下限と上限の間はそのまま返す", () => {
    expect(clampPreviewWidth(900, 1200)).toBe(900);
  });

  it("入れ物が下限より狭くても下限を返す（上限と下限が反転しない）", () => {
    expect(clampPreviewWidth(800, 200)).toBe(360);
    expect(clampPreviewWidth(100, 200)).toBe(360);
  });
});

describe("normalizeImageDir", () => {
  it("そのまま使える絶対パスは変えない", () => {
    expect(normalizeImageDir("/Users/me/notes/image")).toBe("/Users/me/notes/image");
  });

  it("Windows のパスは区切りを / に、ドライブ文字を大文字に揃える", () => {
    expect(normalizeImageDir("C:\\Users\\me\\blog\\static\\images")).toBe(
      "C:/Users/me/blog/static/images",
    );
    expect(normalizeImageDir("d:/notes/img")).toBe("D:/notes/img");
  });

  it("前後の空白・余分な区切り・./ を落とす", () => {
    expect(normalizeImageDir("  /Users/me/img  ")).toBe("/Users/me/img");
    expect(normalizeImageDir("/Users//me/./img/")).toBe("/Users/me/img");
  });

  it(".. は畳む（ルートより上へは出ない）", () => {
    expect(normalizeImageDir("/Users/me/blog/content/../../img")).toBe("/Users/me/img");
    expect(normalizeImageDir("/../../img")).toBe("/img");
  });

  it("相対パスは受け付けない（保存先は絶対パスで持つ）", () => {
    expect(normalizeImageDir("image")).toBe("");
    expect(normalizeImageDir("../static/images")).toBe("");
    expect(normalizeImageDir("static\\images")).toBe("");
  });

  it("空入力とルート自身は既定に倒すための空文字", () => {
    expect(normalizeImageDir("")).toBe("");
    expect(normalizeImageDir("   ")).toBe("");
    expect(normalizeImageDir("/")).toBe("");
    expect(normalizeImageDir("C:\\")).toBe("");
  });

  it("ファイル名に使えない文字を含む指定は受け付けない", () => {
    expect(normalizeImageDir("/Users/me/img*es")).toBe("");
    expect(normalizeImageDir('/Users/me/a"b')).toBe("");
    expect(normalizeImageDir("/Users/me/a|b")).toBe("");
    // ドライブ指定以外の ":" も弾く。
    expect(normalizeImageDir("/Users/me/a:b")).toBe("");
  });
});

describe("normalizeUrlPrefix", () => {
  it("末尾の / を落とし、重なった / を畳む", () => {
    expect(normalizeUrlPrefix("/images/")).toBe("/images");
    expect(normalizeUrlPrefix("//images//sub///")).toBe("/images/sub");
  });

  it("スキームの // は残す", () => {
    expect(normalizeUrlPrefix("https://cdn.example.com/img/")).toBe("https://cdn.example.com/img");
  });

  it("Windows の区切りで入力しても / に揃える", () => {
    expect(normalizeUrlPrefix("\\images")).toBe("/images");
  });

  it("空なら空（本文には相対パスを書く）", () => {
    expect(normalizeUrlPrefix("")).toBe("");
    expect(normalizeUrlPrefix("   ")).toBe("");
  });

  it("/ だけの指定はサイトルート直下として残す", () => {
    expect(normalizeUrlPrefix("/")).toBe("/");
  });
});

describe("resolveImageDir", () => {
  it("未設定ならワークスペース直下の image", () => {
    expect(resolveImageDir("/Users/me/notes")).toBe("/Users/me/notes/image");
    expect(resolveImageDir("C:\\Users\\me\\notes")).toBe("C:/Users/me/notes/image");
  });

  it("絶対パスが保存されていればそれを使う", () => {
    expect(resolveImageDir("/Users/me/notes", "/Users/me/blog/static/images")).toBe(
      "/Users/me/blog/static/images",
    );
  });

  it("v0.2.7 までの相対パスはワークスペース基準で絶対に直す", () => {
    expect(resolveImageDir("/Users/me/blog/content/posts", "../../static/images")).toBe(
      "/Users/me/blog/static/images",
    );
    expect(resolveImageDir("/Users/me/notes", "assets")).toBe("/Users/me/notes/assets");
  });

  it("読めない値なら既定へ倒す", () => {
    expect(resolveImageDir("/Users/me/notes", "a|b")).toBe("/Users/me/notes/image");
  });
});

describe("relativePath", () => {
  it("配下なら残りの部分だけを返す", () => {
    expect(relativePath("/Users/me/notes", "/Users/me/notes/image")).toBe("image");
  });

  it("外へ出るときは .. でたどる", () => {
    expect(relativePath("/Users/me/blog/content/posts", "/Users/me/blog/static/images")).toBe(
      "../../static/images",
    );
  });

  it("同じ場所なら空文字", () => {
    expect(relativePath("/Users/me/notes", "/Users/me/notes/")).toBe("");
  });

  it("Windows の表記も混在させて扱える", () => {
    expect(relativePath("C:\\Users\\me\\notes", "C:/Users/me/notes/image")).toBe("image");
  });

  it("別ドライブへは相対で戻れないので null", () => {
    expect(relativePath("C:/Users/me/notes", "D:/img")).toBeNull();
  });
});

describe("encodePath / decodePath", () => {
  it("区切り以外を percent-encode する（空白を含むフォルダ名で切れない）", () => {
    expect(encodePath("../My Notes/images/img-1.png")).toBe("../My%20Notes/images/img-1.png");
  });

  it("decodePath は encodePath を元に戻す", () => {
    expect(decodePath(encodePath("../My Notes/画像/img-1.png"))).toBe("../My Notes/画像/img-1.png");
  });

  it("エンコードされていない本文もそのまま通す", () => {
    expect(decodePath("image/100%達成.png")).toBe("image/100%達成.png");
  });
});

describe("imageLinkPath", () => {
  const ws = "/Users/me/notes";

  it("プレフィックスが無ければワークスペースからの相対パス", () => {
    expect(imageLinkPath(ws, "/Users/me/notes/image", "img-1.png", "")).toBe("image/img-1.png");
  });

  it("保存先がワークスペース自身ならファイル名だけ", () => {
    expect(imageLinkPath(ws, ws, "img-1.png", "")).toBe("img-1.png");
  });

  it("外のフォルダなら .. でたどる", () => {
    expect(
      imageLinkPath(
        "/Users/me/blog/content/posts",
        "/Users/me/blog/static/images",
        "img-1.png",
        "",
      ),
    ).toBe("../../static/images/img-1.png");
  });

  it("プレフィックスがあれば公開 URL の形で書く（Hugo の static/ 構成）", () => {
    expect(
      imageLinkPath(
        "/Users/me/blog/content/posts",
        "/Users/me/blog/static/images",
        "img-1.png",
        "/images",
      ),
    ).toBe("/images/img-1.png");
    expect(imageLinkPath(ws, "/Users/me/notes/image", "img-1.png", "/")).toBe("/img-1.png");
  });

  it("空白を含むフォルダ名は encode する（プレフィックスには触らない）", () => {
    expect(imageLinkPath("/Users/me/My Notes", "/Users/me/My Notes/my img", "a.png", "")).toBe(
      "my%20img/a.png",
    );
    expect(imageLinkPath(ws, "/Users/me/notes/image", "a.png", "https://cdn.example.com/i")).toBe(
      "https://cdn.example.com/i/a.png",
    );
  });

  it("別ドライブは相対で書けないので絶対パスで書く（ドライブ指定は encode しない）", () => {
    expect(imageLinkPath("C:/Users/me/notes", "D:/img", "a.png", "")).toBe("D:/img/a.png");
    expect(imageLinkPath("C:/Users/me/notes", "D:/my img", "a.png", "")).toBe("D:/my%20img/a.png");
  });
});

describe("imageSrcPath", () => {
  const ws = "/Users/me/blog/content/posts";
  const dir = "/Users/me/blog/static/images";

  it("プレフィックスで始まる本文パスは保存先へ戻す", () => {
    expect(imageSrcPath("/images/img-1.png", ws, dir, "/images")).toBe(
      "/Users/me/blog/static/images/img-1.png",
    );
  });

  it("プレフィックスが無ければワークスペース基準で解決する", () => {
    expect(imageSrcPath("../../static/images/img-1.png", ws, dir, "")).toBe(
      "/Users/me/blog/static/images/img-1.png",
    );
  });

  it("プレフィックスに当たらないパスはワークスペース基準のまま", () => {
    expect(imageSrcPath("fig/a.png", ws, dir, "/images")).toBe(
      "/Users/me/blog/content/posts/fig/a.png",
    );
  });

  it("別ドライブへ絶対で書いたものはそのまま返す", () => {
    expect(imageSrcPath("D:/img/a.png", "C:/Users/me/notes", "D:/img", "")).toBe("D:/img/a.png");
  });

  it("imageLinkPath が書いた形をそのまま戻せる", () => {
    for (const prefix of ["", "/images", "/"]) {
      const link = imageLinkPath(ws, dir, "img-1.png", prefix);
      expect(imageSrcPath(decodePath(link), ws, dir, prefix)).toBe(`${dir}/img-1.png`);
    }
    // 別ドライブ（Windows）も往復できる。
    const winWs = "D:/notes";
    const winDir = "C:/Users/me/images";
    const winLink = imageLinkPath(winWs, winDir, "img-1.png", "");
    expect(imageSrcPath(decodePath(winLink), winWs, winDir, "")).toBe(`${winDir}/img-1.png`);
  });
});

describe("isUnder", () => {
  it("配下と自身は true", () => {
    expect(isUnder("/Users/me", "/Users/me/notes/image")).toBe(true);
    expect(isUnder("/Users/me", "/Users/me")).toBe(true);
    expect(isUnder("/Users/me/", "/Users/me/img")).toBe(true);
  });

  it("外は false（名前の頭が同じだけの隣も弾く）", () => {
    expect(isUnder("/Users/me", "/Volumes/disk/img")).toBe(false);
    expect(isUnder("/Users/me", "/Users/menu/img")).toBe(false);
  });

  it("Windows は大文字小文字を区別しない", () => {
    expect(isUnder("C:\\Users\\Me", "C:/users/me/img")).toBe(true);
    expect(isUnder("C:\\Users\\Me", "D:/img")).toBe(false);
  });

  it("基準が空なら判定しない（false）", () => {
    expect(isUnder("", "/Users/me/img")).toBe(false);
  });
});

describe("resolvePath", () => {
  it("フォルダ側の区切り文字でつなぐ", () => {
    expect(resolvePath("/home/me/notes", "image")).toBe("/home/me/notes/image");
    expect(resolvePath("C:\\Users\\me\\notes", "image")).toBe("C:\\Users\\me\\notes\\image");
  });

  it("入れ子の相対パスも 1 本につなぐ", () => {
    expect(resolvePath("/home/me/notes", "static/images")).toBe("/home/me/notes/static/images");
    expect(resolvePath("C:\\Users\\me\\notes", "static/images")).toBe(
      "C:\\Users\\me\\notes\\static\\images",
    );
  });

  it(".. を畳んで親をたどる", () => {
    expect(resolvePath("/home/me/blog/content/posts", "../../static/images")).toBe(
      "/home/me/blog/static/images",
    );
    expect(resolvePath("C:\\Users\\me\\blog\\content", "..\\static")).toBe(
      "C:\\Users\\me\\blog\\static",
    );
  });

  it("./ と余分な区切りは無視する", () => {
    expect(resolvePath("/home/me/notes/", "./image//a.png")).toBe("/home/me/notes/image/a.png");
  });

  it("ルートより上へは出ない", () => {
    expect(resolvePath("/home", "../../../image")).toBe("/image");
    expect(resolvePath("C:\\notes", "../../image")).toBe("C:\\image");
  });

  it("相対パスが空ならフォルダ自身を返す", () => {
    expect(resolvePath("/home/me/notes", "")).toBe("/home/me/notes");
  });
});

describe("rfc3339Local", () => {
  it("ローカル時刻とオフセットで書く（UTC に寄せない）", () => {
    // 環境のタイムゾーンに依存しないよう、オフセットを固定した時刻で組み立てて比べる。
    const d = new Date(2026, 7, 7, 7, 2, 47);
    const s = rfc3339Local(d);
    expect(s).toMatch(/^2026-08-07T07:02:47[+-]\d{2}:\d{2}$/);
    // 同じ時刻を Date として読み直せる（Hugo が読む RFC3339 として成立している）。
    expect(new Date(s).getTime()).toBe(d.getTime());
  });

  it("月日と時分秒を 2 桁に揃える", () => {
    expect(rfc3339Local(new Date(2026, 0, 3, 4, 5, 6))).toMatch(/^2026-01-03T04:05:06/);
  });
});
