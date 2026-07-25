import { describe, it, expect } from "vitest";
import { DICT, LANGS, localeOf, t } from "./i18n";

describe("i18n", () => {
  it("全言語が同じキー集合を持ち、空文言が無い", () => {
    const [base, ...rest] = Object.values(DICT);
    const baseKeys = Object.keys(base).sort();
    for (const dict of rest) {
      expect(Object.keys(dict).sort()).toEqual(baseKeys);
    }
    for (const dict of Object.values(DICT)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), key).not.toBe("");
      }
    }
  });

  it("選択肢は DICT に存在する言語だけを並べる", () => {
    for (const l of LANGS) {
      expect(DICT[l.value]).toBeDefined();
      expect(l.label.trim()).not.toBe("");
    }
    expect(LANGS.length).toBe(Object.keys(DICT).length);
  });

  it("言語ごとの Intl ロケールを返す", () => {
    expect(localeOf("ja")).toBe("ja-JP");
    expect(localeOf("en")).toBe("en-US");
  });

  it("t() は現在の言語の文言を返す", () => {
    // 既定（テスト環境では localStorage 未設定 → navigator.language 依存）でも
    // 何らかの言語の文言が引けることを確認する。
    expect(Object.values(DICT).map((d) => d.settingsTitle)).toContain(t("settingsTitle"));
  });
});
