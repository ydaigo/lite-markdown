import { writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { EditorView } from "@codemirror/view";
import { state } from "./store";
import { mkdirSafe } from "./fs-utils";
import { withErrorNotice } from "./errors";
import { extFromMime } from "./mime";
import { IMAGE_DIR } from "./constants";
import { t } from "./i18n";

// ============================================================================
// 画像の貼り付け（<workspace>/image/ に保存し、Markdown に挿入）
// ============================================================================

export async function insertPastedImage(file: File, v: EditorView): Promise<void> {
  if (!state.workspace) return;
  await withErrorNotice(t("imageSaveFailed"), async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = `img-${Date.now()}.${extFromMime(file.type)}`;
    const dir = await join(state.workspace, IMAGE_DIR);
    await mkdirSafe(dir);
    await writeFile(await join(dir, name), bytes);
    // 相対パスで参照（ノートフォルダごと移動しても壊れない）
    v.dispatch(v.state.replaceSelection(`![](${IMAGE_DIR}/${name})`));
  });
}
