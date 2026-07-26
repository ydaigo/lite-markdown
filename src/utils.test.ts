import { describe, it, expect } from "vitest";
import { baseName, dirName, isMarkdownPath, joinPath } from "./utils";

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
