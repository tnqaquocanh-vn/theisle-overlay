import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A7 — the second-monitor companion dashboard, in its map-less "compact" mode
// (deterministic: no Leaflet). Covers the three sidebar cards — dino stats
// (identity + StatBars + nutrition triangle), the team roster with
// threshold-coloured HP, and the Prime-quest list.
test("companion window — compact dashboard (stats · team · quests)", async ({ page }) => {
  await page.addInitScript(tauriMockInit, {
    settings: {
      companion: { w: 1280, h: 820, x: null, y: null, compact: true },
      islepilot: { enabled: true, auth_mode: "token", domain: "https://mixi.islepilot.eu" },
    },
    canned: {
      islepilot_state: {
        loggedIn: true,
        authMode: "token",
        lastUpdate: {
          domain: "https://mixi.islepilot.eu",
          fetchedAtMs: 1_756_000_000_000,
          player: {
            dinoName: "Tenontosaurus",
            female: true,
            online: true,
            server: "Isle-EU-1",
            growth: "62%",
            growthPct: 62,
            primeEligible: true,
            health: { current: 780, max: 1000, raw: "780 / 1000" },
            hunger: { current: 240, max: 1000, raw: "240 / 1000" },
            thirst: { current: 610, max: 1000, raw: "610 / 1000" },
            stamina: { current: 500, max: 1000, raw: "500 / 1000" },
            nutrition: { carb: 12, protein: 31, lipid: 22 },
            primeQuests: [
              { text: "Reach 25% growth", textVi: "Đạt 25% trưởng thành", completed: true },
              { text: "Drink from a water source", textVi: "Uống nước", completed: true },
              { text: "Drink from a water source", textVi: "Uống nước", completed: false },
              { text: "Survive a mass migration", textVi: "Sống sót đợt di cư", completed: false },
            ],
          },
          map: null,
          layoutChanged: false,
        },
      },
      team_status: {
        active: true,
        connected: true,
        code: "AB12",
        name: "Pack",
        members: 3,
        error: null,
        roster: [
          { name: "Rex", online: true, isSelf: true, hp: 78, hunger: 24, thirst: 61, species: "Tenontosaurus", server: "Isle-EU-1" },
          { name: "Mira", online: true, isSelf: false, hp: 41, hunger: 55, thirst: 70, species: "Diabloceratops", server: "Isle-EU-1" },
          { name: "Rex", online: false, isSelf: false, hp: null, hunger: null, thirst: null, species: "Pteranodon", server: "Isle-EU-1" },
        ],
      },
    },
  });
  await page.goto("/companion.html");
  await page.waitForSelector(".side .card", { timeout: 15_000 });
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("companion-compact.png", { fullPage: false });
});
