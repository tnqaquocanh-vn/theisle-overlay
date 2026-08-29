import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// The minimap overlay with a stubbed Tauri layer: no position sample has
// arrived, so it paints its "hint disc" (press Tab, click Asset Location…).
// Deterministic, and it exercises the Amber disc geometry + hint typography.
test("minimap hint disc", async ({ page }) => {
  await page.addInitScript(tauriMockInit);
  await page.goto("/minimap.html");
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement | null;
    // render() sizes the canvas on its first paint; the default is 300x150.
    return !!c && c.width !== 300;
  }, { timeout: 15_000 });
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot("minimap-hint.png");
});
