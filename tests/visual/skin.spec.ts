import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A9 skins — the settings tab under the "Bioluminescent" ground palette, so a
// non-default `data-skin` block is regression-covered. The other specs keep
// the default (obsidian) since the mock omits `skin`.
test("settings tab — bioluminescent skin", async ({ page }) => {
  await page.addInitScript(tauriMockInit, { settings: { skin: "biolum" } });
  await page.goto("/#settings");
  await page.waitForSelector('input[type="range"]', { timeout: 15_000 });
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("settings-biolum.png", { fullPage: false });
});
