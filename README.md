# lite-markdown

[![release](https://github.com/ydaigo/lite-markdown/actions/workflows/release.yml/badge.svg)](https://github.com/ydaigo/lite-markdown/actions/workflows/release.yml)

Tauri v2 製の、ものすごく軽量な Markdown / メモアプリ（Windows / macOS 対応）。

## ダウンロード

最新版は **[Releases](https://github.com/ydaigo/lite-markdown/releases/latest)** から取得できます。

- **Windows**: `.msi` または `.exe`（NSIS）
- **macOS**: `.dmg`（Intel / Apple Silicon 両対応の universal）

> 署名なしのため初回起動時に警告が出ます。Windows は「詳細情報」→「実行」、macOS は右クリック →「開く」で許可してください。

## 自動更新

updater 対応版をインストール後は、**起動時にバックグラウンドで最新の nightly を確認し、無音で更新**します（macOS は次回起動で適用、Windows は静かに入れ替え）。手動で入れ直す必要はありません。

> 初回のみ: 既存のインストール版には updater が入っていないため、**updater 対応版の nightly を 1 回だけ手動 DL** してください。以降は自動更新されます。

- **エディタ**: CodeMirror 6（Markdown 構文ハイライト）
- **プレビュー**: `marked` + `dompurify`（1画面トグル切替）
- **機能**: ファイル開く/保存、ライブプレビュー、ダーク/ライト切替
- **フロント**: Vanilla TS + Vite（フレームワーク無し）

## ショートカット

| キー | 動作 |
| --- | --- |
| `Ctrl/Cmd + O` | 開く |
| `Ctrl/Cmd + S` | 保存 |
| `Ctrl/Cmd + Shift + S` | 名前を付けて保存 |
| `Ctrl/Cmd + E` | エディタ ⇄ プレビュー 切替 |

## 開発に必要なもの

- Node.js 18+
- Rust（stable, MSVC ツールチェーン）
- Windows: Microsoft C++ Build Tools（VS 2022 Build Tools の "Desktop development with C++"）
- macOS: Xcode Command Line Tools

## セットアップ

```bash
npm install
# アイコン生成（初回のみ・ソース画像から一式生成）
npm run tauri icon src-tauri/icons/source.png
```

## 開発起動

```bash
npm run tauri dev
```

## 本番ビルド

```bash
npm run tauri build
```

- Windows: `src-tauri/target/release/bundle/` に `.msi` / `.exe`
- macOS: 同ディレクトリに `.dmg` / `.app`

> クロスコンパイルは不可。macOS 版は macOS 実機か CI（GitHub Actions）でビルドしてください。
