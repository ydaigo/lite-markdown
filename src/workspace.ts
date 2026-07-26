import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import { state, notify } from "./store";
import { refreshNotes, selectNote, newNote, commitCurrent } from "./notes";
import { showEmptyState } from "./view-modes";
import { watchWorkspace } from "./sync";
import { updateWsName } from "./sidebar";
import { mkdirSafe } from "./fs-utils";
import { showErrorFor } from "./errors";
import { dirName } from "./utils";
import {
  readWorkspaces,
  writeWorkspaces,
  readCurrentWorkspace,
  writeCurrentWorkspace,
  readLastNote,
} from "./prefs";
import { DEFAULT_WORKSPACE_DIR } from "./constants";
import { t } from "./i18n";

// ============================================================================
// ワークスペース（フォルダ）の選択と履歴
// ============================================================================
// 切替メニューの見た目は workspace-menu.ts が持つ。ここは状態と永続化だけを扱う。

function registerWorkspace(path: string): void {
  if (state.workspaces.includes(path)) return;
  state.workspaces.unshift(path);
  writeWorkspaces(state.workspaces);
}

// 履歴から外す。フォルダとメモには触らない。
// 開いているワークスペースは対象外（起動時の復元で registerWorkspace が戻すため）。
export function removeWorkspaceFromHistory(path: string): void {
  if (path === state.workspace) return;
  state.workspaces = state.workspaces.filter((w) => w !== path);
  writeWorkspaces(state.workspaces);
}

// preferNote を渡すと、前回開いていたメモより優先してそれを開く
// （別ウィンドウで特定のメモを開く場合に使う）。
export async function setWorkspace(path: string, preferNote?: string): Promise<void> {
  await commitCurrent();
  await mkdirSafe(path);
  state.workspace = path;
  state.currentPath = null;
  writeCurrentWorkspace(path);
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

  const last = preferNote ?? readLastNote(path);
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
  state.workspaces = readWorkspaces();

  // 別ウィンドウで開かれた場合は URL でメモが指定される（note-actions.ts）。
  // メモは必ずワークスペース直下にあるので、その親フォルダを開く。
  const note = new URLSearchParams(location.search).get("note");
  if (note) {
    await setWorkspace(dirName(note), note);
    return;
  }

  const current = readCurrentWorkspace();
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
