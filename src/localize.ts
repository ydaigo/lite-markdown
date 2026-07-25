import { $, btnToggle, emptyEl, searchInputEl } from "./dom";
import { state } from "./store";
import { t, getLang } from "./i18n";
import { applyEditorLang } from "./editor";
import { renderList, updateWsName } from "./sidebar";
import { updateTitle } from "./view-modes";

// ============================================================================
// 表示言語を DOM 全体へ反映する
// ============================================================================
// index.html に直接書かれた静的ラベル（title 属性など）は起動時の既定値でしかない。
// 起動時と言語切替時にここでまとめて上書きする。
function applyStaticText(): void {
  $<HTMLButtonElement>("btn-sidebar").title = t("tipSidebar");
  $<HTMLButtonElement>("btn-search").title = t("tipSearch");
  $<HTMLButtonElement>("btn-settings").title = `${t("tipSettings")} (?)`;
  $<HTMLButtonElement>("btn-theme").title = t("tipTheme");
  $<HTMLButtonElement>("ws-btn").title = t("tipWorkspace");
  $<HTMLButtonElement>("btn-new").title = t("tipNewNote");
  $<HTMLSpanElement>("btn-new-label").textContent = t("newNote");
  searchInputEl.placeholder = t("searchPlaceholder");

  for (const [id, key] of [
    ["win-min", "tipMinimize"],
    ["win-max", "tipMaximize"],
    ["win-close", "tipClose"],
  ] as const) {
    const b = $<HTMLButtonElement>(id);
    b.title = t(key);
    b.setAttribute("aria-label", t(key));
  }

  // モード切替ボタンは「切り替えた先」を表示する。
  btnToggle.title = t("tipToggleMode");
  btnToggle.textContent = state.mode === "preview" ? t("editLabel") : t("previewLabel");

  emptyEl.replaceChildren(t("emptyStateTitle"), document.createElement("br"), t("emptyStateHint"));
}

// 言語に依存する表示をすべて作り直す。
export function applyLanguage(): void {
  document.documentElement.lang = getLang();
  applyStaticText();
  applyEditorLang();
  updateWsName();
  renderList(); // 日付フォーマットと「該当なし」表記も言語に追従する
  void updateTitle();
}
