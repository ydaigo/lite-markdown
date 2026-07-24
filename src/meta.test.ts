import { describe, it, expect } from "vitest";
import { deriveMeta } from "./meta";

describe("deriveMeta", () => {
  it("空文字ならタイトルを既定値にする", () => {
    expect(deriveMeta("")).toEqual({ title: "新規メモ", snippet: "" });
  });

  it("空白のみでも既定タイトルになる", () => {
    expect(deriveMeta("   \n\n  ")).toEqual({ title: "新規メモ", snippet: "" });
  });

  it("先頭行をタイトル、次の非空行を抜粋にする", () => {
    expect(deriveMeta("買い物リスト\n牛乳を買う")).toEqual({
      title: "買い物リスト",
      snippet: "牛乳を買う",
    });
  });

  it("見出し記号(#)を取り除く", () => {
    expect(deriveMeta("## タイトル\n本文")).toEqual({ title: "タイトル", snippet: "本文" });
  });

  it("リストマーカー(-, *, +)を取り除く", () => {
    expect(deriveMeta("- 項目1\n* 項目2")).toEqual({ title: "項目1", snippet: "項目2" });
  });

  it("空行をまたいでタイトルと抜粋を拾う", () => {
    expect(deriveMeta("見出し\n\n\n次の段落")).toEqual({
      title: "見出し",
      snippet: "次の段落",
    });
  });

  it("CRLF 改行も扱える", () => {
    expect(deriveMeta("A\r\nB")).toEqual({ title: "A", snippet: "B" });
  });

  it("1行しかなければ抜粋は空", () => {
    expect(deriveMeta("単一行")).toEqual({ title: "単一行", snippet: "" });
  });
});
