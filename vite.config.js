import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1430,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`, and the release build outputs (`npm run exe` 가 쓰는 build/·target/ —
      //    이걸 지켜보면 개발 앱이 릴리스 빌드 중에 계속 다시 불러와 멈춘 것처럼 보인다)
      ignored: ["**/src-tauri/**", "**/build/**", "**/target/**", "**/maps/**", "**/docs/**"],
    },
  },
}));
