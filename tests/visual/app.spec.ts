import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// Main window shell with a stubbed Tauri IPC layer. Anchors the Amber token +
// typography foundation and the atom components (Toggle / Slider / StatBar);
// grows into more per-tab shots as the v1.24 redesign lands.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(tauriMockInit);
});

test("main window — map tab shell", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#app *", { timeout: 15_000 });
  await page.waitForTimeout(600); // fonts + Leaflet settle
  await expect(page).toHaveScreenshot("app-map.png", { fullPage: false });
});

test("main window — settings tab (Toggle / Slider atoms)", async ({ page }) => {
  await page.goto("/#settings");
  await page.waitForSelector('input[type="range"]', { timeout: 15_000 });
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("app-settings.png", { fullPage: false });
});
