import { getVersion } from "@tauri-apps/api/app";
import { LS } from "./constants";
import { t, getLang, setLang, LANGS, type Lang } from "./i18n";
import { applyLanguage } from "./localize";
import { SHORTCUTS } from "./shortcuts";

// ============================================================================
// 設定ダイアログ（言語 / 自動更新 / ショートカット一覧）
// ============================================================================

// 自動更新のコードが入っているビルドかどうか（リリースビルドのみ 1）。
const UPDATER_BUILD = import.meta.env.VITE_UPDATER === "1";

// 自動更新は既定で有効。明示的に切ったときだけ "0" を保存する。
export const isAutoUpdateEnabled = (): boolean => localStorage.getItem(LS.autoUpdate) !== "0";

function setAutoUpdateEnabled(on: boolean): void {
  localStorage.setItem(LS.autoUpdate, on ? "1" : "0");
}

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

let overlay: HTMLDivElement | null = null;

export const settingsOpen = (): boolean => overlay !== null;

export function closeSettings(): void {
  overlay?.remove();
  overlay = null;
}

// 見出し付きのセクションを作る。
function section(titleText: string, ...children: Node[]): HTMLDivElement {
  const sec = document.createElement("div");
  sec.className = "sc-section";
  const head = document.createElement("div");
  head.className = "sc-section-title";
  head.textContent = titleText;
  sec.append(head, ...children);
  return sec;
}

// 「説明 + 操作部」の 1 行を作る。
function row(labelText: string, control?: Node): HTMLDivElement {
  const r = document.createElement("div");
  r.className = "sc-row";
  const desc = document.createElement("span");
  desc.className = "sc-desc";
  desc.textContent = labelText;
  r.append(desc);
  if (control) r.append(control);
  return r;
}

function languageSection(): HTMLDivElement {
  const select = document.createElement("select");
  select.className = "sc-select";
  for (const l of LANGS) {
    const opt = document.createElement("option");
    opt.value = l.value;
    opt.textContent = l.label;
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

function updateSection(): HTMLDivElement {
  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "sc-check";
  check.checked = UPDATER_BUILD && isAutoUpdateEnabled();
  // 更新機能を含まないビルドでは操作しても意味がないので触らせない。
  check.disabled = !UPDATER_BUILD;
  check.addEventListener("change", () => setAutoUpdateEnabled(check.checked));

  const rows = [row(t("autoUpdateLabel"), check)];
  if (appVersion) {
    const value = document.createElement("span");
    value.className = "sc-value";
    value.textContent = `v${appVersion}`;
    rows.unshift(row(t("versionLabel"), value));
  }

  const sec = section(t("sectionUpdate"), ...rows);
  if (!UPDATER_BUILD) {
    const note = document.createElement("div");
    note.className = "sc-note";
    note.textContent = t("autoUpdateUnavailable");
    sec.append(note);
  }
  return sec;
}

function shortcutsSection(): HTMLDivElement {
  const rows = SHORTCUTS.map((s) => {
    const keys = document.createElement("span");
    keys.className = "sc-keys";
    keys.textContent = s.keys;
    return row(t(s.descKey), keys);
  });
  return section(t("sectionShortcuts"), ...rows);
}

// ダイアログの中身を現在の設定値で組み立て直す。
function render(): void {
  if (!overlay) return;
  const dialog = document.createElement("div");
  dialog.className = "sc-dialog";

  const head = document.createElement("div");
  head.className = "sc-head";
  const title = document.createElement("div");
  title.className = "sc-title";
  title.textContent = t("settingsTitle");
  const close = document.createElement("button");
  close.className = "sc-close";
  close.textContent = "✕";
  close.title = t("tipClose");
  close.setAttribute("aria-label", t("tipClose"));
  close.addEventListener("click", () => closeSettings());
  head.append(title, close);

  dialog.append(head, languageSection(), updateSection(), shortcutsSection());
  overlay.replaceChildren(dialog);
}

export function openSettings(): void {
  if (overlay) return;
  const ov = document.createElement("div");
  ov.id = "sc-overlay";
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
