import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A3 — the "eat next" card under the nutrition triangle. Same logged-in
// token-mode setup as dino.spec, but carbs are the lowest value and the
// species is a herbivore, so it advises grazing ferns / cycads and flags the
// Carbs chip red. Screenshotted element-only so it doesn't depend on where it
// lands in the (long) Dino tab.
const player = {
  dinoName: "Stegosaurus",
  species: "Stegosaurus",
  female: false,
  online: true,
  server: "Isle-EU-1",
  growth: "60%",
  growthPct: 60,
  health: { current: 900, max: 1000, raw: "900 / 1000" },
  hunger: { current: 500, max: 1000, raw: "500 / 1000" },
  thirst: { current: 500, max: 1000, raw: "500 / 1000" },
  stamina: { current: 700, max: 1000, raw: "700 / 1000" },
  nutrition: { carb: 6.2, protein: 31.0, lipid: 24.5 },
  primeQuests: [],
};

test("nutrition advice — carbs low, herbivore", async ({ page }) => {
  await page.addInitScript(tauriMockInit, {
    settings: {
      islepilot: {
        enabled: true,
        auth_mode: "token",
        domain: "https://mixi.islepilot.eu",
        realtime: true,
        history_enabled: false,
        history_days: 14,
        show_overlay_panel: true,
        show_quests_panel: true,
        alerts: { thirst_pct: 20, hunger_pct: 20, hp_pct: 30, growth_milestones: true },
      },
    },
    canned: {
      islepilot_state: {
        loggedIn: true,
        authMode: "token",
        lastUpdate: {
          domain: "https://mixi.islepilot.eu",
          fetchedAtMs: 1_700_000_000_000,
          player,
          map: null,
          layoutChanged: false,
        },
      },
      team_status: { active: false, connected: false, code: "", name: "", members: 0, roster: [] },
    },
  });
  await page.goto("/#dino");
  await page.waitForSelector(".profile", { timeout: 15_000 });
  const adv = page.locator(".adv");
  await adv.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await expect(adv).toHaveScreenshot("nutrition-advice.png");
});
