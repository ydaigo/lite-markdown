import { describe, it, expect } from "vitest";
import { indentUnit } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import {
  INDENT_SIZE,
  dedentOnShiftTab,
  deleteListMarkerBackward,
  indentKeymap,
  indentOnTab,
} from "./editor-indent";

// テストは node 環境（DOM 無し）で走るため EditorView は作れない。
// StateCommand は { state, dispatch } しか要らないので、状態だけで直接叩く。
// リスト判定は構文木を見るので markdown() も入れておく。
//
// 本文は "|" をカーソル位置として書く。2 つ書くとその間が選択範囲。
// 結果も同じ書き方で返すので、入る空白の数とカーソルの落ち先を一度に確認できる。
function run(cmd: StateCommand, marked: string): { text: string; doc: string; handled: boolean } {
  const positions: number[] = [];
  let doc = "";
  for (const ch of marked) {
    if (ch === "|") positions.push(doc.length);
    else doc += ch;
  }
  const [anchor, head = anchor] = positions;

  let state = EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [
      markdown(),
      indentUnit.of(" ".repeat(INDENT_SIZE)),
      EditorState.tabSize.of(INDENT_SIZE),
    ],
  });
  const handled = cmd({ state, dispatch: (tr) => void (state = tr.state) });

  const { from, to } = state.selection.main;
  const out = state.doc.toString();
  const text = from === to ? mark(out, [from]) : mark(out, [from, to]);
  return { text, doc: out, handled };
}

// 後ろから入れないと 2 つ目の位置がずれる。
const mark = (text: string, at: number[]): string =>
  at.reduceRight((acc, pos) => `${acc.slice(0, pos)}|${acc.slice(pos)}`, text);

describe("indentOnTab", () => {
  it("カーソルだけのときは次のタブストップまでの空白を入れる", () => {
    // 入る数は固定ではなく、桁が 4 の倍数に揃うところまで。
    expect(run(indentOnTab, "|").text).toBe("    |");
    expect(run(indentOnTab, "a|").text).toBe("a   |");
    expect(run(indentOnTab, "ab|").text).toBe("ab  |");
    expect(run(indentOnTab, "abc|").text).toBe("abc |");
    expect(run(indentOnTab, "abcd|").text).toBe("abcd    |");
  });

  it("行の途中では行頭を動かさずその場に空白を入れる", () => {
    expect(run(indentOnTab, "りんご|みかん").text).toBe("りんご |みかん");
  });

  it("タブ文字は入れない", () => {
    expect(run(indentOnTab, "a|").doc).not.toContain("\t");
  });

  it("行頭のタブ文字も桁として数える", () => {
    expect(run(indentOnTab, "\t|ab").text).toBe("\t    |ab");
  });

  it("1 行の中の部分選択はその選択を空白で置き換える", () => {
    expect(run(indentOnTab, "a|bc|d").text).toBe("a   |d");
  });

  it("複数行の選択は各行の行頭を 1 段下げる", () => {
    expect(run(indentOnTab, "a|b\ncd|e").text).toBe("    a|b\n    cd|e");
  });

  it("行全体の選択は行送りになる（選択を空白で置き換えない）", () => {
    expect(run(indentOnTab, "|ab|\ncd").doc).toBe("    ab\ncd");
  });

  it("箇条書きの行頭で押すと入れ子になる", () => {
    expect(run(indentOnTab, "- a\n|- b").text).toBe("- a\n    |- b");
  });

  it("箇条書きは行の途中で押しても項目ごと下げる", () => {
    // 行の途中に空白を入れても Markdown では意味を持たないため。
    expect(run(indentOnTab, "- a\n- b|").text).toBe("- a\n    - b|");
    expect(run(indentOnTab, "- a\n- み|かん").text).toBe("- a\n    - み|かん");
    expect(run(indentOnTab, "1. a\n1. b|").text).toBe("1. a\n    1. b|");
  });

  it("箇条書きの続きの行も項目ごと下げる", () => {
    expect(run(indentOnTab, "- a\n  つづき|").text).toBe("- a\n      つづき|");
  });

  it("コードブロックの中の - はリストとして扱わない", () => {
    // ``` の中では行の途中に空白を入れる（通常の Tab）。
    expect(run(indentOnTab, "```\n- b|\n```").text).toBe("```\n- b |\n```");
  });
});

describe("dedentOnShiftTab", () => {
  it("カーソルが行のどこにあっても行頭を 1 段戻す", () => {
    expect(run(dedentOnShiftTab, "    - b|").text).toBe("- b|");
    expect(run(dedentOnShiftTab, "    -| b").text).toBe("-| b");
  });

  it("複数行の選択は各行の行頭を 1 段戻す", () => {
    expect(run(dedentOnShiftTab, "    a|b\n    cd|e").doc).toBe("ab\ncde");
  });

  it("インデントが無い行では本文を変えないが、キーは処理済みにする", () => {
    // false を返すとフォーカスがエディタの外へ出てしまうため。
    const r = run(dedentOnShiftTab, "a|b");
    expect(r.doc).toBe("ab");
    expect(r.handled).toBe(true);
  });

  it("空白だけの行はカーソルの右に空白を残さない", () => {
    // 1 つ前のタブストップまで戻り、行の残りは捨てる。
    expect(run(dedentOnShiftTab, "            |").text).toBe("        |");
    expect(run(dedentOnShiftTab, "        |").text).toBe("    |");
    expect(run(dedentOnShiftTab, "    |").text).toBe("|");
    // 行頭にカーソルがある場合。indentLess だと 8 個残ってカーソルだけ先頭に居た。
    expect(run(dedentOnShiftTab, "|            ").text).toBe("|");
    // 空白の途中にカーソルがある場合。
    expect(run(dedentOnShiftTab, "      |      ").text).toBe("    |");
  });

  it("空白だけの行では Tab と Shift+Tab で往復できる", () => {
    let text = "あ\n|";
    for (let i = 0; i < 3; i++) text = run(indentOnTab, text).text;
    expect(text).toBe("あ\n            |");
    for (let i = 0; i < 3; i++) text = run(dedentOnShiftTab, text).text;
    expect(text).toBe("あ\n|");
  });

  it("空白だけの行のタブ文字は跨いで削らない", () => {
    expect(run(dedentOnShiftTab, "\t        |").text).toBe("\t    |");
    expect(run(dedentOnShiftTab, "\t\t|").text).toBe("\t|");
  });

  it("本文がある行は行頭のインデントを 1 段戻す（カーソルは動かさない）", () => {
    expect(run(dedentOnShiftTab, "        |あ").text).toBe("    |あ");
  });
});

describe("deleteListMarkerBackward", () => {
  it("マーカーの直後の Backspace で行頭から丸ごと消す", () => {
    // CodeMirror 既定はマーカーを空白に置き換えるため、見えない空白の上に
    // カーソルが取り残される。字下げごと消して普通の行に戻す。
    expect(run(deleteListMarkerBackward, "- りんご\n- |").text).toBe("- りんご\n|");
    expect(run(deleteListMarkerBackward, "- |りんご").text).toBe("|りんご");
    expect(run(deleteListMarkerBackward, "- a\n    - |").text).toBe("- a\n|");
    expect(run(deleteListMarkerBackward, "1. a\n1. |").text).toBe("1. a\n|");
  });

  it("マーカーの直後でなければ引き受けない（既定の削除に任せる）", () => {
    // false を返すと markdown() や defaultKeymap の Backspace が処理する。
    expect(run(deleteListMarkerBackward, "- り|んご").handled).toBe(false);
    expect(run(deleteListMarkerBackward, "- りんご|").handled).toBe(false);
    expect(run(deleteListMarkerBackward, "ふつうの行|").handled).toBe(false);
    expect(run(deleteListMarkerBackward, "|- りんご").handled).toBe(false);
  });

  it("選択があるときは引き受けない", () => {
    expect(run(deleteListMarkerBackward, "- |りん|ご").handled).toBe(false);
  });

  it("コードブロックの中の - は引き受けない", () => {
    expect(run(deleteListMarkerBackward, "```\n- |\n```").handled).toBe(false);
  });
});

describe("indentKeymap", () => {
  it("Tab / Shift+Tab / Backspace に割り当てがある", () => {
    expect(indentKeymap.map((b) => b.key)).toEqual(["Tab", "Backspace"]);
    expect(indentKeymap[0].run).toBe(indentOnTab);
    expect(indentKeymap[0].shift).toBe(dedentOnShiftTab);
    expect(indentKeymap[1].run).toBe(deleteListMarkerBackward);
  });
});
