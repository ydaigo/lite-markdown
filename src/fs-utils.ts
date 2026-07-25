import { mkdir, stat } from "@tauri-apps/plugin-fs";

// ============================================================================
// ファイルシステム操作のヘルパ
// ============================================================================

// フォルダを作成する。既存フォルダなどは無視する（best-effort）。
export async function mkdirSafe(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    /* 既存フォルダなどは無視 */
  }
}

// ファイルの更新時刻(epoch ms)を返す。ファイルが無い / 読めないときは null。
// 「消えた」と「更新時刻を持たない(0)」を呼び出し側で区別できるようにしている。
export async function statMtime(path: string): Promise<number | null> {
  try {
    const s = await stat(path);
    return s.mtime ? new Date(s.mtime).getTime() : 0;
  } catch {
    return null;
  }
}
