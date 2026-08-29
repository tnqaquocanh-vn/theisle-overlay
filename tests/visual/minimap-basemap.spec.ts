import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// v1.26 — exercises the disc WITH a basemap, which is the path the crop cache
// (drawMap) lives on. The mock serves a 512×512 four-quadrant + grid PNG;
// radius_m 200 puts the quadrant junction in the middle of the disc, so a
// wrong crop offset/size is obvious in the screenshot.
test("minimap HUD — basemap + crop cache", async ({ page }) => {
  await page.addInitScript(tauriMockInit, {
    basemap: true,
    settings: { minimap: { radius_m: 200 }, islepilot: { enabled: false } },
    canned: {
      get_basemap_paths: { minimap: "__mockbasemap__.png", minimapDecodeWidth: null },
      get_map_info: { imageWidthPx: 512, pxPerMX: 0.7, source: "vulnona", overlays: [] },
      get_current_position: {
        xCm: 15_000_000,
        yCm: 28_000_000,
        px: 256,
        py: 256,
        headingDeg: 30,
        compassKey: "dir.NE",
      },
      minimap_layout: { panelH: 0, questsH: 0, teamH: 0 },
    },
  });
  await page.goto("/minimap.html");
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas") as HTMLCanvasElement | null;
      return !!c && c.width > 4;
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(900); // basemap fetch + decode + paint
  await expect(page).toHaveScreenshot("minimap-basemap.png");
});
