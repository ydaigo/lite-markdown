import { state } from "./store";
import { wsMenuEl, el } from "./dom";
import { openMenuUnder, type MenuItem } from "./context-menu";
import { openFolder } from "./note-actions";
import { setWorkspace, chooseWorkspaceFolder, removeWorkspaceFromHistory } from "./workspace";
import { baseName } from "./utils";
import { t } from "./i18n";

// ============================================================================
// ワークスペース切替メニュー（サイドバー上部）
// ============================================================================

// 履歴 1 件分に対する操作。開いているワークスペースは履歴から外せない。
function wsMenuItems(ws: string): MenuItem[] {
  const items: MenuItem[] = [{ label: t("menuOpenFolder"), action: () => void openFolder(ws) }];
  if (ws !== state.workspace) {
    items.push({
      label: t("menuRemoveFromHistory"),
      action: () => {
        removeWorkspaceFromHistory(ws);
        toggleWsMenu(true); // メニューは開いたまま作り直す
      },
    });
  }
  return items;
}

// 履歴 1 件分の行。切替のボタンと ⋯ は別々のボタンにする（button は入れ子にできない）。
function wsRow(ws: string): HTMLElement {
  const row = el("div", "ws-row");
  const b = el("button", "ws-item" + (ws === state.workspace ? " active" : ""));
  // フォルダ名とパスはそのまま表示する（textContent なのでエスケープ不要）。
  b.append(el("span", "ws-item-name", baseName(ws)), el("span", "ws-item-path", ws));
  b.addEventListener("click", () => {
    toggleWsMenu(false);
    if (ws !== state.workspace) void setWorkspace(ws);
  });

  const more = el("button", "ws-more", "⋯");
  more.title = t("menuMore");
  more.addEventListener("click", (e) => {
    // 切替メニューは開いたままにしたいので、外側クリックの購読へ伝えない
    // （events.ts の toggleWsMenu(false) と context-menu.ts の closeContextMenu）。
    e.stopPropagation();
    openMenuUnder(more, wsMenuItems(ws));
  });

  row.append(b, more);
  return row;
}

export function toggleWsMenu(show?: boolean): void {
  const willShow = show ?? wsMenuEl.hidden;
  if (!willShow) {
    wsMenuEl.hidden = true;
    return;
  }

  const choose = el("button", "ws-item ws-choose", t("chooseFolder"));
  choose.addEventListener("click", () => {
    toggleWsMenu(false);
    void chooseWorkspaceFolder();
  });

  wsMenuEl.replaceChildren(...state.workspaces.map(wsRow), el("div", "ws-sep"), choose);
  wsMenuEl.hidden = false;
}
