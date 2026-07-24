// ============================================================================
// エラー表示と共通ハンドリング
// ============================================================================

// 予期しないエラーを画面上のバーに可視化（白画面化を防ぐ）。
export function showError(msg: string): void {
  let bar = document.getElementById("error-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "error-bar";
    document.body.appendChild(bar);
  }
  bar.textContent = "⚠ " + msg;
  bar.hidden = false;
}

// 未捕捉エラー/未処理 Promise 拒否を画面へ表示する。
export function registerGlobalErrorHandlers(): void {
  window.addEventListener("error", (e) => showError(e.message));
  window.addEventListener("unhandledrejection", (e) =>
    showError(String((e as PromiseRejectionEvent).reason)),
  );
}

// 非同期処理を実行し、失敗したらユーザーに通知する共通ラッパ。成功なら true。
export async function withErrorNotice(
  message: string,
  fn: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    showError(`${message}: ${String(e)}`);
    return false;
  }
}
