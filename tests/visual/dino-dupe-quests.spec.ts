import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// Regression: Prime quest text is NOT unique — the game can hand out two
// objectives with identical text. The Prime list was keyed `{#each … (quest.text)}`,
// so a duplicate threw Svelte's each_key_duplicate and the whole "Your dino"
// tab fell into its error boundary. Now keyed by index. No screenshot — just
// assert the profile card renders and every quest row is present.
test("your-dino tab survives duplicate Prime quest text", async ({ page }) => {
  const dupText = "Drink from a water source";
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
          player: {
            dinoName: "Tenontosaurus",
            female: true,
            online: true,
            growth: "50%",
            growthPct: 50,
            health: { current: 900, max: 1000, raw: "900 / 1000" },
            hunger: { current: 500, max: 1000, raw: "500 / 1000" },
            thirst: { current: 500, max: 1000, raw: "500 / 1000" },
            primeQuests: [
              { text: dupText, textVi: "Uống nước", completed: true },
              { text: dupText, textVi: "Uống nước", completed: false },
              { text: "Reach 75% growth", textVi: "Đạt 75%", completed: false },
            ],
          },
          map: null,
          layoutChanged: false,
        },
      },
      team_status: { active: false, connected: false, code: "", name: "", members: 0, roster: [] },
    },
  });
  await page.goto("/#dino");
  // The card renders (no error boundary) …
  await page.waitForSelector(".profile", { timeout: 15_000 });
  // … and all three quest rows are there, duplicate text included.
  await expect(page.locator(".prime ul li")).toHaveCount(3);
});
