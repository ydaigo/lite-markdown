// ============================================================================
// localStorage への JSON 読み書きヘルパ
// ============================================================================

// JSON をパースして読み取る。壊れている/無い場合は fallback を返す。
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// 値を JSON 文字列化して書き込む。
export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
