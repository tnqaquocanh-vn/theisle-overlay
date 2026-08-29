// i18n drift check.
//
//   vi.ts   is the source of truth for the KEY set (it defines MsgKey).
//   en.ts   must be COMPLETE — the fallback every other locale leans on.
//   others  may be partial, but must not carry a key vi.ts doesn't have.
//
// Run: node scripts/check-i18n.mjs   (also wired into CI)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/lib/i18n";

/** Every `"some.key":` at the start of a line. */
function keysOf(file) {
  const src = readFileSync(join(DIR, file), "utf8");
  return new Set([...src.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]));
}

const vi = keysOf("vi.ts");
console.log(`vi.ts: ${vi.size} keys (source of truth)`);

let bad = false;
const locales = readdirSync(DIR).filter(
  (f) => f.endsWith(".ts") && !["vi.ts", "index.ts"].includes(f),
);

for (const file of locales) {
  const k = keysOf(file);
  const unknown = [...k].filter((x) => !vi.has(x));
  const missing = [...vi].filter((x) => !k.has(x));
  const done = vi.size - missing.length;
  console.log(`${file}: ${done}/${vi.size} keys (${Math.round((done / vi.size) * 100)}%)`);

  if (unknown.length) {
    console.error(`  ✗ keys not in vi.ts: ${unknown.join(", ")}`);
    bad = true;
  }
  if (file === "en.ts" && missing.length) {
    const shown = missing.slice(0, 12).join(", ");
    console.error(
      `  ✗ en.ts must be complete — missing ${missing.length}: ${shown}${
        missing.length > 12 ? " …" : ""
      }`,
    );
    bad = true;
  }
}

process.exit(bad ? 1 : 0);
