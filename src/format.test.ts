import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 「現在」を 2026-07-25 12:00（ローカル）に固定する。
    vi.setSystemTime(new Date(2026, 6, 25, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("0 は空文字を返す", () => {
    expect(formatDate(0)).toBe("");
  });

  it("当日は時刻(HH:MM)を返す", () => {
    const sameDay = new Date(2026, 6, 25, 9, 30, 0).getTime();
    expect(formatDate(sameDay)).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("別日は年を含む日付を返す", () => {
    const otherDay = new Date(2020, 0, 1, 9, 30, 0).getTime();
    expect(formatDate(otherDay)).toContain("2020");
  });
});
