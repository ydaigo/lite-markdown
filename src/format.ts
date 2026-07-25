// ============================================================================
// 日付表示（純粋関数）
// ============================================================================
// メモ一覧の更新時刻を表示する。当日は時刻、それ以外は日付。
// locale は表示言語に追従させる（呼び出し側から渡す）。

// Intl の生成は安くないうえ、一覧の再描画ごとに全件ぶん必要になる。
// ロケールと形式の組み合わせは数種類しかないので使い回す。
const TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const DATE: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, sameDay: boolean): Intl.DateTimeFormat {
  const key = (sameDay ? "t:" : "d:") + locale;
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, sameDay ? TIME : DATE);
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatDate(ms: number, locale = "ja-JP"): string {
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return formatter(locale, sameDay).format(d);
}
