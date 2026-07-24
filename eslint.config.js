import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // テストファイルとソースは src 配下のみ対象。
    files: ["src/**/*.ts"],
    rules: {
      // 未使用検出は tsconfig の noUnusedLocals/noUnusedParameters に一本化する。
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // 設定ファイル自体は Lint 対象外。
    ignores: ["dist/**", "src-tauri/**", "*.config.ts", "*.config.js"],
  },
);
