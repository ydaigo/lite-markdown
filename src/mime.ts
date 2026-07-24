// ============================================================================
// MIME タイプ → 拡張子（純粋関数）
// ============================================================================
export function extFromMime(type: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
  };
  return map[type] || type.split("/")[1] || "png";
}
