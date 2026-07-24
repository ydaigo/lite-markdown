import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  keymap,
  highlightActiveLine,
  lineNumbers,
  placeholder,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { editorEl } from "./dom";
import { state } from "./store";
import { MSG } from "./constants";

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

// エディタ由来のイベントを外部（notes/images）へ渡すためのハンドラ。
// 循環参照を避けるため、具体的な処理は起動時に登録する。
let docChangeHandler: (() => void) | null = null;
let imagePasteHandler: ((file: File, v: EditorView) => void) | null = null;

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
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(mdHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      themeCompartment.of(cmTheme()),
      EditorView.lineWrapping,
      placeholder(MSG.editorPlaceholder),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !state.loading) docChangeHandler?.();
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

// プログラムから内容を差し替える（loading 中は自動保存をスキップ）。
export function setDoc(text: string): void {
  state.loading = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  state.loading = false;
}

export function focusEditor(): void {
  view.focus();
}

// 現在のテーマ設定をエディタへ反映する。
export function applyEditorTheme(): void {
  view.dispatch({ effects: themeCompartment.reconfigure(cmTheme()) });
}
