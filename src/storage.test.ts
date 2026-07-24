import { describe, it, expect, beforeEach, vi } from "vitest";
import { readJSON, writeJSON } from "./storage";

// node 環境には localStorage が無いため、最小限のモックを用意する。
function mockLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe("storage", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("writeJSON で書いた値を readJSON で読み戻せる", () => {
    writeJSON("k", { a: 1, b: ["x", "y"] });
    expect(readJSON("k", null)).toEqual({ a: 1, b: ["x", "y"] });
  });

  it("キーが無ければ fallback を返す", () => {
    expect(readJSON("missing", { fallback: true })).toEqual({ fallback: true });
  });

  it("壊れた JSON なら fallback を返す", () => {
    localStorage.setItem("broken", "{not json");
    expect(readJSON("broken", [])).toEqual([]);
  });

  it("配列も round-trip できる", () => {
    writeJSON("arr", ["a", "b", "c"]);
    expect(readJSON<string[]>("arr", [])).toEqual(["a", "b", "c"]);
  });
});
