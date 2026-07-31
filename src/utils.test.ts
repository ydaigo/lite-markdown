import { describe, it, expect } from "vitest";
import {
  baseName,
  boundedCache,
  diagramErrorLine,
  dirName,
  externalUrl,
  isMarkdownPath,
  joinPath,
  matchOffsets,
  mermaidThemeName,
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
