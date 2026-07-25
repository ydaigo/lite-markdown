import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./shortcuts";
import { DICT } from "./i18n";

describe("SHORTCUTS", () => {
  it("各項目に keys と、全言語で訳のある descKey が揃っている", () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.trim()).not.toBe("");
      for (const dict of Object.values(DICT)) {
        expect(dict[s.descKey].trim()).not.toBe("");
      }
    }
  });

  it("keys が重複していない", () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("主要ショートカットを含む", () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(keys).toContain("?");
    expect(keys.some((k) => k.includes("H"))).toBe(true);
    expect(keys.some((k) => k.includes("N"))).toBe(true);
  });
});
