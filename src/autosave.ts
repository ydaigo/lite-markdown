import { writeTextFile } from "@tauri-apps/plugin-fs";
import { state, notify, sortNotes, findNote } from "./store";
import { getDoc, isDocDirty, markDocSaved } from "./editor";
import { deriveMeta } from "./meta";
import { updateTitle } from "./view-modes";
import { withErrorNotice } from "./errors";
import { SAVE_DEBOUNCE_MS } from "./constants";
import { t } from "./i18n";

// ============================================================================
// 自動保存
// ============================================================================
// 入力が止まったら書き出す。保存操作は UI に出さない。

// 保存待ちのタイマー。「待ちが無い」ことを外から見分けられるよう undefined へ戻す
// （外部の変更を取り込むかどうかの判断に使う → sync.ts）。
let saveTimer: number | undefined;

// まだ書き出していない編集が残っているか。
export const hasPendingSave = (): boolean => saveTimer !== undefined;

// 予約済みの保存を取り消す（メモを離れるとき・即時に書き出すとき）。
export function cancelScheduledSave(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
}

export function scheduleSave(): void {
  cancelScheduledSave();
  saveTimer = window.setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
}

// 現在のメモを書き込み、一覧のメタを更新して先頭へ並べ替える。
// 内容が変わっていなければ何もしない（開いただけのメモを更新扱いにしない）。
export async function flushSave(): Promise<void> {
  cancelScheduledSave();
  const path = state.currentPath;
  if (!path || !isDocDirty()) return;
  const text = getDoc();
  const ok = await withErrorNotice(t("saveFailed"), () => writeTextFile(path, text));
  if (!ok) return;
  markDocSaved(text);

  const meta = findNote(path);
  if (!meta) return;
  const derived = deriveMeta(text);
  const titleChanged = meta.title !== derived.title;
  meta.title = derived.title;
  meta.snippet = derived.snippet;
  meta.mtime = Date.now();
  meta.hay = text.toLowerCase();
  sortNotes();
  notify();
  // ウィンドウ名の書き換えは Rust への呼び出しなので、変わったときだけ行う
  // （自動保存は入力中ずっと走る）。
  if (titleChanged) void updateTitle();
}
