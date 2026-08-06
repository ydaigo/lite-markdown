import { writeFile } from "@tauri-apps/plugin-fs";
import type { EditorView } from "@codemirror/view";
import { state } from "./store";
import { mkdirSafe } from "./fs-utils";
import { withErrorNotice } from "./errors";
import { extFromMime } from "./mime";
import { joinPath, normalizeImageDir, resolvePath } from "./utils";
import { readImageDir } from "./prefs";
import { IMAGE_DIR } from "./constants";
import { t } from "./i18n";

// ============================================================================
// 画像の貼り付け（ワークスペース内のフォルダに保存し、Markdown に挿入）
// ============================================================================

// 画像を保存するフォルダ（ワークスペースからの相対パス）。
// 設定が無い、または外へ出る指定が保存されていれば既定へ倒す。書くときに
// 正規化しているが、別ウィンドウや古いバージョンが書いた値も通るので読む側でも見る。
const imageDirOf = (workspace: string): string =>
  normalizeImageDir(readImageDir(workspace) ?? "") || IMAGE_DIR;

export async function insertPastedImage(file: File, v: EditorView): Promise<void> {
  if (!state.workspace) return;
  await withErrorNotice(t("imageSaveFailed"), async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = `img-${Date.now()}.${extFromMime(file.type)}`;
    const rel = imageDirOf(state.workspace);
    // 入れ子（static/images）も外向き（../static/images）も指定できるので、
    // .. を畳んだ絶対パスにしてから渡す。
    const dir = resolvePath(state.workspace, rel);
    await mkdirSafe(dir);
    await writeFile(joinPath(dir, name), bytes);
    // 本文には相対パスで書く（ノートフォルダごと移動しても壊れない）
    v.dispatch(v.state.replaceSelection(`![](${rel}/${name})`));
  });
}
