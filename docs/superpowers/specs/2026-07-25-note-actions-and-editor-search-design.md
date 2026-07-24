# メモ操作メニュー・エディタ内検索・ショートカット一覧 設計

- 日付: 2026-07-25
- 対象: lite-markdown (Tauri v2 + TypeScript + CodeMirror)

## 目的

以下の機能を追加し、メモ編集の日常操作を快適にする。

1. **ファイル内検索・置換**（エディタ内）
2. **メモのパスをコピー**
3. **メモのディレクトリを Finder/エクスプローラーで開く**
4. **キーボードショートカット一覧の表示**

「すべてのファイルを検索」は既存のサイドバー検索（`Ctrl/Cmd+F`、ワークスペース内全メモ本文を絞り込み）で充足しているため、本設計では新規実装しない（必要なら微調整のみ）。

## 全体方針

- 既存のモジュール分割・軽量ストア（`store.ts` の pub/sub）・`MSG` 集約という既存パターンに合わせる。
- 新しい純粋ロジックはテスト（vitest）を先に書く（TDD）。DOM/Tauri グルーは薄く保つ。
- 文言はすべて `constants.ts` の `MSG` に日本語で追加。CSS は既存トークンで `styles.css` に追加。

## 機能ごとの設計

### 1. ファイル内検索・置換（エディタ内）

- `@codemirror/search` を `editor.ts` の拡張に追加し、標準の検索パネル（検索・置換・次/前・全置換）を有効化する。
- 検索パネルはテーマ（light/dark）に追従させる（既存の `themeCompartment` と整合する形で最小限のスタイルを当てる）。
- **キー割り当て（フォーカス連動）**:
  - エディタにフォーカスがあるとき: `Ctrl/Cmd+F` は CodeMirror の検索パネルを開く。
  - サイドバー/一覧側（エディタ非フォーカス）では: `Ctrl/Cmd+F` は従来どおりメモ検索（`toggleSearch`）。
  - `Ctrl/Cmd+H` は常にエディタの置換パネルを開く。
  - 実装: `events.ts` のグローバル `keydown` で、エディタがフォーカスを持つ場合は `f` / `h` の処理をスキップし、CodeMirror の `searchKeymap` に委ねる。フォーカス判定はエディタ DOM 内に `document.activeElement` があるかで行う。

### 2. メモ単位の操作メニュー（パスをコピー / ディレクトリを開く / 削除）

- 再利用可能なポップアップメニュー `src/context-menu.ts` を新設。
  - 既存 `ws-menu` と同じ「外側クリックで閉じる」パターン（`document` クリックで閉じる）に合わせる。
  - API 案: `openContextMenu(items, anchor)` — `items: { label, action, danger? }[]`、`anchor` は座標（右クリック）またはボタン要素（`⋯`）。同時に1つだけ開く。
- サイドバー（`sidebar.ts`）の各メモ項目に:
  - **右クリック**（`contextmenu` イベント）と **`⋯` ボタン** の両方で同じメニューを開く。
  - **既存の 🗑 ボタンは廃止し、`⋯` メニューに「削除」を統合**する（サイドバーをすっきりさせる）。
  - メニュー項目: **パスをコピー** / **ディレクトリを開く** / **削除（danger）**。
- 操作ロジックは `src/note-actions.ts` に集約: `copyPath(path)` / `revealInDir(path)`。削除は既存の `deleteNote(path)` を再利用。

### 3. パスをコピー / ディレクトリを開く の実装基盤

- **ディレクトリを開く**:
  - `tauri-plugin-opener`（Rust）+ `@tauri-apps/plugin-opener`（JS）を追加。
  - `revealItemInDir(path)` を使用（macOS=Finder、Windows=エクスプローラーで当該ファイルを選択表示）。
  - `lib.rs` にプラグイン登録、capability に `opener:allow-reveal-item-in-dir` を追加。
- **パスをコピー**:
  - `tauri-plugin-clipboard-manager` + `@tauri-apps/plugin-clipboard-manager` を追加（`navigator.clipboard` は webview で不安定なため公式プラグインを採用）。
  - `writeText(path)` で絶対パスをコピー。
  - capability に `clipboard-manager:allow-write-text` を追加。
  - 成功時は既存の通知系（`errors.ts` のエラー通知と同系統の軽いフィードバック）で「コピーしました」を短時間表示。失敗時はエラー通知。

### 4. ショートカット一覧モーダル

- `src/shortcuts.ts` を新設。
  - **データ駆動**: ショートカット定義 `{ keys, description }[]` を単一の情報源として保持（純粋データ）。
  - モーダルダイアログで一覧表示。画面中央にオーバーレイ表示、テーマ追従。
  - **トリガー**: 入力中でないときの **`?` キー**、＋ タイトルバーの小さな **ヘルプボタン**。
  - **閉じる**: `Esc` / 背景（オーバーレイ）クリック / ✕ ボタン。
  - 定義配列は純粋データなので `shortcuts.test.ts` で最低限テスト（重複キーがない、必須フィールドが揃う等）。

## 変更・追加ファイル一覧（見込み）

- 追加: `src/context-menu.ts`, `src/note-actions.ts`, `src/shortcuts.ts`, `src/shortcuts.test.ts`
- 変更: `src/editor.ts`（検索拡張）, `src/events.ts`（キー割り当て・`?`・メニュー配線）, `src/sidebar.ts`（`⋯`・右クリック・🗑 廃止）, `src/dom.ts`（新規要素参照）, `src/constants.ts`（`MSG` 追加）, `src/styles.css`（メニュー・モーダル・検索パネル）, `index.html`（ヘルプボタン・モーダル/メニュー用コンテナ）
- 変更（Tauri）: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- 変更: `package.json`（`@codemirror/search`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-clipboard-manager`）

## エラーハンドリング

- コピー / ディレクトリを開く の失敗は既存 `withErrorNotice` / `showError` パターンで通知し、致命化しない。
- メニューやモーダルは同時に1つだけ開く（既存メニューが開いていれば閉じてから開く）。

## テスト方針

- 純粋ロジック（ショートカット定義、必要なら `note-actions` から抽出できる整形ロジック）は vitest で先にテスト。
- DOM/Tauri グルー（メニュー描画、`revealItemInDir` 呼び出し等）は薄く保ち、手動確認（`npm run tauri dev`）で検証。

## 非対象（YAGNI）

- grep 型の行単位ヒット表示、全ワークスペース横断検索は本設計では作らない。
- メニューのカスタマイズ、ショートカットの再割り当て UI は作らない。
