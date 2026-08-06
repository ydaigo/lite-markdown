import { describe, it, expect } from "vitest";
import {
  baseName,
  boundedCache,
  clampPreviewWidth,
  diagramErrorLine,
  dirName,
  escapeHtml,
  externalUrl,
  isMarkdownPath,
  joinPath,
  matchOffsets,
  mermaidThemeName,
  normalizeImageDir,
  noteFileName,
  relativeNoteName,
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
  it("そのまま使える相対パスは変えない", () => {
    expect(normalizeImageDir("image")).toBe("image");
    expect(normalizeImageDir("static/images")).toBe("static/images");
  });

  it("前後の空白・余分な区切り・./ を落とす", () => {
    expect(normalizeImageDir("  assets  ")).toBe("assets");
    expect(normalizeImageDir("/")).toBe("");
    expect(normalizeImageDir("./static//images/")).toBe("static/images");
  });

  it("区切りを / に揃える（Windows の表記で入力しても同じ）", () => {
    expect(normalizeImageDir("static\\images")).toBe("static/images");
  });

  it("空入力は既定に倒すための空文字", () => {
    expect(normalizeImageDir("")).toBe("");
    expect(normalizeImageDir("   ")).toBe("");
    expect(normalizeImageDir(".")).toBe("");
  });

  it("../ でワークスペースの外も指せる", () => {
    expect(normalizeImageDir("../images")).toBe("../images");
    expect(normalizeImageDir("../../static/images")).toBe("../../static/images");
    expect(normalizeImageDir("..\\..\\static\\images")).toBe("../../static/images");
  });

  it("途中の .. は畳み、先頭に残った .. だけを外向きとして残す", () => {
    expect(normalizeImageDir("static/../images")).toBe("images");
    expect(normalizeImageDir("static/../../images")).toBe("../images");
    expect(normalizeImageDir("a/b/../../../c")).toBe("../c");
    expect(normalizeImageDir("..")).toBe("..");
  });

  it("絶対パスは受け付けない（相対で持たないとワークスペースを移せない）", () => {
    expect(normalizeImageDir("/Users/me/images")).toBe("");
    expect(normalizeImageDir("C:\\Users\\me\\images")).toBe("");
  });

  it("ファイル名に使えない文字を含む指定は受け付けない", () => {
    expect(normalizeImageDir("img*es")).toBe("");
    expect(normalizeImageDir('a"b')).toBe("");
    expect(normalizeImageDir("a|b")).toBe("");
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
