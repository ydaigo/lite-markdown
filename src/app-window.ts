import { getCurrentWindow } from "@tauri-apps/api/window";

// 自作タイトルバーやウィンドウ操作で使う現在のウィンドウ参照。
export const appWindow = getCurrentWindow();

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
