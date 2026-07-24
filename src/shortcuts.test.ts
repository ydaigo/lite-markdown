import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./shortcuts";

describe("SHORTCUTS", () => {
  it("各項目に keys と description が揃っている", () => {
    for (const s of SHORTCUTS) {
      expect(s.keys.trim()).not.toBe("");
      expect(s.description.trim()).not.toBe("");
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
