import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import { state, notify } from "./store";
import { wsMenuEl } from "./dom";
import { refreshNotes, selectNote, newNote, commitCurrent } from "./notes";
import { showEmptyState } from "./view-modes";
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
  wsMenuEl.replaceChildren();
  for (const ws of state.workspaces) {
    const b = document.createElement("button");
    b.className = "ws-item" + (ws === state.workspace ? " active" : "");
    b.innerHTML = `<span class="ws-item-name">${baseName(ws)}</span><span class="ws-item-path">${ws}</span>`;
    b.addEventListener("click", () => {
      toggleWsMenu(false);
      if (ws !== state.workspace) void setWorkspace(ws);
    });
    wsMenuEl.append(b);
  }
  const sep = document.createElement("div");
  sep.className = "ws-sep";
  wsMenuEl.append(sep);
  const choose = document.createElement("button");
  choose.className = "ws-item ws-choose";
  choose.textContent = t("chooseFolder");
  choose.addEventListener("click", () => {
    toggleWsMenu(false);
    void chooseWorkspaceFolder();
  });
  wsMenuEl.append(choose);
  wsMenuEl.hidden = false;
}
