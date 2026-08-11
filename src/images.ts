import { writeFile } from "@tauri-apps/plugin-fs";
import type { EditorView } from "@codemirror/view";
import { state } from "./store";
import { mkdirSafe } from "./fs-utils";
import { allowDir } from "./native";
import { withErrorNotice } from "./errors";
import { extFromMime } from "./mime";
import { imageLinkPath, joinPath } from "./utils";
import { imageDirOf, imageUrlPrefixOf } from "./image-paths";
import { t } from "./i18n";

// ============================================================================
// 画像の貼り付け（設定されたフォルダに保存し、Markdown に挿入）
// ============================================================================
// 保存先は絶対パス（設定が無ければワークスペース直下の image）。本文に書くパスは
// プレフィックス設定で決まる（詳しくは utils.ts の imageLinkPath）。設定の読み取りは
// image-paths.ts に寄せてある。

export async function insertPastedImage(file: File, v: EditorView): Promise<void> {
  const ws = state.workspace;
  if (!ws) return;
  await withErrorNotice(t("imageSaveFailed"), async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = `img-${Date.now()}.${extFromMime(file.type)}`;
    const dir = imageDirOf(ws);
    // 保存先はホームの外を指せる。書く直前に許可しておく（設定直後や別ウィンドウで
    // 変えられた場合に、まだ許可されていないことがある）。
    await allowDir(dir);
    await mkdirSafe(dir);
    await writeFile(joinPath(dir, name), bytes);
    const prefix = imageUrlPrefixOf(ws);
    v.dispatch(v.state.replaceSelection(`![](${imageLinkPath(ws, dir, name, prefix)})`));
  });
}
