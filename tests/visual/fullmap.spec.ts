import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// The main window's map tab, actually rendering: a real Leaflet instance over
// a generated basemap, the Amber layer panel, and a few waypoints. Until now
// `app-map.png` only ever caught the data-download screen — this is the first
// spec that exercises FullMap.svelte's mount + paint.
test("main window — map tab renders (Leaflet + layer panel + waypoints)", async ({ page }) => {
  const wp = (id: string, name: string, px: number, py: number, color?: string) => ({
    id,
    name,
    x: px * 100,
    y: py * 100,
    z: 0,
    px,
    py,
    color: color ?? null,
    group: null,
  });
  await page.addInitScript(tauriMockInit, {
    fullmap: true,
    canned: {
      list_waypoints_px: [
        wp("wp_a1", "Hang trú", 900, 1050),
        wp("wp_b2", "Bãi nước", 1150, 780, "#5cd6bf"),
        wp("wp_c3", "💀 Điểm chết", 1040, 1240, "#d9604a"),
      ],
    },
  });
  await page.goto("/");
  await page.waitForSelector(".leaflet-container", { timeout: 15_000 });
  // Leaflet paints tiles/overlay async + fonts settle.
  await page.waitForFunction(
    () => document.querySelectorAll(".leaflet-marker-icon, .leaflet-image-layer").length > 0,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(700);
  await expect(page).toHaveScreenshot("fullmap.png", { fullPage: false });
});
