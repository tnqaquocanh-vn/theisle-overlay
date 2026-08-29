import { test, expect } from "@playwright/test";

// B3 (perf half) — a frame-time tripwire, not a benchmark. tests/perf/
// minimap-bench.html drives render() through a 300-frame heading-ease burst
// (player px unchanged → the basemap crop cache should hold) and reports the
// mean. The budget is deliberately loose so machine variance doesn't flake it;
// a real regression (cache gone, an expensive per-frame op) still blows past.
test("minimap render() stays fast", async ({ page }) => {
  await page.goto("/tests/perf/minimap-bench.html");
  await page.waitForFunction(() => (window as unknown as { __bench?: unknown }).__bench, {
    timeout: 20_000,
  });
  const { meanMs, n, recropsInBurst } = await page.evaluate(
    () =>
      (window as unknown as {
        __bench: { meanMs: number; n: number; recropsInBurst: number };
      }).__bench,
  );
  console.log(
    `render() mean: ${meanMs.toFixed(3)} ms over ${n} frames · basemap re-crops in burst: ${recropsInBurst}`,
  );
  expect(meanMs).toBeGreaterThan(0);
  // Loose ceiling — a shared CI runner is slower and this is a regression
  // tripwire, not a benchmark (local is ~0.02 ms; removing the crop cache or
  // adding a costly per-frame op pushes it well past this).
  expect(meanMs).toBeLessThan(12);
  // The crop cache MUST hold through a heading-ease burst (px unchanged) —
  // the precise guard.
  expect(recropsInBurst).toBe(0);
});
