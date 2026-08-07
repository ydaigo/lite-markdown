import { getVersion } from "@tauri-apps/api/app";
import { homeDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { el } from "./dom";
import { state } from "./store";
import {
  isAutoUpdateEnabled,
  writeAutoUpdateEnabled,
  readImageDir,
  writeImageDir,
  readImageUrlPrefix,
  writeImageUrlPrefix,
  readFrontMatterEnabled,
  writeFrontMatterEnabled,
} from "./prefs";
import { isUnder, normalizeImageDir, normalizeUrlPrefix, resolveImageDir } from "./utils";
import { t, getLang, setLang, LANGS, type Lang } from "./i18n";
import { applyLanguage } from "./localize";
import { SHORTCUTS } from "./shortcuts";

// ============================================================================
// 設定ダイアログ（言語 / 画像 / 自動更新 / ショートカット一覧）
// ============================================================================

// 自動更新のコードが入っているビルドかどうか（リリースビルドのみ 1）。
const UPDATER_BUILD = import.meta.env.VITE_UPDATER === "1";

// 自動更新が効いたかを確かめる手がかりになるので、現在のバージョンを表示する。
// 起動中に変わらない値なので一度だけ取得し、届いたら開いているダイアログを描き直す。
let appVersion = "";
void getVersion()
  .then((v) => {
    appVersion = v;
    render();
  })
  .catch(() => {
    /* 取得できなければバージョン行を出さないだけ */
  });

// ホームフォルダ。画像の保存先がこの中かを確かめるのに使う。Tauri 側の権限
// （capabilities の fs スコープと assetProtocol の scope）が $HOME/** なので、
// 外を指定しても書き込みもプレビュー表示もできない。設定の時点で断る。
// 取得できるまでは空で、その間はこの確認を飛ばす（保存自体は Tauri 側が弾く）。
let home = "";
void homeDir()
  .then((h) => {
    home = h;
    render();
  })
  .catch(() => {
    /* 取得できなければホーム内かの確認をしないだけ */
  });

let overlay: HTMLDivElement | null = null;

export const settingsOpen = (): boolean => overlay !== null;

export function closeSettings(): void {
  overlay?.remove();
  overlay = null;
}

// 見出し付きのセクションを作る。
function section(titleText: string, ...children: Node[]): HTMLDivElement {
  const sec = el("div", "set-section");
  sec.append(el("div", "set-section-title", titleText), ...children);
  return sec;
}

// 「説明 + 操作部」の 1 行を作る。
function row(labelText: string, control?: Node): HTMLDivElement {
  const r = el("div", "set-row");
  r.append(el("span", "set-desc", labelText));
  if (control) r.append(control);
  return r;
}

function languageSection(): HTMLDivElement {
  const select = el("select", "set-select");
  for (const l of LANGS) {
    const opt = el("option", undefined, l.label);
    opt.value = l.value;
    opt.selected = l.value === getLang();
    select.append(opt);
  }
  select.addEventListener("change", () => {
    setLang(select.value as Lang);
    applyLanguage();
    render(); // ダイアログ自身も新しい言語で作り直す
  });
  return section(t("sectionLanguage"), row(t("langSelectLabel"), select));
}

// 長いパスを入れる行。420px の枠に「説明 + 操作部」を横並びで入れると入力欄が
// 狭すぎるので、説明の下に操作部を全幅で置く。
function stackRow(labelText: string, control: Node): HTMLDivElement {
  const r = el("div", "set-row set-row-stack");
  r.append(el("span", "set-desc", labelText), control);
  return r;
}

// 画像の保存先と、本文に書くパスの頭。どちらもワークスペースごとに覚えるので、
// ワークスペースが選ばれていなければ触らせない。
function imageSection(): HTMLDivElement {
  const ws = state.workspace;

  // 保存先の下に出す説明。受け付けられなかったときは理由に差し替える。
  const note = el("div", "set-note");
  const showNote = (text: string, isError = false): void => {
    note.textContent = text;
    note.classList.toggle("set-note-error", isError);
  };
  showNote(ws ? t("imageDirNote") : t("imageDirNoWorkspace"));

  // --- 保存先（絶対パス） ---
  const dirInput = el("input", "set-input");
  dirInput.type = "text";
  dirInput.disabled = !ws;
  // 未入力のときに使う既定（<ワークスペース>/image）を薄く見せる。
  dirInput.placeholder = ws ? resolveImageDir(ws) : "";

  // 今保存されている値を入力欄に映す。相対パスで保存されていた古い設定は、
  // 実際に使われる絶対パスの姿で見せる。未設定なら空にして placeholder に任せる。
  const showSaved = (): void => {
    const saved = ws ? readImageDir(ws) : undefined;
    dirInput.value = ws && saved ? resolveImageDir(ws, saved) : "";
  };
  showSaved();

  // 受け付けられない指定は保存せず、入力欄を今の設定に戻して理由を出す
  // （入力欄が常に「実際に効いている値」を映すようにする）。
  const applyDir = (value: string): void => {
    if (!ws) return;
    if (value.trim() === "") {
      writeImageDir(ws, ""); // 未設定に戻す（既定へ倒れる）
      dirInput.value = "";
      showNote(t("imageDirNote"));
      return;
    }
    const dir = normalizeImageDir(value);
    if (dir === "") {
      showSaved();
      showNote(t("imageDirInvalid"), true);
      return;
    }
    if (home !== "" && !isUnder(home, dir)) {
      showSaved();
      showNote(t("imageDirOutsideHome"), true);
      return;
    }
    writeImageDir(ws, dir);
    dirInput.value = dir;
    showNote(t("imageDirNote"));
  };
  // 確定（Enter / フォーカスが外れる）のたびに保存する。
  dirInput.addEventListener("change", () => applyDir(dirInput.value));

  // フォルダを選ばせる。手入力と同じ applyDir に通すので、選んだ先がホームの外
  // だった場合もここで断られる。
  async function pickDir(): Promise<void> {
    const picked = await open({ directory: true, multiple: false, title: t("imageDirPickTitle") });
    if (typeof picked === "string") applyDir(picked);
  }

  const browse = el("button", "set-btn", t("imageDirBrowse"));
  browse.disabled = !ws;
  browse.addEventListener("click", () => void pickDir());

  const dirCtl = el("div", "set-ctl");
  dirCtl.append(dirInput, browse);

  // --- 本文に書くパスの頭 ---
  const prefixInput = el("input", "set-input");
  prefixInput.type = "text";
  prefixInput.disabled = !ws;
  prefixInput.placeholder = t("imagePrefixPlaceholder");
  prefixInput.value = ws ? normalizeUrlPrefix(readImageUrlPrefix(ws) ?? "") : "";
  prefixInput.addEventListener("change", () => {
    if (!ws) return;
    const prefix = normalizeUrlPrefix(prefixInput.value);
    prefixInput.value = prefix;
    writeImageUrlPrefix(ws, prefix);
  });

  const prefixCtl = el("div", "set-ctl");
  prefixCtl.append(prefixInput);

  const sec = section(t("sectionImage"), stackRow(t("imageDirLabel"), dirCtl), note);
  sec.append(stackRow(t("imagePrefixLabel"), prefixCtl));
  if (ws) sec.append(el("div", "set-note", t("imagePrefixNote")));
  return sec;
}

// 新規メモを front matter の雛形から始めるか。Hugo の記事フォルダ向けなので、
// 画像の設定と同じくワークスペースごとに覚える。
function newNoteSection(): HTMLDivElement {
  const ws = state.workspace;
  const check = el("input", "set-check");
  check.type = "checkbox";
  check.disabled = !ws;
  check.checked = ws ? readFrontMatterEnabled(ws) : false;
  check.addEventListener("change", () => {
    if (ws) writeFrontMatterEnabled(ws, check.checked);
  });

  const sec = section(t("sectionNewNote"), row(t("frontMatterLabel"), check));
  sec.append(el("div", "set-note", ws ? t("frontMatterNote") : t("imageDirNoWorkspace")));
  return sec;
}

function updateSection(): HTMLDivElement {
  const check = el("input", "set-check");
  check.type = "checkbox";
  check.checked = UPDATER_BUILD && isAutoUpdateEnabled();
  // 更新機能を含まないビルドでは操作しても意味がないので触らせない。
  check.disabled = !UPDATER_BUILD;
  check.addEventListener("change", () => writeAutoUpdateEnabled(check.checked));

  const rows = [row(t("autoUpdateLabel"), check)];
  if (appVersion) {
    rows.unshift(row(t("versionLabel"), el("span", "set-value", `v${appVersion}`)));
  }

  const sec = section(t("sectionUpdate"), ...rows);
  if (!UPDATER_BUILD) sec.append(el("div", "set-note", t("autoUpdateUnavailable")));
  return sec;
}

function shortcutsSection(): HTMLDivElement {
  const rows = SHORTCUTS.map((s) => row(t(s.descKey), el("span", "set-keys", s.keys)));
  return section(t("sectionShortcuts"), ...rows);
}

// ダイアログの中身を現在の設定値で組み立て直す。
function render(): void {
  if (!overlay) return;

  const close = el("button", "set-close", "✕");
  close.title = t("tipClose");
  close.setAttribute("aria-label", t("tipClose"));
  close.addEventListener("click", () => closeSettings());

  const head = el("div", "set-head");
  head.append(el("div", "set-title", t("settingsTitle")), close);

  const dialog = el("div", "set-dialog");
  dialog.append(
    head,
    languageSection(),
    imageSection(),
    newNoteSection(),
    updateSection(),
    shortcutsSection(),
  );
  overlay.replaceChildren(dialog);
}

export function openSettings(): void {
  if (overlay) return;
  const ov = el("div");
  ov.id = "set-overlay";
  // 背景（オーバーレイ自身）クリックで閉じる。
  ov.addEventListener("click", (e) => {
    if (e.target === ov) closeSettings();
  });
  document.body.append(ov);
  overlay = ov;
  render();
}

export function toggleSettings(): void {
  if (overlay) closeSettings();
  else openSettings();
}
