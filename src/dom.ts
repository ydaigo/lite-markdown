// ============================================================================
// DOM 要素の参照
// ============================================================================
// index.html の id はここだけに書く。各モジュールは名前で受け取るため、
// id を変えても直す箇所は 1 つで済む。

// 必須要素を ID で取得する。存在しなければ明示的にエラーにする（無言の null 参照を防ぐ）。
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素 #${id} が見つかりません`);
  return el as T;
};

export const appEl = $<HTMLDivElement>("app");
export const titlebarEl = $<HTMLElement>("titlebar");

// タイトルバー
export const btnSidebar = $<HTMLButtonElement>("btn-sidebar");
export const btnSearch = $<HTMLButtonElement>("btn-search");
export const btnSettings = $<HTMLButtonElement>("btn-settings");
export const btnToggle = $<HTMLButtonElement>("btn-toggle");
export const btnTheme = $<HTMLButtonElement>("btn-theme");
export const winMin = $<HTMLButtonElement>("win-min");
export const winMax = $<HTMLButtonElement>("win-max");
export const winClose = $<HTMLButtonElement>("win-close");

// サイドバー
export const wsBtn = $<HTMLButtonElement>("ws-btn");
export const wsNameEl = $<HTMLSpanElement>("ws-name");
export const wsMenuEl = $<HTMLDivElement>("ws-menu");
export const searchBarEl = $<HTMLDivElement>("search-bar");
export const searchInputEl = $<HTMLInputElement>("search-input");
export const btnNew = $<HTMLButtonElement>("btn-new");
export const btnNewLabel = $<HTMLSpanElement>("btn-new-label");
export const listEl = $<HTMLDivElement>("note-list");

// 本文エリア
export const editorEl = $<HTMLDivElement>("editor");
export const previewEl = $<HTMLElement>("preview");
export const emptyEl = $<HTMLDivElement>("empty-state");
