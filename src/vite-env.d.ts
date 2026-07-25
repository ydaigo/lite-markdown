/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** nightly ビルドのみ "1"。自動更新の有効/無効を切り替える。 */
  readonly VITE_UPDATER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
