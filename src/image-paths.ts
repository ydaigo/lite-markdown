import { readImageDir, readImageUrlPrefix } from "./prefs";
import { normalizeUrlPrefix, resolveImageDir } from "./utils";

// ============================================================================
// ワークスペースごとの画像設定（保存先 / 本文に書くパスの頭）
// ============================================================================
// 保存されている値は正規化されているとは限らない（別ウィンドウや古いバージョンが
// 書いた値も届く）。貼り付け・プレビュー・スコープの許可が同じ場所を指すように、
// 設定を読むのはこの 2 つを通してだけにする。正規化そのものは utils.ts。

// 画像の保存先（絶対パス）。未設定ならワークスペース直下の image。
export const imageDirOf = (workspace: string): string =>
  resolveImageDir(workspace, readImageDir(workspace));

// 本文に書く画像パスの頭。未設定なら ""（相対パスを書く）。
export const imageUrlPrefixOf = (workspace: string): string =>
  normalizeUrlPrefix(readImageUrlPrefix(workspace) ?? "");
