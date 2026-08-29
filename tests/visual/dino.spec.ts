import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// "Your dino" tab, logged-in token mode, with a full player payload so the
// v1.24 profile card renders: identity header, vitals (StatBar), the ternary
// nutrition chart, and the Prime progress list.
const player = {
  dinoName: "Tenontosaurus",
  species: "Tenontosaurus",
  female: true,
  online: true,
  server: "Isle-EU-1",
  growth: "73%",
  growthPct: 73,
  primeEligible: true,
  health: { current: 842, max: 1000, raw: "842 / 1000" },
  hunger: { current: 410, max: 1000, raw: "410 / 1000" },
  thirst: { current: 180, max: 1000, raw: "180 / 1000" },
  stamina: { current: 620, max: 1000, raw: "620 / 1000" },
  nutrition: { carb: 22.5, protein: 9.1, lipid: 14.0 },
  primeQuests: [
    { text: "Reach 25% growth", textVi: "Đạt 25% trưởng thành", completed: true },
    { text: "Reach 50% growth", textVi: "Đạt 50% trưởng thành", completed: true },
    { text: "Visit the Sanctuary", textVi: "Ghé Khu bảo tồn", completed: false },
    { text: "Survive a mass migration", textVi: "Sống sót một đợt di cư lớn", completed: false },
    { text: "Raise a juvenile to sub-adult", textVi: "Nuôi con đến bán trưởng thành", completed: false },
  ],
};

test("your-dino tab — profile card", async ({ page }) => {
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
  await page.waitForTimeout(600);
  await expect(page).toHaveScreenshot("app-dino.png", { fullPage: false });
});
