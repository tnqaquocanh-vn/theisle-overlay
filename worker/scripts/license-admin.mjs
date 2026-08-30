/**
 * Supporter-license admin CLI. Talks to the deployed Worker's /admin/license/*
 * routes so you never have to hand-craft a curl call.
 *
 *   node scripts/license-admin.mjs mint --count 3 --note "ban be"
 *   node scripts/license-admin.mjs pending          # Ko-fi keys minted, not yet delivered
 *   node scripts/license-admin.mjs list             # every key, newest first
 *   node scripts/license-admin.mjs sent   BUMBUM-XXXX-XXXX-XXXX
 *   node scripts/license-admin.mjs revoke BUMBUM-XXXX-XXXX-XXXX
 *
 * Config, in order of precedence: CLI flags → env → ./.admin.vars (gitignored).
 *   ADMIN_BASE   e.g. https://theisle-overlay-api.quocanh.workers.dev
 *   ADMIN_TOKEN  the same value you set with `wrangler secret put ADMIN_TOKEN`
 *
 * .admin.vars format (one KEY=value per line):
 *   ADMIN_BASE=https://theisle-overlay-api.quocanh.workers.dev
 *   ADMIN_TOKEN=xxxxxxxx
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith("--")) ?? "";
const positional = args.filter((a) => !a.startsWith("--") && a !== cmd);

function flag(name, def = undefined) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
}

function fromVarsFile(key) {
  try {
    const line = readFileSync(new URL("../.admin.vars", import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${key}=`));
    return line ? line.slice(line.indexOf("=") + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const USAGE =
  "commands: check | mint [--count N] [--note ..] [--email ..] [--source manual|kofi] | list | pending | sent <KEY> | revoke <KEY> | orders | order-paid <TIOxxxxxx>";

if (!cmd) {
  console.log(USAGE);
  process.exit(0);
}

const BASE = (flag("base") ?? process.env.ADMIN_BASE ?? fromVarsFile("ADMIN_BASE") ?? "").replace(
  /\/+$/,
  "",
);
const TOKEN = flag("token") ?? process.env.ADMIN_TOKEN ?? fromVarsFile("ADMIN_TOKEN") ?? "";

if (!BASE || !TOKEN) {
  console.error(
    "Missing config. Set ADMIN_BASE + ADMIN_TOKEN via env, ./.admin.vars, or --base/--token.",
  );
  process.exit(2);
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, data);
    process.exit(1);
  }
  return data;
}

function printKeyTable(rows) {
  if (!rows.length) {
    console.log("(none)");
    return;
  }
  for (const r of rows) {
    const when = r.issued_at ? new Date(r.issued_at * 1000).toISOString().slice(0, 10) : "?";
    const flags = [
      r.revoked ? "REVOKED" : "",
      r.bound ? "bound" : "unbound",
      r.sent_at ? "sent" : "unsent",
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `${r.key}  ${when}  ${(r.source ?? "").padEnd(6)}  ${flags}${
        r.email ? `  <${r.email}>` : ""
      }${r.note ? `  — ${r.note}` : ""}`,
    );
  }
}

switch (cmd) {
  case "check": {
    // One-shot "is everything wired up?" check for first-time setup.
    console.log(`Worker : ${BASE}`);
    const bad = await fetch(`${BASE}/v1/license/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then((r) => r.text())
      .catch((e) => `ERR ${e}`);
    console.log(
      /"reason"\s*:\s*"bad_request"/.test(bad)
        ? "  /v1/license/validate  ✓ sống (từ chối body rỗng đúng cách)"
        : `  /v1/license/validate  ✗ phản hồi lạ: ${bad.slice(0, 120)}`,
    );
    const out = await call("GET", "/admin/license/list");
    const n = (out.licenses ?? []).length;
    console.log(`  ADMIN_TOKEN           ✓ đúng — hiện có ${n} mã trong kho`);
    console.log("\nTất cả ✓ nghĩa là backend đã sẵn sàng cấp mã.");
    break;
  }
  case "mint": {
    const count = Number(flag("count", "1"));
    const note = flag("note");
    const email = flag("email");
    const source = flag("source"); // "manual" (default) | "kofi"
    const out = await call("POST", "/admin/license/mint", { count, note, email, source });
    for (const k of out.minted ?? []) console.log(k);
    break;
  }
  case "list": {
    const out = await call("GET", "/admin/license/list");
    printKeyTable(out.licenses ?? []);
    break;
  }
  case "pending": {
    const out = await call("GET", "/admin/license/list?source=kofi&unsent=1");
    printKeyTable(out.licenses ?? []);
    console.log(
      `\n${(out.licenses ?? []).length} Ko-fi key(s) awaiting delivery. Email each donor its key,` +
        ` then: node scripts/license-admin.mjs sent <KEY>`,
    );
    break;
  }
  case "sent": {
    const key = positional[0];
    if (!key) throw new Error("usage: sent <KEY>");
    await call("POST", "/admin/license/sent", { key });
    console.log(`marked sent: ${key}`);
    break;
  }
  case "revoke": {
    const key = positional[0];
    if (!key) throw new Error("usage: revoke <KEY>");
    const out = await call("POST", "/admin/license/revoke", { key });
    console.log(`revoked ${out.revoked ?? 0} row(s): ${key}`);
    break;
  }
  case "orders": {
    const out = await call("GET", "/admin/license/order/list");
    const rows = out.orders ?? [];
    if (!rows.length) console.log("(none)");
    for (const r of rows) {
      const when = r.created_at
        ? new Date(r.created_at * 1000).toISOString().slice(0, 16).replace("T", " ")
        : "?";
      console.log(
        `${r.code}  ${when}  ${String(r.amount).padStart(7)}đ  ${r.status.padEnd(8)}${
          r.key ? `  ${r.key}` : ""
        }`,
      );
    }
    break;
  }
  case "order-paid": {
    const code = positional[0];
    if (!code) throw new Error("usage: order-paid <TIOxxxxxx>");
    const out = await call("POST", "/admin/license/order/paid", { code });
    console.log(
      out.already ? `already paid: ${out.key}` : `marked paid, minted key: ${out.key}`,
    );
    break;
  }
  default:
    console.log(USAGE);
    process.exit(1);
}
