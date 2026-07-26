import { DICT, LANGS, LOCALE, type Lang, type MsgKey } from "./messages";
import { readLang, writeLang } from "./prefs";

// ============================================================================
// 表示言語の解決と文言の取り出し
// ============================================================================
// 文言そのものは messages.ts が持つ。ここは「今どの言語か」だけを管理する。
// 文言の取得は t() 経由。モジュール初期化時ではなく呼び出し時に解決されるため、
// 言語切替後は再描画するだけで新しい文言に入れ替わる。

export { DICT, LANGS } from "./messages";
export type { Lang, MsgKey } from "./messages";

// 対応言語は LANGS が持つ（in 演算子だと "constructor" などが素通りしてしまう）。
const isLang = (v: string | null): v is Lang => LANGS.some((l) => l.value === v);

// 表示言語を決める（保存値 → OS/ブラウザの言語 → ja）。
// エディタ生成時にはもう確定している必要があるため、モジュール読み込み時に解決する。
function detectLang(): Lang {
  const saved = readLang();
  if (isLang(saved)) return saved;
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

let current: Lang = detectLang();

export const getLang = (): Lang => current;

// 現在の言語での文言を返す。
export const t = (key: MsgKey): string => DICT[current][key];

// Intl 用のロケール。日付表示に使う。
export const localeOf = (lang: Lang = current): string => LOCALE[lang];

// 言語を切り替えて保存する。DOM への反映は localize.ts の applyLanguage() が行う。
export function setLang(lang: Lang): void {
  current = lang;
  writeLang(lang);
}
