import { vi } from "vitest";

// ============================================================================
// ユニットテスト共通の下準備
// ============================================================================
// テストは node 環境で走るため、WebView なら必ず存在する DOM 由来の API が無い。
// i18n が読み込み時に参照するものだけ、最小限のスタブを用意する。
const store = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

vi.stubGlobal("navigator", { language: "ja-JP" });
