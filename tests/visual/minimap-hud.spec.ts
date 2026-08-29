import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// The in-game HUD with a position + a "your dino" strip: exercises the Amber
// disc chrome (vignette, biolum dart halo, Plex text) and the token-panel
// stat strip. No basemap image in the mock — the disc shows its dim ground,
// which is what the redesign chrome sits on anyway.
test("minimap HUD — disc + dino strip", async ({ page }) => {
  const quests = Array.from({ length: 15 }, (_, i) => ({
    text: `Prime objective number ${i + 1} that runs long enough to ellipsise`,
    textVi: `Nhiệm vụ Prime số ${i + 1} đủ dài để bị cắt bớt bằng dấu ba chấm`,
    completed: i < 4,
  }));
  await page.addInitScript(tauriMockInit, {
    settings: { islepilot: { enabled: true } },
    canned: {
      minimap_layout: { panelH: 139, questsH: 166, teamH: 0 },
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
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement | null;
    return !!c && c.width !== 300;
  }, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("minimap-hud.png");
});
