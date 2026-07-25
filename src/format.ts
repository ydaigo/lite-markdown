// ============================================================================
// 日付表示（純粋関数）
// ============================================================================
// メモ一覧の更新時刻を表示する。当日は時刻、それ以外は日付。
// locale は表示言語に追従させる（呼び出し側から渡す）。
export function formatDate(ms: number, locale = "ja-JP"): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}
