# Tauri v2 updater 導入設計（nightly 自動更新）

- 日付: 2026-07-24
- 対象: lite-markdown（Tauri v2 / 未署名）

## 目的

配布済みアプリを、ユーザー操作なしで最新の nightly ビルドへ自動更新できるようにする。

## 更新チャンネルとバージョン戦略

- 更新チャンネルは **nightly**（固定タグ、毎 push 上書き）。
- Tauri updater は semver 比較で新旧を判定するため、nightly でも version を単調増加させる必要がある。
- CI で build 前に version を **`0.1.<github.run_number>`** に書き換える。
  - patch が単調増加し、`0.1.42 → 0.1.43` を確実に「新版」と判定できる。
  - `0.1.0+<日付>` 形式はビルドメタデータが semver 比較で無視され機能しないため不採用。

## UX

- 起動 ~3 秒後に `check()` を実行。
- 新版があれば確認ダイアログなしで `downloadAndInstall()` を無音実行。
- macOS は次回起動で自然に適用。Windows は NSIS を静かにインストール。
- エラーは握りつぶし、通常のメモ利用を阻害しない。

## 署名（minisign / updater 用・OS コード署名とは別）

- ローカルで `tauri signer generate` により鍵ペアを生成。
- 公開鍵 → `tauri.conf.json` の `plugins.updater.pubkey`（コミット可）。
- 秘密鍵＋パスワード → GitHub Secrets `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
- 秘密鍵はリポジトリにコミットしない。

## 設定変更

### tauri.conf.json
- `bundle.createUpdaterArtifacts: true`（`.sig` と更新用バンドルを生成）。
- `bundle.windows.nsis.installMode: "currentUser"`（UAC を出さず無音更新するため）。
- `plugins.updater.pubkey`（公開鍵）。
- `plugins.updater.endpoints`: `https://github.com/ydaigo/lite-markdown/releases/download/nightly/latest.json`。
- Windows の更新ターゲットは NSIS(.exe) のみ（updater は msi 非対応）。.msi/.dmg は新規 DL 用に従来通り残す。

### capabilities/default.json
- `updater:default` 権限を追加。

### Cargo.toml
- `tauri-plugin-updater = "2"` を追加し、`lib.rs`（または `main.rs`）でプラグイン登録。

### package.json
- `@tauri-apps/plugin-updater` を追加。

### src/main.ts
- 起動時に updater を呼ぶ初期化処理を追加。

## CI（.github/workflows/nightly.yml）

- build ジョブ: version を `0.1.<run_number>` に注入するステップを追加し、署名用 env を渡す。
- publish ジョブ: 各プラットフォームの `.sig` と DL URL から `latest.json` を生成し、
  installer 群と一緒に `nightly` タグへ上書き公開。
- 現行の「matrix build → 単一 publish」の構造は維持（同一タグへの並行書き込み競合を避ける）。

## 制約（既知・許容）

1. **既存インストール済みアプリは自動更新されない。** updater プラグインと公開鍵はビルドに埋め込まれて初めて機能するため、
   updater 対応版の nightly を 1 回だけ手動 DL する必要がある。以降は自動更新が有効。
2. **Windows の完全無音更新は per-user インストール（currentUser）が前提。** 上記「1 回だけ手動 DL」時に per-user へ切り替わる。
   以降は UAC なしで静かに更新できる。

## テスト

- ローカル `tauri build` で `.sig` と更新用バンドルが生成されることを確認。
- 実 E2E（旧版→新版の自動更新）は CI で nightly を 2 回まわし、実機で確認。
