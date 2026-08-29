import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A1 — the first-run wizard. It takes over the whole window while
// settings.onboarding_done is not true; the mock defaults it to true (returning
// user) so every other spec is unaffected, and this one opts back in.
test("first-run wizard — welcome step", async ({ page }) => {
  await page.addInitScript(tauriMockInit, {
    settings: { onboarding_done: false },
    canned: { data_status: { basemapMinimap: true, basemapFullmap: true, pois: true } },
  });
  await page.goto("/");
  await page.waitForSelector(".card", { timeout: 15_000 });
  await page.waitForTimeout(600); // fonts settle
  await expect(page).toHaveScreenshot("welcome.png", { fullPage: false });
});
