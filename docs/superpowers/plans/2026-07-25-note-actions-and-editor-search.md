# メモ操作メニュー・エディタ内検索・ショートカット一覧 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メモ単位の操作メニュー（パスをコピー / ディレクトリを開く / 削除）、エディタ内検索・置換、キーボードショートカット一覧モーダルを追加する。

**Architecture:** 既存のモジュール分割・軽量 pub/sub ストア・`MSG` 文言集約パターンに従う。ネイティブ機能は Tauri プラグイン（opener / clipboard-manager）で実現し、UI は既存 `ws-menu` / `error-bar` と同じ「動的生成＋外側クリックで閉じる」パターンで組む。エディタ内検索は `@codemirror/search` の標準パネルを利用し、`Ctrl/Cmd+F` はエディタにフォーカスがあるときだけエディタ検索に委ねる。

**Tech Stack:** TypeScript, Vite, CodeMirror 6, Tauri v2 (Rust), vitest。

## Global Constraints

- 文言はすべて `src/constants.ts` の `MSG` に日本語で追加し、UI から参照する（ハードコード禁止）。
- CSS は `src/styles.css` の既存 CSS 変数（`--menu-bg`, `--border`, `--item-hover`, `--muted`, `--menu-shadow` など）を使う。
- 純粋ロジックは vitest テストを先に書く。テスト環境は `node`（`vite.config.ts` の `test.environment: "node"`）。DOM/Tauri に依存するモジュールは top-level で `document` や `dom.ts` を参照しない（関数内でのみ参照）こと。node 環境のテストから import しても副作用で落ちないようにするため。
- DOM/ネイティブのグルーコードは、リポジトリの慣習に従い pure テストを持たない。ゲートは `npm run typecheck` + `npm run lint` + 手動確認（`npm run tauri dev`）。
- 同時に開くポップアップ（コンテキストメニュー / ショートカットモーダル）は1つだけ。
- コミットメッセージは日本語で、既存ログのスタイル（`feat:` / `refactor:` 等のプレフィックス）に合わせる。各コミット末尾に既存同様の Co-Authored-By 行を付ける:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

---

### Task 1: 依存追加と Tauri プラグイン登録

**Files:**
- Modify: `package.json`（依存追加）
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: なし
- Produces: JS から `@tauri-apps/plugin-opener` の `revealItemInDir(path: string): Promise<void>`、`@tauri-apps/plugin-clipboard-manager` の `writeText(text: string): Promise<void>`、および `@codemirror/search` が利用可能になる。

- [ ] **Step 1: JS 依存を追加**

Run:
```bash
npm install @codemirror/search @tauri-apps/plugin-opener @tauri-apps/plugin-clipboard-manager
```
Expected: `package.json` の `dependencies` に3件追加され、`package-lock.json` が更新される。

- [ ] **Step 2: Cargo に Tauri プラグインを追加**

`src-tauri/Cargo.toml` の `[dependencies]` セクション（`tauri-plugin-fs = "2"` の行の下）に追記:
```toml
tauri-plugin-fs = "2"
tauri-plugin-opener = "2"
tauri-plugin-clipboard-manager = "2"
```

- [ ] **Step 3: プラグインを Rust 側で登録**

`src-tauri/src/lib.rs` の `builder` 構築部分を次のように変更する。既存:
```rust
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
```
変更後:
```rust
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());
```

- [ ] **Step 4: capability に権限を追加**

`src-tauri/capabilities/default.json` の `permissions` 配列末尾（`"updater:default"` の後、`]` の前）に追記。`"updater:default"` の行末にカンマを付けるのを忘れないこと:
```json
    "updater:default",
    "opener:allow-reveal-item-in-dir",
    "clipboard-manager:allow-write-text"
```

- [ ] **Step 5: Rust がビルドできることを確認**

Run:
```bash
cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: エラーなく終了（`Finished` と表示。初回は依存取得で時間がかかる）。

- [ ] **Step 6: 型チェックが通ることを確認**

Run:
```bash
npm run typecheck
```
Expected: エラーなし（新規 import はまだ無いのでこれまで同様に成功）。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: opener/clipboard プラグインと検索ライブラリを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: エディタ内検索・置換とキー割り当て調整

**Files:**
- Modify: `src/editor.ts`
- Modify: `src/events.ts`
- Modify: `src/styles.css`（検索パネルのテーマ）

**Interfaces:**
- Consumes: Task 1 の `@codemirror/search`。
- Produces:
  - `editor.ts` から `editorHasFocus(): boolean`（エディタがフォーカスを保持していれば true）
  - `editor.ts` から `openEditorSearch(): void`（検索・置換パネルを開いてエディタにフォーカス）

- [ ] **Step 1: editor.ts に検索拡張とエクスポートを追加**

`src/editor.ts` の CodeMirror import 群のうち、`@codemirror/view` からの import 行の下に、検索パッケージの import を追加:
```ts
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
```

同ファイルの `EditorState.create({ ... extensions: [ ... ] })` の `extensions` 配列で、`markdown(),` の直後に `search({ top: true }),` を追加し、`keymap.of([...defaultKeymap, ...historyKeymap]),` を次のように置き換える:
```ts
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
```

ファイル末尾（`applyEditorTheme` 関数の後）に次を追加:
```ts
// エディタがフォーカスを保持しているか（キー割り当ての振り分けに使用）。
export const editorHasFocus = (): boolean => view.hasFocus;

// 検索・置換パネルを開いてエディタにフォーカスする。
export function openEditorSearch(): void {
  openSearchPanel(view);
  view.focus();
}
```

- [ ] **Step 2: events.ts のキーボードショートカットを更新**

`src/events.ts` の import 部（`import { toggleWsMenu } from "./workspace";` の下あたり）に追加:
```ts
import { openEditorSearch, editorHasFocus } from "./editor";
```

同ファイルの `window.addEventListener("keydown", ...)` ハンドラを次のブロックで置き換える:
```ts
// キーボードショートカット
window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    void newNote();
  } else if (key === "s") {
    e.preventDefault();
    void flushSave();
  } else if (key === "e") {
    e.preventDefault();
    toggleMode();
  } else if (key === "f") {
    // エディタにフォーカスがあるときは CodeMirror の検索に委ねる。
    if (editorHasFocus()) return;
    e.preventDefault();
    toggleSearch(true);
  } else if (key === "h") {
    // エディタ内 置換パネル。
    e.preventDefault();
    if (state.currentPath) openEditorSearch();
  }
});
```

- [ ] **Step 3: 検索パネルのテーマを styles.css に追加**

`src/styles.css` 末尾に追加:
```css
/* ============================ エディタ内検索パネル ============================ */
#editor .cm-panels {
  background: var(--toolbar-bg);
  color: var(--fg);
  border-color: var(--border);
}
#editor .cm-panels.cm-panels-top {
  border-bottom: 1px solid var(--border);
}
#editor .cm-textfield {
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
#editor .cm-button {
  background: var(--btn-bg);
  background-image: none;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
#editor .cm-button:hover {
  background: var(--btn-hover);
}
#editor .cm-panel.cm-search label {
  color: var(--fg);
  font-size: 12px;
}
```

- [ ] **Step 4: 型チェック・Lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: どちらもエラーなし。

- [ ] **Step 5: 手動確認**

Run: `npm run tauri dev`
確認:
- エディタにカーソルを置き `Ctrl/Cmd+F` → 検索パネルが開く（検索・置換フィールドあり）。
- `Ctrl/Cmd+H` → 検索・置換パネルが開く。
- サイドバー検索ボタン、または一覧にフォーカスがある状態で `Ctrl/Cmd+F` → 従来のメモ検索バーが開く。
- ダークテーマでパネルの色が背景に馴染む。

- [ ] **Step 6: Commit**

```bash
git add src/editor.ts src/events.ts src/styles.css
git commit -m "feat: エディタ内の検索・置換を追加（Ctrl/Cmd+F/H）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 成功トーストとメモ操作モジュール

**Files:**
- Modify: `src/errors.ts`（`showToast` 追加）
- Modify: `src/constants.ts`（`MSG` 追加）
- Create: `src/note-actions.ts`

**Interfaces:**
- Consumes: Task 1 の `revealItemInDir` / `writeText`、既存 `withErrorNotice`。
- Produces:
  - `errors.ts` から `showToast(msg: string): void`
  - `note-actions.ts` から `copyPath(path: string): Promise<void>`、`revealInDir(path: string): Promise<void>`

- [ ] **Step 1: MSG に文言を追加**

`src/constants.ts` の `MSG` オブジェクト内、`deleteFailed` の行の下に追加:
```ts
  deleteFailed: "メモの削除に失敗しました",
  menuMore: "操作",
  menuCopyPath: "パスをコピー",
  menuReveal: "ディレクトリを開く",
  menuDelete: "削除",
  copyPathDone: "パスをコピーしました",
  copyPathFailed: "パスのコピーに失敗しました",
  revealFailed: "フォルダを開けませんでした",
  shortcutsTitle: "キーボードショートカット",
  helpTitle: "ショートカット一覧 (?)",
```

- [ ] **Step 2: errors.ts に成功トーストを追加**

`src/errors.ts` の `showError` 関数の下に追加:
```ts
// 成功などの軽い一時通知（数秒で自動的に消える）。エラーバーとは別枠。
let toastTimer: number | undefined;
export function showToast(msg: string): void {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (el) el.hidden = true;
  }, 1800);
}
```

- [ ] **Step 3: note-actions.ts を作成**

`src/note-actions.ts`:
```ts
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { withErrorNotice, showToast } from "./errors";
import { MSG } from "./constants";

// ============================================================================
// メモ単位のネイティブ操作
// ============================================================================

// 絶対パスをクリップボードへコピーする。
export async function copyPath(path: string): Promise<void> {
  const ok = await withErrorNotice(MSG.copyPathFailed, () => writeText(path));
  if (ok) showToast(MSG.copyPathDone);
}

// OS のファイルマネージャ（Finder / エクスプローラー）で当該ファイルを選択表示する。
export async function revealInDir(path: string): Promise<void> {
  await withErrorNotice(MSG.revealFailed, () => revealItemInDir(path));
}
```

- [ ] **Step 4: トーストの CSS を追加**

`src/styles.css` の `#error-bar[hidden]` ブロックの下に追加:
```css
#toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 998;
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
  font-size: 12.5px;
  padding: 8px 14px;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
#toast[hidden] {
  display: none;
}
```

- [ ] **Step 5: 型チェック・Lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: エラーなし。

- [ ] **Step 6: Commit**

```bash
git add src/constants.ts src/errors.ts src/note-actions.ts src/styles.css
git commit -m "feat: パスのコピーとフォルダ表示のロジックを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 再利用可能なコンテキストメニュー

**Files:**
- Create: `src/context-menu.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: なし（純粋な DOM ヘルパ）。
- Produces:
  - `context-menu.ts` から型 `MenuItem = { label: string; action: () => void; danger?: boolean }`
  - `context-menu.ts` から `openContextMenu(items: MenuItem[], x: number, y: number): void`（画面座標 (x, y) にメニューを開く。既存メニューがあれば閉じてから開く）

- [ ] **Step 1: context-menu.ts を作成**

`src/context-menu.ts`:
```ts
// ============================================================================
// 再利用可能なポップアップメニュー（右クリック / ⋯ ボタン用）
// ============================================================================
export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

let menuEl: HTMLDivElement | null = null;

// 開いているメニューを閉じる。
export function closeContextMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

// 画面座標 (x, y) にメニューを開く。同時に開くのは1つだけ。
export function openContextMenu(items: MenuItem[], x: number, y: number): void {
  closeContextMenu();
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  for (const it of items) {
    const b = document.createElement("button");
    b.className = "ctx-item" + (it.danger ? " danger" : "");
    b.textContent = it.label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      closeContextMenu();
      it.action();
    });
    menu.append(b);
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.append(menu);
  menuEl = menu;

  // 画面外にはみ出す場合は内側へ寄せる。
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = `${window.innerWidth - r.width - 8}px`;
  if (r.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - r.height - 8}px`;
}

// 外側クリック・フォーカス喪失・リサイズで閉じる。
document.addEventListener("click", closeContextMenu);
window.addEventListener("blur", closeContextMenu);
window.addEventListener("resize", closeContextMenu);
```

- [ ] **Step 2: メニューの CSS を追加**

`src/styles.css` 末尾に追加:
```css
/* ============================ コンテキストメニュー ============================ */
.ctx-menu {
  position: fixed;
  z-index: 50;
  min-width: 168px;
  background: var(--menu-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px var(--menu-shadow);
  padding: 4px;
}
.ctx-item {
  width: 100%;
  display: block;
  text-align: left;
  font: inherit;
  font-size: 13px;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}
.ctx-item:hover {
  background: var(--item-hover);
}
.ctx-item.danger {
  color: #dc2626;
}
```

- [ ] **Step 3: 型チェック・Lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: エラーなし。

- [ ] **Step 4: Commit**

```bash
git add src/context-menu.ts src/styles.css
git commit -m "feat: 再利用可能なコンテキストメニュー部品を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: サイドバーへメニューを配線（⋯ ボタン + 右クリック、🗑 を統合）

**Files:**
- Modify: `src/sidebar.ts`
- Modify: `src/styles.css`（`.note-del` → `.note-more` にリネーム）

**Interfaces:**
- Consumes: Task 3 の `copyPath` / `revealInDir`、Task 4 の `openContextMenu` / `MenuItem`、既存 `deleteNote`。
- Produces: なし（UI 配線）。

- [ ] **Step 1: sidebar.ts の import を更新**

`src/sidebar.ts` の import 群を次のように更新する。既存の `import { selectNote, deleteNote } from "./notes";` はそのまま残し、その下に追加:
```ts
import { openContextMenu, type MenuItem } from "./context-menu";
import { copyPath, revealInDir } from "./note-actions";
```

- [ ] **Step 2: メニュー項目を組み立てるヘルパを追加**

`src/sidebar.ts` の `renderList` 関数の直前に追加:
```ts
// メモ1件に対するコンテキストメニュー項目。
function noteMenuItems(path: string): MenuItem[] {
  return [
    { label: MSG.menuCopyPath, action: () => void copyPath(path) },
    { label: MSG.menuReveal, action: () => void revealInDir(path) },
    { label: MSG.menuDelete, danger: true, action: () => void deleteNote(path) },
  ];
}
```

- [ ] **Step 3: renderList の 🗑 ボタンを ⋯ ボタン＋右クリックに置き換え**

`src/sidebar.ts` の `renderList` 内、`del` ボタンを作っている次のブロック:
```ts
    const del = document.createElement("button");
    del.className = "note-del";
    del.title = "削除";
    del.textContent = "🗑";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      void deleteNote(note.path);
    });

    item.append(title, sub, del);
    item.addEventListener("click", () => void selectNote(note.path));
    listEl.append(item);
```
を次で置き換える:
```ts
    const more = document.createElement("button");
    more.className = "note-more";
    more.title = MSG.menuMore;
    more.textContent = "⋯";
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = more.getBoundingClientRect();
      openContextMenu(noteMenuItems(note.path), r.left, r.bottom + 2);
    });

    item.append(title, sub, more);
    item.addEventListener("click", () => void selectNote(note.path));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openContextMenu(noteMenuItems(note.path), e.clientX, e.clientY);
    });
    listEl.append(item);
```

- [ ] **Step 4: CSS の `.note-del` を `.note-more` にリネーム**

`src/styles.css` の3つのセレクタを置き換える:
- `.note-del {` → `.note-more {`
- `.note-item:hover .note-del {` → `.note-item:hover .note-more {`
- `.note-del:hover {` → `.note-more:hover {`

（プロパティ内容は変更しない。`⋯` は絵文字ではなくテキストなので、`font-size` は既存の `13px` のままで表示される。）

- [ ] **Step 5: 型チェック・Lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: エラーなし。

- [ ] **Step 6: 手動確認**

Run: `npm run tauri dev`
確認:
- メモにホバーすると右端に `⋯` が出る。クリックでメニュー（パスをコピー / ディレクトリを開く / 削除）が開く。
- メモを右クリックしてもカーソル位置に同じメニューが開く（ブラウザ標準メニューは出ない）。
- 「パスをコピー」→ 画面下に「パスをコピーしました」トーストが出て、実際に貼り付けできる。
- 「ディレクトリを開く」→ Finder / エクスプローラーが開き当該 .md が選択される。
- 「削除」→ 既存の確認ダイアログが出て削除できる。
- メニューの外側クリックで閉じる。

- [ ] **Step 7: Commit**

```bash
git add src/sidebar.ts src/styles.css
git commit -m "feat: メモの操作メニュー（コピー/フォルダ/削除）を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: ショートカット一覧モーダル

**Files:**
- Create: `src/shortcuts.ts`
- Create: `src/shortcuts.test.ts`
- Modify: `index.html`（ヘルプボタン追加）
- Modify: `src/events.ts`（ヘルプボタン・`?` キー・`Esc` 配線）
- Modify: `src/styles.css`（モーダル）

**Interfaces:**
- Consumes: 既存 `MSG`。
- Produces:
  - `shortcuts.ts` から型 `Shortcut = { keys: string; description: string }`
  - `shortcuts.ts` から `SHORTCUTS: Shortcut[]`（純粋データ）
  - `shortcuts.ts` から `toggleShortcuts(): void`、`closeShortcuts(): void`、`shortcutsOpen(): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/shortcuts.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./shortcuts";

describe("SHORTCUTS", () => {
  it("各項目に keys と description が揃っている", () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.trim()).not.toBe("");
      expect(s.description.trim()).not.toBe("");
    }
  });

  it("keys が重複していない", () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("主要ショートカットを含む", () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(keys).toContain("?");
    expect(keys.some((k) => k.includes("H"))).toBe(true);
    expect(keys.some((k) => k.includes("N"))).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run:
```bash
npm test -- shortcuts
```
Expected: FAIL（`Cannot find module './shortcuts'` 等）。

- [ ] **Step 3: shortcuts.ts を作成（データ + モーダル）**

`src/shortcuts.ts`。**注意: top-level では `document` や `dom.ts` を参照しない**（node テストから import しても落ちないようにするため。DOM 参照は関数内のみ）:
```ts
import { MSG } from "./constants";

// ============================================================================
// キーボードショートカット一覧（単一の情報源）とモーダル表示
// ============================================================================
export interface Shortcut {
  keys: string;
  description: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl / Cmd + N", description: "新規メモ" },
  { keys: "Ctrl / Cmd + S", description: "保存" },
  { keys: "Ctrl / Cmd + E", description: "編集 / プレビュー切替" },
  { keys: "Ctrl / Cmd + F", description: "メモ検索（一覧）/ エディタ内検索" },
  { keys: "Ctrl / Cmd + H", description: "エディタ内 置換" },
  { keys: "?", description: "このショートカット一覧" },
  { keys: "Esc", description: "検索 / メニュー / ダイアログを閉じる" },
];

let overlay: HTMLDivElement | null = null;

export const shortcutsOpen = (): boolean => overlay !== null;

export function closeShortcuts(): void {
  overlay?.remove();
  overlay = null;
}

export function openShortcuts(): void {
  if (overlay) return;
  const ov = document.createElement("div");
  ov.id = "sc-overlay";
  // 背景（オーバーレイ自身）クリックで閉じる。
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeShortcuts();
  });

  const dialog = document.createElement("div");
  dialog.className = "sc-dialog";

  const head = document.createElement("div");
  head.className = "sc-head";
  const title = document.createElement("div");
  title.className = "sc-title";
  title.textContent = MSG.shortcutsTitle;
  const close = document.createElement("button");
  close.className = "sc-close";
  close.textContent = "✕";
  close.addEventListener("click", () => closeShortcuts());
  head.append(title, close);
  dialog.append(head);

  for (const s of SHORTCUTS) {
    const row = document.createElement("div");
    row.className = "sc-row";
    const desc = document.createElement("span");
    desc.className = "sc-desc";
    desc.textContent = s.description;
    const keys = document.createElement("span");
    keys.className = "sc-keys";
    keys.textContent = s.keys;
    row.append(desc, keys);
    dialog.append(row);
  }

  ov.append(dialog);
  document.body.append(ov);
  overlay = ov;
}

export function toggleShortcuts(): void {
  if (overlay) closeShortcuts();
  else openShortcuts();
}
```

- [ ] **Step 4: テストが通ることを確認**

Run:
```bash
npm test -- shortcuts
```
Expected: PASS（3 テスト）。

- [ ] **Step 5: index.html にヘルプボタンを追加**

`index.html` の `<div class="tb-left">` 内、検索ボタン（`id="btn-search"` の `</button>`）の直後に追加:
```html
          <button id="btn-help" class="tb-btn" title="ショートカット一覧 (?)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M6 6.2a2 2 0 1 1 2.7 1.9c-.45.16-.7.5-.7 1v.3" stroke-linecap="round" />
              <circle cx="8" cy="11.4" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
```

- [ ] **Step 6: events.ts にヘルプボタン・`?`・`Esc` を配線**

`src/events.ts` の import 群に追加:
```ts
import { toggleShortcuts, closeShortcuts, shortcutsOpen } from "./shortcuts";
```

ヘルプボタンのクリック配線を、`btn-search` の配線行の下に追加:
```ts
$<HTMLButtonElement>("btn-help").addEventListener("click", () => toggleShortcuts());
```

Task 2 で置き換えた `window.addEventListener("keydown", ...)` ハンドラの**先頭**（`const mod = ...` の直前）に、`?` と `Esc` の処理を追加する。ハンドラ全体は次のようになる:
```ts
// キーボードショートカット
window.addEventListener("keydown", (e) => {
  // ショートカット一覧モーダルが開いていれば Esc で閉じる。
  if (e.key === "Escape" && shortcutsOpen()) {
    closeShortcuts();
    return;
  }
  // 入力中でなければ「?」でショートカット一覧を開閉。
  if (e.key === "?" && !isTypingTarget(e.target)) {
    e.preventDefault();
    toggleShortcuts();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    void newNote();
  } else if (key === "s") {
    e.preventDefault();
    void flushSave();
  } else if (key === "e") {
    e.preventDefault();
    toggleMode();
  } else if (key === "f") {
    // エディタにフォーカスがあるときは CodeMirror の検索に委ねる。
    if (editorHasFocus()) return;
    e.preventDefault();
    toggleSearch(true);
  } else if (key === "h") {
    // エディタ内 置換パネル。
    e.preventDefault();
    if (state.currentPath) openEditorSearch();
  }
});

// 入力欄やエディタ（contenteditable）にフォーカスがあるかを判定する。
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}
```

- [ ] **Step 7: モーダルの CSS を追加**

`src/styles.css` 末尾に追加:
```css
/* ============================ ショートカット一覧モーダル ============================ */
#sc-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.sc-dialog {
  width: min(420px, 90vw);
  max-height: 80vh;
  overflow: auto;
  background: var(--menu-bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 40px var(--menu-shadow);
  padding: 16px 18px;
}
.sc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sc-title {
  font-size: 14px;
  font-weight: 700;
}
.sc-close {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 15px;
  padding: 2px 6px;
  border-radius: 6px;
}
.sc-close:hover {
  background: var(--item-hover);
}
.sc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  font-size: 13px;
}
.sc-row + .sc-row {
  border-top: 1px solid var(--border);
}
.sc-desc {
  flex: 1;
}
.sc-keys {
  flex: 0 0 auto;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 12px;
  color: var(--muted);
}
```

- [ ] **Step 8: 型チェック・Lint・テスト**

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: すべて成功（既存テスト + 新規 shortcuts テスト）。

- [ ] **Step 9: 手動確認**

Run: `npm run tauri dev`
確認:
- タイトルバーの「?」アイコンボタン、またはキーボードの `?`（エディタ非フォーカス時）でモーダルが開く。
- エディタで文章を編集中に `?` を打っても、モーダルは開かず文字が入力される。
- モーダルは `Esc` / 背景クリック / ✕ で閉じる。
- ダーク/ライト両テーマで見やすい。

- [ ] **Step 10: Commit**

```bash
git add src/shortcuts.ts src/shortcuts.test.ts index.html src/events.ts src/styles.css
git commit -m "feat: キーボードショートカット一覧モーダルを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 完了確認（全タスク後）

Run:
```bash
npm run typecheck && npm run lint && npm test
```
Expected: すべて成功。

手動総合確認（`npm run tauri dev`）:
1. エディタ内検索・置換（`Ctrl/Cmd+F` / `Ctrl/Cmd+H`）
2. メモの `⋯` / 右クリックメニュー → パスをコピー / ディレクトリを開く / 削除
3. `?` またはヘルプボタン → ショートカット一覧モーダル
4. 既存機能（メモ検索 `Ctrl/Cmd+F` を一覧側で、新規 `Ctrl/Cmd+N`、保存、プレビュー切替）が従来どおり動く

## Self-Review メモ（プラン作成者による確認結果）

- **Spec 網羅**: 検索・置換=Task2 / パスコピー=Task3,5 / ディレクトリを開く=Task3,5 / 🗑 統合=Task5 / ショートカット一覧=Task6 / プラグイン・capability=Task1。「全文検索は新規実装しない」方針どおり該当タスクなし（既存機能で充足）。
- **型整合**: `editorHasFocus` / `openEditorSearch`（editor.ts）、`openContextMenu` / `MenuItem`（context-menu.ts）、`copyPath` / `revealInDir`（note-actions.ts）、`showToast`（errors.ts）、`toggleShortcuts` / `closeShortcuts` / `shortcutsOpen` / `SHORTCUTS`（shortcuts.ts）は各タスクの Produces と利用箇所で一致。
- **プレースホルダなし**: 全ステップに実コード・実コマンド・期待結果を記載。
