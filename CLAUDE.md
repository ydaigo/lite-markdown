# lite-markdown の開発方針

## ブランチ

**main 一本で開発する。** feature ブランチも PR も作らない。main へ直接コミットして push する。

個人リポジトリで開発者は 1 人、Issue も使っていない。ブランチと PR のオーバーヘッドに見合わないため。

## コミットメッセージ

タイトル・本文ともに日本語。チケット番号は付けない（Issue を使っていないため）。

```
prefix: 何をしたか

なぜそうしたか、どういう作りにしたか。
```

実際に使われている prefix（使用数の多い順）。

| prefix | 用途 |
| --- | --- |
| `feat` | 機能追加 |
| `fix` | 不具合修正 |
| `refactor` | 挙動を変えない整理 |
| `docs` | ドキュメント |
| `chore` | リリース、雑務 |
| `perf` | 性能改善 |
| `ci` | ワークフロー |

## push 前に通すもの

```bash
npm run format && npm run typecheck && npm test && npm run lint
```

`npm run format` の対象は `src/**/*.{ts,css}` のみ。README や package.json は対象外。

## CI とリリース

- `ci.yml` — main への push と PR で typecheck / test / lint のみ。**main への push でリリース配信は走らない。**
- `release.yml` — Actions からの手動実行（`workflow_dispatch`）か、タグ `v*` の push でのみ動く。実行するとバージョン採番 → タグ → Mac/Win ビルド → GitHub Release 公開まで進み、**既存ユーザーは次回起動時に自動更新される**。

## アイコン

`npm run tauri icon` を単体で叩かない。macOS 用の `icon.icns` がフチなしに戻り、Dock で他アプリより一段大きく見えるようになる。

再生成は `npm run icons`（`tauri icon` の後に `icons:mac` が走り、`icon.icns` だけ Apple のアイコングリッド — 1024 キャンバスに本体 824x824、余白 100px、角丸半径 185.4px — に合わせて作り直す）。詳細は `scripts/gen-macos-icns.swift`。

## 動作確認

`npm run tauri dev` は `.app` を作らず生バイナリを起動するため、**Dock アイコンは `icon.icns` を反映しない**。アイコンの確認は `.app` を作って行う。

```bash
npm run tauri build -- --debug --bundles app
open src-tauri/target/debug/bundle/macos/lite-markdown.app
```
