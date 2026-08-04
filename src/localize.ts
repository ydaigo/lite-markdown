import {
  btnNew,
  btnNewLabel,
  btnSearch,
  btnSettings,
  btnSidebar,
  btnTheme,
  btnToggle,
  btnUpdate,
  btnUpdateLabel,
  emptyEl,
  pvFindInput,
  pvFindPrev,
  pvFindNext,
  pvFindClose,
  pvResizeHandle,
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
// ツールチップを貼るボタンと、その文言のキー。
// aria が true のものはアイコンのみなので、読み上げ用の名前も同じ文言で付ける。
const TIPS: [HTMLElement, MsgKey, boolean?][] = [
  [btnSidebar, "tipSidebar"],
  [btnSearch, "tipSearch"],
  [btnTheme, "tipTheme"],
  [btnToggle, "tipToggleMode"],
  [btnUpdate, "tipUpdate"],
  [wsBtn, "tipWorkspace"],
  [btnNew, "tipNewNote"],
  [winMin, "tipMinimize", true],
  [winMax, "tipMaximize", true],
  [winClose, "tipClose", true],
  [pvFindPrev, "tipFindPrev", true],
  [pvFindNext, "tipFindNext", true],
  [pvFindClose, "tipClose", true],
  [pvResizeHandle, "tipPreviewWidth", true],
];

function applyStaticText(): void {
  for (const [target, key, aria] of TIPS) {
    target.title = t(key);
    if (aria) target.setAttribute("aria-label", t(key));
  }
  // 設定だけはキー表記を添える。
  btnSettings.title = `${t("tipSettings")} (?)`;

  btnNewLabel.textContent = t("newNote");
  // 更新中に切り替えた場合は進捗表示に戻る（次の進捗で上書きされる）。
  btnUpdateLabel.textContent = t("updateLabel");
  searchInputEl.placeholder = t("searchPlaceholder");
  pvFindInput.placeholder = t("pvFindPlaceholder");
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
