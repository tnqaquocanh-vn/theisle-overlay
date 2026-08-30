import { test, expect } from "@playwright/test";
import { tauriMockInit } from "./tauri-mock";

// A6 — session replay. Expand "Past sessions" in the layer panel, hit its ▶ to
// load the trail into the scrubber, and shoot the floating transport bar:
// play/scrub/speed/export controls plus the HP·hunger·thirst stat strip fed
// by get_trail_stats. A wrong `top`, a missing control or a broken polyline
// shows in the screenshot.
test("full map — session replay scrubber bar", async ({ page }) => {
  const t0 = 1_756_000_000_000; // fixed epoch so realMs math is deterministic
  const points = [
    { px: 900, py: 1000, clockMs: 0, realMs: t0 },
    { px: 960, py: 980, clockMs: 4000, realMs: t0 + 4000 },
    { px: 1020, py: 950, clockMs: 8000, realMs: t0 + 8000 },
    { px: 1180, py: 820, clockMs: 9500, realMs: t0 + 20 * 60 * 1000 }, // after a squeezed idle
    { px: 1240, py: 800, clockMs: 13_500, realMs: t0 + 20 * 60 * 1000 + 4000 },
  ];
  const stats = [0, 300, 600, 1200, 1210].map((ds, i) => ({
    t: Math.round((t0 + ds * 1000) / 1000),
    growthPct: 40 + i,
    healthPct: 90 - i * 6,
    hungerPct: 70 - i * 9,
    thirstPct: 55 + i * 4,
    staminaPct: 80,
    primeDone: i,
    primeTotal: 5,
  }));
  await page.addInitScript(tauriMockInit, {
    fullmap: true,
    canned: {
      list_trails: [
        { name: "trail_20260830_140000.jsonl", label: "2026-08-30 14:00", points: 5 },
      ],
      get_trail_replay: {
        points,
        gaps: [3],
        durationMs: 13_500,
        startedIso: "2026-08-30T14:00:00+07:00",
      },
      get_trail_stats: stats,
    },
  });
  await page.goto("/");
  await page.waitForSelector(".leaflet-container", { timeout: 15_000 });
  await page.getByText(/Phiên trước \(1\)|Past sessions \(1\)/).click();
  await page.getByRole("button", { name: /Tua lại phiên này|Replay this session/ }).click();
  await page.waitForSelector(".replay-bar .replay-stats", { timeout: 5_000 });
  await page.waitForTimeout(400);
  await expect(page.locator(".replay-bar")).toHaveScreenshot("replay-bar.png");
});
