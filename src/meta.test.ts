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

  it("途中の見出しをタイトルにし、先頭行を抜粋に回す", () => {
    expect(deriveMeta("前置き\n\n# 本題\n本文")).toEqual({
      title: "本題",
      snippet: "前置き",
    });
  });

  it("最初の見出しを使う（後続の見出しは無視）", () => {
    expect(deriveMeta("## 最初\n### 次\n本文")).toEqual({
      title: "最初",
      snippet: "次",
    });
  });

  it("front matter の title を見出しより優先する", () => {
    const text = '---\ntitle: "メタのタイトル"\ndate: 2026-01-01\n---\n\n# 本文の見出し\n段落';
    expect(deriveMeta(text)).toEqual({ title: "メタのタイトル", snippet: "本文の見出し" });
  });

  it("Hugo の記事から title と本文の抜粋を拾う", () => {
    const text = [
      "---",
      'title: "Hello World — ブログはじめました AI生成"',
      "date: 2026-08-07T00:00:00+09:00",
      "draft: false",
      'tags: ["雑記", "hugo"]',
      'categories: ["お知らせ"]',
      'summary: "Hugo + GitHub Pages でブログを立ち上げました。最初の記事です。"',
      "---",
      "",
      "はじめまして。",
    ].join("\n");
    expect(deriveMeta(text)).toEqual({
      title: "Hello World — ブログはじめました AI生成",
      snippet: "はじめまして。",
    });
  });

  it("title と同じ見出しは抜粋に出さない", () => {
    expect(deriveMeta("---\ntitle: 記事\n---\n# 記事\n本文")).toEqual({
      title: "記事",
      snippet: "本文",
    });
  });

  it("引用符の無い title も読む", () => {
    expect(deriveMeta("---\ntitle: メタ\n---\n本文")).toEqual({
      title: "メタ",
      snippet: "本文",
    });
  });

  it("入れ子の title は使わない", () => {
    expect(deriveMeta("---\nparams:\n  title: 入れ子\n---\n# 見出し\n本文")).toEqual({
      title: "見出し",
      snippet: "本文",
    });
  });

  it("TOML front matter(+++)の title も読む", () => {
    expect(deriveMeta('+++\ntitle = "メタ"\n+++\n# 見出し\n段落')).toEqual({
      title: "メタ",
      snippet: "見出し",
    });
  });

  it("title の無い front matter は読み飛ばして見出しを拾う", () => {
    expect(deriveMeta("---\ndate: 2026-01-01\n---\n# 見出し\n段落")).toEqual({
      title: "見出し",
      snippet: "段落",
    });
  });

  it("front matter に title も本文に見出しも無ければ最初の本文行をタイトルにする", () => {
    expect(deriveMeta("---\ndate: 2026-01-01\n---\n本文1\n本文2")).toEqual({
      title: "本文1",
      snippet: "本文2",
    });
  });

  it("front matter が閉じていなければ本文として読む", () => {
    expect(deriveMeta("---\n# 見出し\n段落")).toEqual({ title: "見出し", snippet: "段落" });
  });

  it("閉じていない front matter の title はタイトルにしない", () => {
    expect(deriveMeta("---\ntitle: メタ\n# 見出し")).toEqual({
      title: "見出し",
      snippet: "title: メタ",
    });
  });
});
