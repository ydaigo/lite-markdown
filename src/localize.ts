import {
  btnNew,
  btnNewLabel,
  btnSearch,
  btnSettings,
  btnSidebar,
  btnTheme,
  btnToggle,
  emptyEl,
  searchInputEl,
  winClose,
  winMax,
  winMin,
  wsBtn,
} from "./dom";
import { t, getLang, type MsgKey } from "./i18n";
import { applyEditorLang } from "./editor";
import { renderList, updateWsName } from "./sidebar";
import { updateModeLabel, updateTitle } from "./view-modes";

// ============================================================================
// 表示言語を DOM 全体へ反映する
// ============================================================================
// index.html に直接書かれた静的ラベル（title 属性など）は起動時の既定値でしかない。
// 起動時と言語切替時にここでまとめて上書きする。
function applyStaticText(): void {
  // title だけを持つボタン。
  const tips: [HTMLElement, MsgKey][] = [
    [btnSidebar, "tipSidebar"],
    [btnSearch, "tipSearch"],
    [btnTheme, "tipTheme"],
    [btnToggle, "tipToggleMode"],
    [wsBtn, "tipWorkspace"],
    [btnNew, "tipNewNote"],
  ];
  for (const [el, key] of tips) el.title = t(key);
  btnSettings.title = `${t("tipSettings")} (?)`;

  // ウィンドウ操作はアイコンのみなので読み上げ用の名前も要る。
  const labeled: [HTMLElement, MsgKey][] = [
    [winMin, "tipMinimize"],
    [winMax, "tipMaximize"],
    [winClose, "tipClose"],
  ];
  for (const [el, key] of labeled) {
    el.title = t(key);
    el.setAttribute("aria-label", t(key));
  }

  btnNewLabel.textContent = t("newNote");
  searchInputEl.placeholder = t("searchPlaceholder");
  updateModeLabel();
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
