/**
 * Supporter license keys (v1.31).
 *
 * Public   : POST /v1/license/validate  { key, fp, appVersion }
 * Admin    : POST /admin/license/mint   { count?, email?, note?, source? }
 *            POST /admin/license/revoke { key }
 *            GET  /admin/license/list   [?source=kofi&unsent=1]
 * Webhook  : POST /v1/license/kofi      (Ko-fi form post; mints on donation)
 *
 * The app caches a validated result locally (signed, ~14-day TTL) so a brief
 * server outage never locks anyone out.
 */
import { json, nowS, str, timingSafeEqual } from "./util";
import type { Env } from "./env";

const KEY_RE = /^BUMBUM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const FP_MAX = 64;
const REBIND_LIMIT = 2; // machine rebinds allowed per calendar month

type LicRow = {
  key: string;
  tier: string;
  fp: string | null;
  fp_month: string | null;
  fp_rebinds: number;
  revoked: number;
};

const monthTag = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

function randKey(): string {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  const g = [...buf].map((b) => A[b % A.length]).join("");
  return `BUMBUM-${g.slice(0, 4)}-${g.slice(4, 8)}-${g.slice(8, 12)}`;
}

// -------------------------------------------------------------- public ---

async function validate(req: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ valid: false, reason: "bad_request" }, 400);
  }
  const key = (str(body.key, 40) ?? "").toUpperCase();
  const fp = str(body.fp, FP_MAX) ?? "";
  if (!KEY_RE.test(key) || !fp) return json({ valid: false, reason: "bad_request" }, 400);

  const row = (await env.DB.prepare(
    `SELECT key, tier, fp, fp_month, fp_rebinds, revoked FROM license WHERE key = ?`,
  )
    .bind(key)
    .first()) as LicRow | null;

  if (!row) return json({ valid: false, reason: "unknown" });
  if (row.revoked) return json({ valid: false, reason: "revoked" });

  // Unbound, or same machine -> OK (bind on first use).
  if (!row.fp || row.fp === fp) {
    if (!row.fp) {
      await env.DB.prepare(`UPDATE license SET fp = ?, fp_month = ? WHERE key = ?`)
        .bind(fp, monthTag(), key)
        .run();
    }
    return json({ valid: true, tier: row.tier, until: null });
  }

  // Different machine: allow up to REBIND_LIMIT rebinds per month, else reject.
  const month = monthTag();
  const used = row.fp_month === month ? row.fp_rebinds : 0;
  if (used >= REBIND_LIMIT) {
    return json({ valid: false, reason: "fp_limit" });
  }
  await env.DB.prepare(
    `UPDATE license SET fp = ?, fp_month = ?, fp_rebinds = ? WHERE key = ?`,
  )
    .bind(fp, month, used + 1, key)
    .run();
  return json({ valid: true, tier: row.tier, until: null });
}

// Ko-fi webhook. Ko-fi POSTs application/x-www-form-urlencoded with a single
// `data` field holding JSON. We mint one key per qualifying donation and stash
// it against the donor email; the maintainer delivers it (see /admin/license/list).
async function kofi(req: Request, env: Env): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const raw = form?.get("data");
  if (typeof raw !== "string") return new Response("ok"); // Ko-fi ignores the body
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response("ok");
  }
  if (
    !env.KOFI_VERIFICATION_TOKEN ||
    !timingSafeEqual(String(d.verification_token ?? ""), env.KOFI_VERIFICATION_TOKEN)
  ) {
    return new Response("ok"); // silently ignore spoofed calls
  }
  const type = String(d.type ?? "");
  const amount = parseFloat(String(d.amount ?? "0"));
  // Ko-fi amounts are in the seller's currency. 50k VND ~ a couple USD; keep a
  // low floor and let the maintainer tune KOFI_MIN.
  const min = parseFloat(env.KOFI_MIN ?? "1.5");
  if (!(type === "Donation" || type === "Subscription") || !(amount >= min)) {
    return new Response("ok");
  }
  const email = str(d.email, 120) ?? null;
  const key = randKey();
  await env.DB.prepare(
    `INSERT INTO license (key, tier, email, issued_at, source, note)
     VALUES (?, 'supporter', ?, ?, 'kofi', ?)`,
  )
    .bind(key, email, nowS(), `kofi ${type} ${amount}`)
    .run();
  return new Response("ok");
}

export function handleLicense(req: Request, env: Env, path: string): Promise<Response> {
  if (req.method === "POST" && path === "/v1/license/validate") return validate(req, env);
  if (req.method === "POST" && path === "/v1/license/kofi") return kofi(req, env);
  return Promise.resolve(new Response(null, { status: 404 }));
}

// --------------------------------------------------------------- admin ---

function authed(req: Request, env: Env): boolean {
  const got = req.headers.get("authorization") ?? "";
  return got.startsWith("Bearer ") && timingSafeEqual(got.slice(7), env.ADMIN_TOKEN);
}

export async function handleLicenseAdmin(
  req: Request,
  env: Env,
  path: string,
): Promise<Response> {
  if (!authed(req, env)) return json({ error: "unauthorized" }, 401);

  if (req.method === "POST" && path === "/admin/license/mint") {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const count = Math.min(50, Math.max(1, Number(b.count ?? 1) | 0));
    const email = str(b.email, 120);
    const note = str(b.note, 200);
    const source = b.source === "kofi" ? "kofi" : "manual";
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = randKey();
      await env.DB.prepare(
        `INSERT INTO license (key, tier, email, issued_at, source, note)
         VALUES (?, 'supporter', ?, ?, ?, ?)`,
      )
        .bind(key, email, nowS(), source, note)
        .run();
      out.push(key);
    }
    return json({ minted: out });
  }

  if (req.method === "POST" && path === "/admin/license/revoke") {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = (str(b.key, 40) ?? "").toUpperCase();
    if (!KEY_RE.test(key)) return json({ error: "bad_key" }, 400);
    const r = await env.DB.prepare(`UPDATE license SET revoked = 1 WHERE key = ?`)
      .bind(key)
      .run();
    return json({ revoked: r.meta.changes ?? 0 });
  }

  if (req.method === "POST" && path === "/admin/license/sent") {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const key = (str(b.key, 40) ?? "").toUpperCase();
    await env.DB.prepare(`UPDATE license SET sent_at = ? WHERE key = ?`)
      .bind(nowS(), key)
      .run();
    return json({ ok: true });
  }

  if (req.method === "GET" && path === "/admin/license/list") {
    const u = new URL(req.url);
    const where: string[] = [];
    const bind: unknown[] = [];
    if (u.searchParams.get("source")) {
      where.push("source = ?");
      bind.push(u.searchParams.get("source"));
    }
    if (u.searchParams.get("unsent") === "1") where.push("sent_at IS NULL");
    const sql =
      `SELECT key, tier, email, source, issued_at, sent_at, revoked, note, fp IS NOT NULL AS bound
       FROM license` +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      ` ORDER BY issued_at DESC LIMIT 200`;
    const res = await env.DB.prepare(sql)
      .bind(...bind)
      .all();
    return json({ licenses: res.results ?? [] });
  }

  return json({ error: "not_found" }, 404);
}
