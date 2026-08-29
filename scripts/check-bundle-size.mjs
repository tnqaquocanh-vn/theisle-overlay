#!/usr/bin/env node
// B3 — CI perf budget for the JS bundle. Run AFTER `npm run build`:
//
//   npm run build && node scripts/check-bundle-size.mjs
//
// Fails (exit 1) if any chunk's gzipped size is over budget, or if a new
// unbudgeted chunk shows up above UNBUDGETED_LIMIT. "Smooth / fast to start"
// becomes a build-enforced number, the same way check-i18n / check-versions
// guard their own invariants.
//
// The load-bearing guards: `main` and `minimap` stay small. If `three`
// (~188 KB gzip) ever gets statically imported into either, its budget blows
// instantly. The minimap overlay bundle in particular MUST stay tiny — it runs
// beside the game for hours.
//
// After an intentional change, update BUDGETS with a short reason.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ASSETS = fileURLToPath(new URL("../dist/assets", import.meta.url));

// key = chunk name with the content hash stripped. Values are gzipped-byte
// ceilings, set ~15-25% over the current size for headroom.
const BUDGETS = {
  main: 52_000, // App shell + all tabs, minus Leaflet/three (both split out)
  minimap: 16_000, // in-game HUD overlay — keep this SMALL
  bigmap: 12_000, // big-map shell (shares the FullMap chunk)
  companion: 16_000, // A7 2nd-monitor dashboard shell (shares the FullMap chunk)
  FullMap: 115_000, // Leaflet + the full map surface (shared by main + bigmap + companion)
  "three.module": 235_000, // lazy — only loads with the 3D dino viewer
  GLTFLoader: 20_000, // lazy (3D viewer)
  OrbitControls: 8_000, // lazy (3D viewer)
  SkeletonUtils: 4_000, // lazy (3D viewer)
  theme: 8_000,
  "dino-diets.data": 3_000,
};
const UNBUDGETED_LIMIT = 20_000; // a new chunk bigger than this must be budgeted
const TOTAL_BUDGET = 620_000; // sum of all gzipped JS

// Strip Vite's `-<hash>.js` suffix (base64url-ish, may contain - and _).
const chunkKey = (file) => file.replace(/-[A-Za-z0-9_-]{6,}\.js$/, "").replace(/\.js$/, "");

let files;
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
} catch {
  console.error("dist/assets not found — run `npm run build` first.");
  process.exit(1);
}
if (files.length === 0) {
  console.error("no JS chunks in dist/assets — did the build succeed?");
  process.exit(1);
}

const rows = files
  .map((file) => {
    const raw = statSync(`${ASSETS}/${file}`).size;
    const gz = gzipSync(readFileSync(`${ASSETS}/${file}`), { level: 9 }).length;
    const key = chunkKey(file);
    const budget = BUDGETS[key] ?? null;
    return { file, key, raw, gz, budget };
  })
  .sort((a, b) => b.gz - a.gz);

const kb = (n) => `${(n / 1000).toFixed(1)} kB`;
let failed = false;
let total = 0;

console.log(`  ${"chunk".padEnd(20)} ${"raw".padStart(10)} ${"gzip".padStart(10)} ${"budget".padStart(10)}  status`);
for (const r of rows) {
  total += r.gz;
  let status = "ok";
  if (r.budget === null) {
    if (r.gz > UNBUDGETED_LIMIT) {
      status = "NEW — add a budget";
      failed = true;
    } else {
      status = "(unbudgeted)";
    }
  } else if (r.gz > r.budget) {
    status = `OVER by ${kb(r.gz - r.budget)}`;
    failed = true;
  } else {
    status = `${Math.round((r.gz / r.budget) * 100)}%`;
  }
  const budgetCol = r.budget === null ? "—" : kb(r.budget);
  console.log(`  ${r.key.padEnd(20)} ${kb(r.raw).padStart(10)} ${kb(r.gz).padStart(10)} ${budgetCol.padStart(10)}  ${status}`);
}

console.log(`  ${"".padEnd(20)} ${"".padStart(10)} ${kb(total).padStart(10)} ${kb(TOTAL_BUDGET).padStart(10)}  ${total > TOTAL_BUDGET ? `OVER by ${kb(total - TOTAL_BUDGET)}` : "total"}`);
if (total > TOTAL_BUDGET) failed = true;

if (failed) {
  console.error("\nbundle-size budget exceeded — trim the chunk, or bump BUDGETS in this script with a reason.");
  process.exit(1);
}
console.log("\nbundle-size budget OK");
