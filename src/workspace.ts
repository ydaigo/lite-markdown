import { open } from "@tauri-apps/plugin-dialog";
import { homeDir, join } from "@tauri-apps/api/path";
import { state, notify } from "./store";
import { refreshNotes, selectNote, newNote, commitCurrent } from "./notes";
import { topNote } from "./pins";
import { showEmptyState } from "./view-modes";
import { watchWorkspace } from "./sync";
import { updateWsName } from "./sidebar";
import { mkdirSafe } from "./fs-utils";
import { allowDir, takeLaunchFiles } from "./native";
import { listenOpenFiles } from "./open-files";
import { openInNewWindow } from "./note-actions";
import { isMainWindow } from "./app-window";
import { showErrorFor } from "./errors";
import { dirName } from "./utils";
import {
  readWorkspaces,
  writeWorkspaces,
  readCurrentWorkspace,
  writeCurrentWorkspace,
  readLastNote,
} from "./prefs";
import { imageDirOf } from "./image-paths";
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
  // ホームの外のフォルダでも読み書きできるようにしてから触る。許可は保存されないので
  // 起動のたびに要る。画像の保存先はワークスペースの外を指せるので別に許可する
  // （プレビューで画像を表示するのにも要る）。
  await allowDir(path);
  await allowDir(imageDirOf(path));
  await mkdirSafe(path);
  state.workspace = path;
  state.currentPath = null;
  writeCurrentWorkspace(path);
  registerWorkspace(path);
  updateWsName();

  try {
    await refreshNotes();
  } catch (e) {
    // 消えたフォルダや権限のないフォルダを選んだ場合の保護。
    state.notes = [];
    showEmptyState();
    notify();
    showErrorFor(t("cannotOpenFolder"), e);
    return;
  }

  const last = preferNote ?? readLastNote(path);
  const top = topNote(state.notes);
  if (last && state.notes.some((n) => n.path === last)) {
    await selectNote(last);
  } else if (top) {
    // 前回開いていたメモが無ければ、表示順の先頭（ピンがあればそれ）を開く。
    await selectNote(top.path);
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
  // 起動中に「このアプリで開く」で渡されたファイルを受け取る（open-files.ts）。
  // 下の takeLaunchFiles より先に張る。後だと、その間に届いた分を取りこぼす。
  await listenOpenFiles();

  // 別ウィンドウで開かれた場合は URL でメモかワークスペースが指定される（note-actions.ts）。
  // メモは必ずワークスペース直下にあるので、その親フォルダを開く。
  const params = new URLSearchParams(location.search);
  const note = params.get("note");
  if (note) {
    await setWorkspace(dirName(note), note);
    return;
  }
  const ws = params.get("workspace");
  if (ws) {
    await setWorkspace(ws);
    return;
  }

  // OS の「このアプリで開く」で起動された場合は、そのファイルのフォルダを開いて
  // ファイルを選ぶ。複数渡されたら 2 件目以降は別ウィンドウで開く。
  if (isMainWindow()) {
    const [first, ...rest] = await takeLaunchFiles().catch(() => []);
    if (first) {
      await setWorkspace(dirName(first), first);
      for (const path of rest) void openInNewWindow(path);
      return;
    }
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
