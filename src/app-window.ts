import { getCurrentWindow } from "@tauri-apps/api/window";
import { FULLSCREEN_SYNC_DEBOUNCE_MS } from "./constants";

// 自作タイトルバーやウィンドウ操作で使う現在のウィンドウ参照。
export const appWindow = getCurrentWindow();

// メモを別ウィンドウで開くと、同じフロントエンドが note-* ラベルで動く。
// 全ウィンドウで行うと困る処理（更新確認など）はこれで分ける。
export const isMainWindow = (): boolean => appWindow.label === "main";

// ============================================================================
// プラットフォームごとの見た目
// ============================================================================
// macOS だけはウィンドウ操作を OS に任せる（src-tauri/tauri.macos.conf.json の
// titleBarStyle: Overlay）。赤・黄・緑のボタンが自作タイトルバーの左上に重なって
// 描かれるので、こちらは重なる分の余白を空け、自作のボタンを隠す必要がある。
// 出し分けは CSS で行うため、<html> に印だけ付ける（テーマの data-theme と同じ形）。
export const isMac = navigator.userAgent.includes("Macintosh");

// フルスクリーン中は信号機ボタンが隠れるので、空けた余白も畳めるよう状態を持つ。
async function syncFullscreen(): Promise<void> {
  try {
    const full = await appWindow.isFullscreen();
    document.documentElement.dataset.fullscreen = String(full);
  } catch (e) {
    // 取れなくても余白が残るだけなので、画面には出さず記録だけ残す。
    console.error("フルスクリーン状態を取得できませんでした", e);
  }
}

export function applyPlatform(): void {
  if (!isMac) return;
  document.documentElement.dataset.os = "mac";
  void syncFullscreen();
  // フルスクリーンの出入りはリサイズとして届く。ドラッグ中も連続で来るため、
  // 落ち着いてから 1 回だけ問い合わせる。
  let timer: number | undefined;
  void appWindow.onResized(() => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void syncFullscreen(), FULLSCREEN_SYNC_DEBOUNCE_MS);
  });
}

// ============================================================================
// 起動時の表示
// ============================================================================
// ウィンドウは非表示で作られる（tauri.conf.json の visible: false）。
// 中身を描き終えてから出すことで、起動直後の白いちらつきを見せない。
// 呼び忘れ・失敗に備えて Rust 側にも時間切れで表示する保険がある。
let revealed = false;

export function revealWindow(): void {
  if (revealed) return;
  revealed = true;
  // 1 回目の rAF は描画前に走るので、実際に描き終えた次のフレームで出す。
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void (async () => {
        try {
          await appWindow.show();
          await appWindow.setFocus();
        } catch (e) {
          // 表示できなくても Rust 側の保険で出るため、画面には出さず記録だけ残す
          // （権限不足で黙って落ちると、保険が効く数秒間ウィンドウが出ない）。
          console.error("show() に失敗しました", e);
        }
      })();
    });
  });
}
