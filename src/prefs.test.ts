import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isAutoUpdateEnabled,
  writeAutoUpdateEnabled,
  readLastNote,
  writeLastNote,
  readWorkspaces,
  writeWorkspaces,
  readTheme,
  writeTheme,
  readPreviewWidth,
  writePreviewWidth,
  readImageDir,
  writeImageDir,
} from "./prefs";

// node 環境には localStorage が無いため、テストごとに空のモックへ差し替える。
function mockLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe("prefs", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it("未保存のテーマは null（呼び出し側が既定を決める）", () => {
    expect(readTheme()).toBeNull();
    writeTheme("dark");
    expect(readTheme()).toBe("dark");
  });

  it("自動更新は既定で有効で、切ったときだけ無効になる", () => {
    expect(isAutoUpdateEnabled()).toBe(true);
    writeAutoUpdateEnabled(false);
    expect(isAutoUpdateEnabled()).toBe(false);
    writeAutoUpdateEnabled(true);
    expect(isAutoUpdateEnabled()).toBe(true);
  });

  it("ワークスペース一覧を round-trip できる", () => {
    expect(readWorkspaces()).toEqual([]);
    writeWorkspaces(["/a", "/b"]);
    expect(readWorkspaces()).toEqual(["/a", "/b"]);
  });

  it("最後に開いたメモをワークスペースごとに覚える", () => {
    expect(readLastNote("/ws1")).toBeUndefined();
    writeLastNote("/ws1", "/ws1/a.md");
    writeLastNote("/ws2", "/ws2/b.md");
    expect(readLastNote("/ws1")).toBe("/ws1/a.md");
    expect(readLastNote("/ws2")).toBe("/ws2/b.md");
  });

  it("同じワークスペースへの上書きは他を消さない", () => {
    writeLastNote("/ws1", "/ws1/a.md");
    writeLastNote("/ws2", "/ws2/b.md");
    writeLastNote("/ws1", "/ws1/c.md");
    expect(readLastNote("/ws1")).toBe("/ws1/c.md");
    expect(readLastNote("/ws2")).toBe("/ws2/b.md");
  });

  it("未保存のプレビュー幅は null で、round-trip できる", () => {
    expect(readPreviewWidth()).toBeNull();
    writePreviewWidth(1024);
    expect(readPreviewWidth()).toBe(1024);
  });

  it("プレビュー幅は整数に丸めて保存する", () => {
    writePreviewWidth(860.6);
    expect(readPreviewWidth()).toBe(861);
  });

  it("画像の保存先をワークスペースごとに覚える", () => {
    expect(readImageDir("/ws1")).toBeUndefined();
    writeImageDir("/ws1", "image");
    writeImageDir("/ws2", "static/images");
    expect(readImageDir("/ws1")).toBe("image");
    expect(readImageDir("/ws2")).toBe("static/images");
  });

  it("空文字を書くと未設定に戻る（他のワークスペースは残る）", () => {
    writeImageDir("/ws1", "image");
    writeImageDir("/ws2", "static/images");
    writeImageDir("/ws1", "");
    expect(readImageDir("/ws1")).toBeUndefined();
    expect(readImageDir("/ws2")).toBe("static/images");
  });

  it("数として読めないプレビュー幅は未保存と同じ扱い", () => {
    localStorage.setItem("lm.previewWidth", "abc");
    expect(readPreviewWidth()).toBeNull();
    // Number("") は 0 になるので、0 以下も弾いていることを確かめる。
    localStorage.setItem("lm.previewWidth", "");
    expect(readPreviewWidth()).toBeNull();
    localStorage.setItem("lm.previewWidth", "-100");
    expect(readPreviewWidth()).toBeNull();
  });
});
