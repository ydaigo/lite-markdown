/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Tauri は開発時に固定ポートを期待するため、環境変数から調整可能にしておく。
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Tauri の CLI から起動されることを想定した最小設定。
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Rust 側の変更は Tauri が監視するので Vite の監視からは除外。
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tauri は esbuild のターゲットを WebView に合わせる。
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  // ユニットテストは DOM/Tauri 非依存の pure 関数が中心のため node 環境で実行。
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
