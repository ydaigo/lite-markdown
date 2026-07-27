import { EditorState, Compartment, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  indentUnit,
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { editorEl } from "./dom";
import { INDENT_SIZE, indentKeymap } from "./editor-indent";
import { state } from "./store";
import { t, getLang } from "./i18n";

// ============================================================================
// CodeMirror エディタ
// ============================================================================
const themeCompartment = new Compartment();

const darkTheme = EditorView.theme(
  {
    "&": { color: "#e6e6e6", backgroundColor: "transparent" },
    ".cm-content": { caretColor: "#e6e6e6" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e6e6e6" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#666", border: "none" },
  },
  { dark: true },
);

const lightTheme = EditorView.theme(
  {
    "&": { color: "#1a1a1a", backgroundColor: "transparent" },
    ".cm-content": { caretColor: "#1a1a1a" },
    ".cm-activeLine": { backgroundColor: "rgba(0,0,0,0.03)" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#aaa", border: "none" },
  },
  { dark: false },
);

const mdHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "bold", color: "#3b82f6" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "#0ea5e9", textDecoration: "underline" },
  { tag: tags.monospace, color: "#e11d48" },
  { tag: tags.quote, color: "#8b8b8b", fontStyle: "italic" },
  { tag: tags.list, color: "#a855f7" },
]);

const cmTheme = () => (state.theme === "dark" ? darkTheme : lightTheme);

// 検索 / 置換パネルの日本語化。キーは @codemirror/search が使う英語フレーズ。
// "$" は件数・行番号に置き換わるプレースホルダなので残すこと。
// en は CodeMirror の既定表記そのものなので訳を渡さない。
const jaPhrases = {
  Find: "検索",
  Replace: "置換後",
  next: "次へ",
  previous: "前へ",
  all: "すべて選択",
  "match case": "大文字小文字を区別",
  regexp: "正規表現",
  "by word": "単語単位",
  replace: "置換",
  "replace all": "すべて置換",
  close: "閉じる",
  "Go to line": "行へ移動",
  go: "移動",
  "current match": "現在の一致",
  "on line": "行目",
  "replaced match on line $": "$ 行目を置換しました",
  "replaced $ matches": "$ 件を置換しました",
};

// 言語に依存するエディタ設定（検索パネルの文言・プレースホルダ）。
const langCompartment = new Compartment();
const langExtensions = () => [
  EditorState.phrases.of(getLang() === "ja" ? jaPhrases : {}),
  placeholder(t("editorPlaceholder")),
];

// エディタ由来のイベントを外部（notes/images）へ渡すためのハンドラ。
// 循環参照を避けるため、具体的な処理は起動時に登録する。
let docChangeHandler: (() => void) | null = null;
let imagePasteHandler: ((file: File, v: EditorView) => void) | null = null;

// setDoc による差し替え中は「利用者の編集」ではないので自動保存を起こさない。
let loading = false;

// 最後にディスクと内容が一致していた地点。ここから変わっていなければ書き込まない
// （メモを開いただけ・カーソルを動かしただけで更新時刻を動かさないため）。
let baseline = "";

export function setDocChangeHandler(fn: () => void): void {
  docChangeHandler = fn;
}

export function setImagePasteHandler(fn: (file: File, v: EditorView) => void): void {
  imagePasteHandler = fn;
}

const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      lineNumbers(),
      history(),
      highlightActiveLine(),
      markdown(),
      search({ top: true }),
      langCompartment.of(langExtensions()),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(mdHighlight),
      // 行送り（indentMore / indentLess）の 1 段。Tab の刻みと揃える。
      indentUnit.of(" ".repeat(INDENT_SIZE)),
      EditorState.tabSize.of(INDENT_SIZE),
      // markdown() が Prec.high で Backspace を握っているので、こちらを更に上に置く。
      Prec.highest(keymap.of([...indentKeymap])),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      themeCompartment.of(cmTheme()),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !loading) docChangeHandler?.();
      }),
      // 画像の貼り付け対応
      EditorView.domEventHandlers({
        paste: (event, v) => {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (it.kind === "file" && it.type.startsWith("image/")) {
              const file = it.getAsFile();
              if (file) {
                event.preventDefault();
                imagePasteHandler?.(file, v);
                return true;
              }
            }
          }
          return false;
        },
      }),
    ],
  }),
  parent: editorEl,
});

export const getDoc = (): string => view.state.doc.toString();

// プログラムから内容を差し替える（この間の変更では自動保存を走らせない）。
// ディスクから読み込んだ地点でもあるので、変更検知の基準もここで揃える。
function replaceDoc(text: string, selection?: { anchor: number }): void {
  loading = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection });
  loading = false;
  baseline = text;
}

export const setDoc = (text: string): void => replaceDoc(text);

// 外部で書き換えられた内容を取り込む（sync.ts）。同じメモを開いたままなので
// カーソルは残す。全文差し替えに任せると文末へ飛んでしまう。
export const adoptDoc = (text: string): void =>
  replaceDoc(text, { anchor: Math.min(view.state.selection.main.head, text.length) });

// 基準から内容が変わっているか（＝書き出す必要があるか）。
export const isDocDirty = (): boolean => view.state.doc.toString() !== baseline;

// 書き出せた分だけ基準を進める（setDoc と対になる）。
export function markDocSaved(text: string): void {
  baseline = text;
}

export function focusEditor(): void {
  view.focus();
}

// 現在のテーマ設定をエディタへ反映する。
export function applyEditorTheme(): void {
  view.dispatch({ effects: themeCompartment.reconfigure(cmTheme()) });
}

// 現在の言語設定をエディタへ反映する。
export function applyEditorLang(): void {
  view.dispatch({ effects: langCompartment.reconfigure(langExtensions()) });
}

// CodeMirror のパネルは検索と置換が一体なので、置換の行だけ CSS で出し入れして
// 「検索」と「検索/置換」を作り分ける。フォーカスは CodeMirror が検索欄へ入れる。
function openPanel(withReplace: boolean): void {
  editorEl.classList.toggle("hide-replace", !withReplace);
  openSearchPanel(view);
}

// 検索パネルを開く（置換の行は隠す）。
export const openEditorSearch = (): void => openPanel(false);

// 検索/置換パネルを開く。
export const openEditorReplace = (): void => openPanel(true);
