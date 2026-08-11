import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Rust 側のコマンド（src-tauri/src/commands.rs）
// ============================================================================
// プラグインでは足りない 2 つだけを自前のコマンドにしている。どちらも「ホームの外の
// フォルダを扱う」ためのもの。コマンド名と引数の形を知っているのはこのモジュールだけ。

// 一度許可したフォルダ。実行時スコープは足すだけで消えないので、二度目からは
// 呼ばずに済ませる（ワークスペース切替や画像の貼り付けのたびに呼べるようにする）。
const allowed = new Set<string>();

// フォルダを読み書きできるようにする。既定で許されているのはホーム配下だけなので、
// ホームの外のフォルダを触る前に呼ぶ。許可はプロセスを終えると消えるため、起動の
// たびに要る。失敗しても止めない（この後の読み書きが失敗し、そちらで理由が出る）。
export async function allowDir(dir: string): Promise<void> {
  if (allowed.has(dir)) return;
  try {
    await invoke("allow_dir", { path: dir });
    allowed.add(dir);
  } catch {
    /* 許可できなければ、この後の読み書きが弾かれるだけ */
  }
}

// OS のファイルマネージャ（Finder / エクスプローラー）でフォルダの中身を開く。
// opener プラグインの JS API はホーム配下しか開けない（スコープを capabilities で
// しか指定できず、実行時に足せない）ので、Rust 側から開く。
export const openDir = (dir: string): Promise<void> => invoke("open_dir", { path: dir });
