// ============================================================================
// DOM 要素の参照
// ============================================================================

// 必須要素を ID で取得する。存在しなければ明示的にエラーにする（無言の null 参照を防ぐ）。
export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素 #${id} が見つかりません`);
  return el as T;
};

export const editorEl = $<HTMLDivElement>("editor");
export const previewEl = $<HTMLElement>("preview");
export const emptyEl = $<HTMLDivElement>("empty-state");
export const listEl = $<HTMLDivElement>("note-list");
export const wsNameEl = $<HTMLSpanElement>("ws-name");
export const wsMenuEl = $<HTMLDivElement>("ws-menu");
export const btnToggle = $<HTMLButtonElement>("btn-toggle");
export const btnTheme = $<HTMLButtonElement>("btn-theme");
export const appEl = $<HTMLDivElement>("app");
export const searchBarEl = $<HTMLDivElement>("search-bar");
export const searchInputEl = $<HTMLInputElement>("search-input");
