import { writeFile } from "@tauri-apps/plugin-fs";
import type { EditorView } from "@codemirror/view";
import { state } from "./store";
import { mkdirSafe } from "./fs-utils";
import { withErrorNotice } from "./errors";
import { extFromMime } from "./mime";
import { imageLinkPath, joinPath, normalizeUrlPrefix, resolveImageDir } from "./utils";
import { readImageDir, readImageUrlPrefix } from "./prefs";
import { t } from "./i18n";

// ============================================================================
// 画像の貼り付け（設定されたフォルダに保存し、Markdown に挿入）
// ============================================================================
// 保存先は絶対パス（設定が無ければワークスペース直下の image）。本文に書くパスは
// プレフィックス設定で決まる（詳しくは utils.ts の imageLinkPath）。
// 別ウィンドウや古いバージョンが書いた値も届くので、読むときに毎回正規化する。

export async function insertPastedImage(file: File, v: EditorView): Promise<void> {
  const ws = state.workspace;
  if (!ws) return;
  await withErrorNotice(t("imageSaveFailed"), async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = `img-${Date.now()}.${extFromMime(file.type)}`;
    const dir = resolveImageDir(ws, readImageDir(ws));
    await mkdirSafe(dir);
    await writeFile(joinPath(dir, name), bytes);
    const prefix = normalizeUrlPrefix(readImageUrlPrefix(ws) ?? "");
    v.dispatch(v.state.replaceSelection(`![](${imageLinkPath(ws, dir, name, prefix)})`));
  });
}
