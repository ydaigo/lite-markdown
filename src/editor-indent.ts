import { indentLess, indentMore } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState, type StateCommand } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";

// ============================================================================
// Tab によるインデント（ほぼ VS Code と同じ挙動）
// ============================================================================
// CodeMirror は既定で Tab を割り当てないため、押すとフォーカスがエディタの外へ
// 出てしまう。VS Code の Tab / Shift+Tab に揃えて割り当てを足す。
// 違うのは箇条書きの行だけで、そこは行の途中で押しても項目ごと下げる。
//
// 入れるのは空白。VS Code の既定（tabSize 4 / insertSpaces true）に合わせる。
// Markdown では行頭の 4 空白がコードブロック扱いになるが、これは VS Code の
// プレビューでも同じ。2 空白刻みにしたければこの値だけ変えれば全部追従する。
export const INDENT_SIZE = 4;

// 表示上の桁位置。タブ文字は tabSize 単位で桁を送る（タブ混在の行を貼った場合のため）。
function visualColumn(text: string, tabSize: number): number {
  let col = 0;
  for (const ch of text) col = ch === "\t" ? col + tabSize - (col % tabSize) : col + 1;
  return col;
}

// カーソル位置に「次のタブストップまで」の空白を入れる（選択があれば置き換える）。
// 入る数が固定でないのがミソで、これで桁が揃う。
const insertToNextTabStop: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const line = state.doc.lineAt(range.from);
        const col = visualColumn(state.doc.sliceString(line.from, range.from), state.tabSize);
        const insert = " ".repeat(state.tabSize - (col % state.tabSize));
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + insert.length),
        };
      }),
      { scrollIntoView: true, userEvent: "input" },
    ),
  );
  return true;
};

// 行送り（indentMore）にするか、カーソル位置への挿入にするかの判定。
// VS Code は複数行の選択と「行全体の選択」だけを行送りにする。
function shiftsLines(state: EditorState): boolean {
  return state.selection.ranges.some((r) => {
    if (r.empty) return false;
    const line = state.doc.lineAt(r.from);
    if (r.to > line.to) return true; // 複数行にまたがる
    return r.from === line.from && r.to === line.to; // 行全体
  });
}

// 箇条書きの項目の中にいるか。構文木で見るので、コードブロックの中の "- " は
// リストとして扱わない（``` の中や字下げコードブロックでの誤爆を避ける）。
function inListItem(state: EditorState, pos: number): boolean {
  const inner = syntaxTree(state).resolveInner(pos, -1);
  for (let node: typeof inner | null = inner; node; node = node.parent) {
    if (node.name === "ListItem") return true;
    if (node.name.includes("Code")) return false;
  }
  return false;
}

const inList = (state: EditorState): boolean =>
  state.selection.ranges.some((r) => inListItem(state, r.from));

// リストの中では行の途中で押しても項目ごと下げる（入れ子にする）。
// 行の途中に空白を入れても Markdown では意味を持たないため。
export const indentOnTab: StateCommand = (target) =>
  shiftsLines(target.state) || inList(target.state)
    ? indentMore(target)
    : insertToNextTabStop(target);

// カーソルがある行がすべて「空白だけの行」か（空行そのものは除く）。
const onBlankLine = (state: EditorState): boolean =>
  state.selection.ranges.every((r) => {
    if (!r.empty) return false;
    const line = state.doc.lineAt(r.from);
    return line.length > 0 && !/\S/.test(line.text);
  });

// 空白だけの行での Shift+Tab。カーソルの桁から 1 つ前のタブストップまで戻し、
// 行の残りも捨てる。
//
// indentLess は「行頭の空白の並び」だけを見てカーソルを考えないため、行頭に戻った
// のにカーソルの右へ空白が取り残されることがある。空白しか無い行では揃える相手も
// 居ないので、カーソルより後ろは残さない。
const dedentBlankLine: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) return false;
  const changes = state.selection.ranges.map((range) => {
    const line = state.doc.lineAt(range.from);
    const col = visualColumn(line.text.slice(0, range.from - line.from), state.tabSize);
    const stop =
      col % state.tabSize === 0 ? Math.max(0, col - state.tabSize) : col - (col % state.tabSize);
    // 目標の桁に収まる位置まで、本文に近い側から削る（タブ文字を跨いで削りすぎない）。
    let end = range.from - line.from;
    while (end > 0 && visualColumn(line.text.slice(0, end - 1), state.tabSize) >= stop) end--;
    return { from: line.from + end, to: line.to };
  });
  dispatch(state.update({ changes, userEvent: "delete.dedent" }));
  return true;
};

// Shift+Tab は行頭を 1 段戻す（VS Code の outdent と同じ）。
// 直前の Tab を打ち消すわけではない点も VS Code と揃えている。
export const dedentOnShiftTab: StateCommand = (target) =>
  onBlankLine(target.state) ? dedentBlankLine(target) : indentLess(target);

// 行頭の字下げ + リストマーカー + 後ろの空白。
const LIST_PREFIX = /^\s*(?:[-*+]|\d+[.)])\s+/;

// マーカーの直後で Backspace を押したとき、行頭からマーカーまでを丸ごと消す。
//
// CodeMirror（@codemirror/lang-markdown の deleteMarkupBackward）はマーカーを
// 同じ幅の空白に置き換える仕様で、リストを消したつもりなのに見えない空白が残り、
// カーソルだけ字下げ位置に取り残される。字下げごと消して普通の行に戻す。
export const deleteListMarkerBackward: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly || !state.selection.ranges.every((r) => r.empty)) return false;
  let matched = false;
  const spec = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const prefix = LIST_PREFIX.exec(line.text);
    // マーカーの直後にカーソルがあるときだけ引き受け、それ以外は既定の削除に任せる。
    if (!prefix || range.from - line.from !== prefix[0].length || !inListItem(state, range.from)) {
      return { range };
    }
    matched = true;
    return {
      changes: { from: line.from, to: range.from },
      range: EditorSelection.cursor(line.from),
    };
  });
  if (!matched) return false;
  dispatch(state.update(spec, { scrollIntoView: true, userEvent: "delete" }));
  return true;
};

// Tab を奪うのでキーボードだけではフォーカスを外へ出せなくなるが、defaultKeymap の
// Ctrl+M（macOS は Shift+Option+M）で一時的にフォーカス移動へ戻せる。
// これも VS Code の Ctrl+M と同じ割り当て。
//
// Backspace は markdown() が Prec.high で割り当てているので、editor.ts 側で
// Prec.highest に置いて先に処理させる。
export const indentKeymap: readonly KeyBinding[] = [
  { key: "Tab", run: indentOnTab, shift: dedentOnShiftTab },
  { key: "Backspace", run: deleteListMarkerBackward },
];
