import { open } from "@tauri-apps/plugin-dialog";
import { state, notify } from "./store";
import { setDoc } from "./editor";
import { editorEl, emptyEl, wsMenuEl } from "./dom";
import { refreshNotes, selectNote, newNote, commitCurrent } from "./notes";
import { updateWsName } from "./sidebar";
import { readJSON, writeJSON } from "./storage";
import { mkdirSafe } from "./fs-utils";
import { showError } from "./errors";
import { baseName } from "./utils";
import { LS } from "./constants";
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

export async function setWorkspace(path: string): Promise<void> {
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
    setDoc("");
    editorEl.hidden = true;
    emptyEl.hidden = false;
    notify();
    showError(`${t("cannotOpenFolder")}: ${String(e)}`);
    return;
  }

  const last = readJSON<Record<string, string>>(LS.lastNote, {})[path];
  if (last && state.notes.some((n) => n.path === last)) {
    await selectNote(last);
  } else if (state.notes.length) {
    await selectNote(state.notes[0].path);
  } else {
    await newNote();
  }
  notify();
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
