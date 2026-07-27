# lite-markdown

[![release](https://github.com/ydaigo/lite-markdown/actions/workflows/release.yml/badge.svg)](https://github.com/ydaigo/lite-markdown/actions/workflows/release.yml)

Tauri v2 製の、ものすごく軽量な Markdown / メモアプリ（Windows / macOS 対応）。

## ダウンロード

最新版は **[Releases](https://github.com/ydaigo/lite-markdown/releases/latest)** から取得できます。

- **Windows**: `.msi` または `.exe`（NSIS）
- **macOS**: `.dmg`（Intel / Apple Silicon 両対応の universal）

> 署名なしのため初回起動時に警告が出ます。Windows は「詳細情報」→「実行」、macOS は右クリック →「開く」で許可してください。

## 自動更新

一度インストールすれば、**起動時にバックグラウンドで最新版を確認し、無音で更新**します（macOS は次回起動で適用、Windows は静かに入れ替え）。手動で入れ直す必要はありません。

自動確認が不要なら、タイトルバーの ⚙ から**設定 →「更新」で自動更新をオフ**にできます。

> v0.1.0 以前をお使いの場合のみ、updater を含まないビルドのため **1 回だけ手動で最新版を入れ直して**ください。以降は自動更新されます。

## 設定

タイトルバーの ⚙（または `?` キー）で設定ダイアログを開きます。

- **言語**: 日本語 / English（初回は OS の言語から判定）
- **更新**: 起動時の自動更新確認のオン / オフ
- **キーボードショートカット**: 一覧の確認

- **エディタ**: CodeMirror 6（Markdown 構文ハイライト）
- **プレビュー**: `marked` + `dompurify`（1画面トグル切替）
- **機能**: ファイル開く/保存、ライブプレビュー、ダーク/ライト切替
- **ピン留め**: 一覧の ⋯ または右クリックから。ピンしたメモは一覧の先頭に固定されます。ピンは `.md` には書き込まず、この端末にワークスペースごとに保存します
- **ウィンドウ操作**: macOS は OS 標準のボタン（赤・黄・緑）を左上に表示します（設定は `src-tauri/tauri.macos.conf.json`。緑の長押しでフルスクリーン / 画面分割も使えます）。Windows は自作タイトルバー右端のボタンです
- **フロント**: Vanilla TS + Vite（フレームワーク無し）

## ショートカット

保存は自動（入力が止まると書き込み）なので、保存操作はありません。

| キー | 動作 |
| --- | --- |
| `Ctrl/Cmd + N` | 新規メモ |
| `Ctrl/Cmd + E` | エディタ ⇄ プレビュー 切替 |
| `Ctrl/Cmd + F` | エディタ内検索 |
| `Ctrl/Cmd + Shift + F` | メモ検索（一覧） |
| `Ctrl/Cmd + H` | エディタ内 置換 |
| `Tab` / `Shift + Tab` | インデント / 解除（空白 4 桁刻み。箇条書きの行では項目ごと 1 段） |
| `Ctrl + M`（macOS は `Shift + Option + M`） | Tab をフォーカス移動に戻す（一時） |
| `?` | 設定を開く |
| `Esc` | 検索 / ダイアログを閉じる |

## 開発に必要なもの

- Node.js 18+
- Rust（stable, MSVC ツールチェーン）
- Windows: Microsoft C++ Build Tools（VS 2022 Build Tools の "Desktop development with C++"）
- macOS: Xcode Command Line Tools

## セットアップ

```bash
npm install
# アイコン生成（初回のみ・ソース画像から一式生成）
npm run icons
```

> `npm run tauri icon` を単体で叩くと macOS 用の `icon.icns` がフチなしに戻ります。
> `tauri icon` はソース画像を単純にリサイズするだけで、macOS のアイコングリッド
> （1024 キャンバスに対して本体 824x824・角丸半径 185.4px）を考慮しないため、
> Dock で他アプリより一段大きく見えてしまいます。`npm run icons` は `tauri icon` の後に
> `npm run icons:mac` を実行して `icon.icns` だけ規格に合わせて作り直します。
> Windows の `.ico` はフチなしが慣例なのでそのままです。
> なお `icons:mac` は `swift` と `iconutil` を使うため macOS 専用です。

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
