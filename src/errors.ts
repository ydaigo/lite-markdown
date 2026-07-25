// ============================================================================
// エラー表示と共通ハンドリング
// ============================================================================

// 通知用の要素は常時は要らないので、初回に作って以後は使い回す。
function notifyEl(id: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

// 予期しないエラーを画面上のバーに可視化（白画面化を防ぐ）。
export function showError(msg: string): void {
  const bar = notifyEl("error-bar");
  bar.textContent = "⚠ " + msg;
  bar.hidden = false;
}

// 「文言: 原因」の形に揃えてエラーバーへ出す。
export function showErrorFor(message: string, e: unknown): void {
  showError(`${message}: ${String(e)}`);
}

// 成功などの軽い一時通知（数秒で自動的に消える）。エラーバーとは別枠。
let toastTimer: number | undefined;
export function showToast(msg: string): void {
  const el = notifyEl("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (el) el.hidden = true;
  }, 1800);
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
    showErrorFor(message, e);
    return false;
  }
}
