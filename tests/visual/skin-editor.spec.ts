import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// Skin editor tab: species picker, the 3D preview panel, the 10 localised
// colour-channel rows (swatch · label · picker · hex), the action buttons and
// the saved-preset chips. The 3D viewer can't reach the CDN in Playwright, so
// its panel shows the error/loading state — the regression target is the
// editor chrome around it.
test("skin editor — channels, actions, presets", async ({ page }) => {
  await page.addInitScript(tauriMockInit, {
    settings: {
      skin_presets: [
        {
          id: "sk_demo1",
          name: "Rêu đầm lầy",
          species: "Tenontosaurus",
          palette: {
            body: "#4a5a2a",
            flank: "#5b4a30",
            underbelly: "#9a9878",
            markings: "#26311a",
            display: "#7a4a24",
            detail: "#71815d",
            eyes: "#ffd76b",
            teeth: "#e8e2d0",
            mouth: "#7a4a4a",
            claws: "#2b2b2b",
          },
          created: "2026-08-30T00:00:00.000Z",
        },
        {
          id: "sk_demo2",
          name: "Cát sa mạc",
          species: "Gallimimus",
          palette: {
            body: "#c9a56b",
            flank: "#b08f57",
            underbelly: "#e6dcc0",
            markings: "#8a6a3a",
            display: "#d98f4a",
            detail: "#c7b48a",
            eyes: "#5a4020",
            teeth: "#efe7d0",
            mouth: "#7a4a4a",
            claws: "#3a3a3a",
          },
          created: "2026-08-30T00:01:00.000Z",
        },
      ],
    },
  });
  await page.goto("/#skin");
  // 10 channel rows rendered.
  await page.waitForSelector(".channels li", { timeout: 15_000 });
  await expect(page.locator(".channels li")).toHaveCount(10);
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("skin-editor.png", { fullPage: false });
});
