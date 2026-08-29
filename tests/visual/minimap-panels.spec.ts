import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A2 — the HUD panels reordered: quests on top, dino below (default is
// dino → quests → team). Same mock as minimap-hud with panel_order flipped;
// a wrong `top` for a panel shows as an overlap or a gap in the screenshot.
test("minimap HUD — panels reordered (quests above dino)", async ({ page }) => {
  const quests = Array.from({ length: 8 }, (_, i) => ({
    text: `Prime objective ${i + 1}`,
    textVi: `Nhiệm vụ Prime ${i + 1}`,
    completed: i < 3,
  }));
  await page.addInitScript(tauriMockInit, {
    settings: { islepilot: { enabled: true }, minimap: { panel_order: ["quests", "dino", "team"] } },
    canned: {
      minimap_layout: { panelH: 139, questsH: 130, teamH: 0 },
      get_current_position: {
        xCm: 15_361_082,
        yCm: 28_360_952,
        px: 3900,
        py: 3900,
        headingDeg: 47,
        compassKey: "dir.NE",
      },
      islepilot_state: {
        loggedIn: true,
        lastUpdate: {
          player: {
            dinoName: "Tenontosaurus",
            female: true,
            online: true,
            growthPct: 47,
            health: { current: 1247, max: 1247 },
            hunger: { current: 388, max: 411 },
            thirst: { current: 822, max: 1000 },
            stamina: { current: 526, max: 526 },
            nutrition: { carb: 8, protein: 41, lipid: 26 },
            primeQuests: quests,
          },
        },
      },
    },
  });
  await page.goto("/minimap.html");
  await page.waitForFunction(
    () => {
      const c = document.querySelector("canvas") as HTMLCanvasElement | null;
      return !!c && c.width !== 300;
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("minimap-panels.png");
});
