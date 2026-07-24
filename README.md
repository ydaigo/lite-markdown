# lite-markdown

Tauri v2 製の、ものすごく軽量な Markdown エディタ（Windows / macOS 対応）。

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
