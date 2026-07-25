import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import { state, notify } from "./store";
import { wsMenuEl, el } from "./dom";
import { refreshNotes, selectNote, newNote, commitCurrent } from "./notes";
import { showEmptyState } from "./view-modes";
import { watchWorkspace } from "./sync";
import { updateWsName } from "./sidebar";
import { readJSON, writeJSON } from "./storage";
import { mkdirSafe } from "./fs-utils";
import { showErrorFor } from "./errors";
import { baseName, dirName } from "./utils";
import { LS, DEFAULT_WORKSPACE_DIR } from "./constants";
import { t } from "./i18n";

// ============================================================================
// ワークスペース（フォルダ）
// ============================================================================
function registerWorkspace(path: string): void {
  if (!state.workspaces.includes(path)) {
    state.workspaces.unshift(path);
    writeJSON(LS.workspaces, state.workspaces);
  }
}

// preferNote を渡すと、前回開いていたメモより優先してそれを開く
// （別ウィンドウで特定のメモを開く場合に使う）。
export async function setWorkspace(path: string, preferNote?: string): Promise<void> {
  await commitCurrent();
  await mkdirSafe(path);
  state.workspace = path;
  state.currentPath = null;
  // カレントワークスペースは生の文字列で保存。
  localStorage.setItem(LS.current, path);
  registerWorkspace(path);
  updateWsName();

  try {
    await refreshNotes();
  } catch (e) {
    // ホームフォルダ外など、読み取れないフォルダを選んだ場合の保護。
    state.notes = [];
    showEmptyState();
    notify();
    showErrorFor(t("cannotOpenFolder"), e);
    return;
  }

  const last = preferNote ?? readJSON<Record<string, string>>(LS.lastNote, {})[path];
  if (last && state.notes.some((n) => n.path === last)) {
    await selectNote(last);
  } else if (state.notes.length) {
    await selectNote(state.notes[0].path);
  } else {
    await newNote();
  }
  // 監視先を新しいワークスペースへ張り替える（外部の変更を取り込む）。
  void watchWorkspace();
  notify();
}

// 起動時の復元: 前回のワークスペース、無ければホーム直下の既定フォルダを開く。
export async function initWorkspace(): Promise<void> {
  state.workspaces = readJSON<string[]>(LS.workspaces, []);

  // 別ウィンドウで開かれた場合は URL でメモが指定される（note-actions.ts）。
  // メモは必ずワークスペース直下にあるので、その親フォルダを開く。
  const note = new URLSearchParams(location.search).get("note");
  if (note) {
    await setWorkspace(dirName(note), note);
    return;
  }

  const current = localStorage.getItem(LS.current);
  if (current) {
    await setWorkspace(current);
    return;
  }
  await setWorkspace(await join(await homeDir(), DEFAULT_WORKSPACE_DIR));
}

export async function chooseWorkspaceFolder(): Promise<void> {
  const dir = await open({ directory: true, multiple: false, title: t("chooseWorkspaceTitle") });
  if (typeof dir === "string") await setWorkspace(dir);
}

// ワークスペース切替メニュー
export function toggleWsMenu(show?: boolean): void {
  const willShow = show ?? wsMenuEl.hidden;
  if (!willShow) {
    wsMenuEl.hidden = true;
    return;
  }
  const items: HTMLElement[] = state.workspaces.map((ws) => {
    const b = el("button", "ws-item" + (ws === state.workspace ? " active" : ""));
    // フォルダ名とパスはそのまま表示する（textContent なのでエスケープ不要）。
    b.append(el("span", "ws-item-name", baseName(ws)), el("span", "ws-item-path", ws));
    b.addEventListener("click", () => {
      toggleWsMenu(false);
      if (ws !== state.workspace) void setWorkspace(ws);
    });
    return b;
  });

  const choose = el("button", "ws-item ws-choose", t("chooseFolder"));
  choose.addEventListener("click", () => {
    toggleWsMenu(false);
    void chooseWorkspaceFolder();
  });

  wsMenuEl.replaceChildren(...items, el("div", "ws-sep"), choose);
  wsMenuEl.hidden = false;
}
