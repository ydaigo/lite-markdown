import { describe, it, expect } from "vitest";
import { extFromMime } from "./mime";

describe("extFromMime", () => {
  it("既知の MIME を拡張子に変換する", () => {
    expect(extFromMime("image/png")).toBe("png");
    expect(extFromMime("image/jpeg")).toBe("jpg");
    expect(extFromMime("image/gif")).toBe("gif");
    expect(extFromMime("image/webp")).toBe("webp");
    expect(extFromMime("image/svg+xml")).toBe("svg");
    expect(extFromMime("image/bmp")).toBe("bmp");
  });

  it("未知の image/* はサブタイプをそのまま使う", () => {
    expect(extFromMime("image/tiff")).toBe("tiff");
  });

  it("スラッシュを含まない値は png にフォールバック", () => {
    expect(extFromMime("weird")).toBe("png");
  });

  it("空文字は png にフォールバック", () => {
    expect(extFromMime("")).toBe("png");
  });
});
