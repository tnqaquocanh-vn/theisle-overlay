import { defineConfig, devices } from "@playwright/test";

// Visual-regression harness (plan "Bản thiết kế Amber", item B2). The Amber
// redesign touches every pixel; `cargo test` + `svelte-check` prove nothing
// visual. These specs boot the Vite dev server, stub the Tauri IPC layer with
// canned data (tests/visual/tauri-mock.ts), and screenshot each surface.
//
//   npm run test:visual            compare against committed baselines
//   npm run test:visual:update     regenerate baselines (run once per real change)
//
// Baselines are per-OS; commit the ones for your dev OS and let CI regenerate
// or skip on a mismatched runner until a Linux baseline set exists.
export default defineConfig({
  testDir: "./tests/visual",
  snapshotDir: "./tests/visual/__screenshots__",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
  },
  expect: {
    // Fonts + sub-pixel AA vary slightly between machines; a small tolerance
    // keeps the check meaningful without being flaky.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
