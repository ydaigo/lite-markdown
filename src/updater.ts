import { check, type Update } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { btnUpdate, btnUpdateLabel } from "./dom";
import { flushSave } from "./autosave";
import { showErrorFor, showToast } from "./errors";
import { t } from "./i18n";

// ============================================================================
// 自動更新
// ============================================================================
// 起動後に確認するだけで、ダウンロードもインストールもしない。新版が見つかったら
// タイトルバーにボタンを出し、ユーザーが押して同意したときに初めて適用する。
// 確認せずに入れると、Windows ではインストーラ起動と同時にプロセスが落とされ
// （tauri-plugin-updater の install_inner が std::process::exit する）、
// 入力中でもアプリが突然閉じて再起動してしまう。
//
// 適用後の挙動は OS で異なる:
//   Windows … インストーラが入れ替えてアプリを再起動する（install は戻らない）
//   macOS  … .app を差し替えるだけ。次回の起動から反映される

// 文言の出し分けにだけ使う（plugin-os は依存に入れていない）。
const isWindows = navigator.userAgent.includes("Windows");

let pending: Update | null = null;
let running = false;

// 起動後の確認。見つからない・確認できないときは何も出さない。
export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;
    pending = update;
    btnUpdate.addEventListener("click", () => void applyUpdate());
    btnUpdate.hidden = false;
  } catch {
    /* オフライン・endpoint 到達不可などは黙って無視 */
  }
}

// ボタンのラベルを進捗（0〜1）に差し替える。
function showProgress(ratio: number): void {
  btnUpdateLabel.textContent = `${t("updateDownloading")} ${Math.round(ratio * 100)}%`;
}

// ボタンを押せる状態に戻す（同意しなかったとき・失敗したとき）。
function resetButton(): void {
  btnUpdate.disabled = false;
  btnUpdateLabel.textContent = t("updateLabel");
}

// 同意を取ってから適用する。
async function applyUpdate(): Promise<void> {
  const update = pending;
  if (!update || running) return;

  const detail = `v${update.currentVersion} → v${update.version}`;
  const note = isWindows ? `\n\n${t("updateRestartNote")}` : "";
  const ok = await ask(`${detail}\n\n${t("updateConfirm")}${note}`, { title: t("appName") });
  // 断られてもボタンは出したままにする（あとから自分のタイミングで押せる）。
  if (!ok) return;

  running = true;
  btnUpdate.disabled = true;
  showProgress(0);

  try {
    let total = 0;
    let received = 0;
    await update.download((e) => {
      if (e.event === "Started") total = e.data.contentLength ?? 0;
      else if (e.event === "Progress") {
        received += e.data.chunkLength;
        if (total > 0) showProgress(received / total);
      }
    });
    // 入れ替えでプロセスが落ちるため、書き出していない編集をここで確定させる。
    await flushSave();
    await update.install();
    // Windows はここへ戻らない（インストーラ起動と同時に終了する）。
    // macOS は .app を差し替えて戻ってくるだけなので、ボタンを引っ込めて知らせる。
    pending = null;
    btnUpdate.hidden = true;
    showToast(t("updateAppliedNextLaunch"));
  } catch (e) {
    showErrorFor(t("updateFailed"), e);
    running = false;
    resetButton();
  }
}
