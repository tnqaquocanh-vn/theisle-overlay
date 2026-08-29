import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import pkg from "./package.json";

// Four entries: the main window, the tiny canvas-only minimap overlay, the
// in-game big map (v1.25), and the second-monitor companion dashboard (A7,
// v1.27). Vite/Rollup share the Leaflet + Svelte chunks across main + bigmap
// + companion.
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  define: {
    // Compile-time so the footer needs no IPC (and no permission) to show it.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        minimap: fileURLToPath(new URL("./minimap.html", import.meta.url)),
        bigmap: fileURLToPath(new URL("./bigmap.html", import.meta.url)),
        companion: fileURLToPath(new URL("./companion.html", import.meta.url)),
      },
    },
  },
  // Tauri dev server conventions.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
})
