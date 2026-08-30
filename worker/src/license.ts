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

// ------------------------------------------------ in-app "Mua mã" order ---
//
// The app opens an order, shows a VietQR whose transfer memo IS the order
// code, then polls GET /v1/license/order/<code> until SePay's webhook marks it
// paid and attaches a freshly minted key. No copy/paste for the buyer.

const ORDER_CODE_RE = /TIO[A-Z0-9]{6}/i;
const ORDER_CODE_EXACT = /^TIO[A-Z0-9]{6}$/;

const priceVnd = (env: Env) => {
  const n = parseInt(env.PRICE_VND ?? "50000", 10);
  return Number.isFinite(n) && n > 0 ? n : 50000;
};
const orderTtlMin = (env: Env) => {
  const n = parseInt(env.ORDER_TTL_MIN ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
};
const bankConfigured = (env: Env) => Boolean(env.BANK_BIN && env.BANK_ACCOUNT);

function randOrderCode(): string {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return "TIO" + [...buf].map((b) => A[b % A.length]).join("");
}

function vietQrUrl(env: Env, amount: number, addInfo: string): string {
  const bin = encodeURIComponent(env.BANK_BIN ?? "");
  const acct = encodeURIComponent(env.BANK_ACCOUNT ?? "");
  const name = encodeURIComponent(env.BANK_NAME ?? "");
  return (
    `https://img.vietqr.io/image/${bin}-${acct}-compact2.png` +
    `?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${name}`
  );
}

async function orderNew(req: Request, env: Env): Promise<Response> {
  if (!bankConfigured(env)) return json({ error: "not_configured" }, 503);
  const ip = req.headers.get("cf-connecting-ip") ?? "x";
  if (!(await env.RL_WRITE.limit({ key: `order:${ip}` })).success) {
    return json({ error: "rate" }, 429);
  }
  let fp: string | null = null;
  try {
    fp = str((await req.json() as Record<string, unknown>).fp, FP_MAX);
  } catch {
    /* fp is optional */
  }
  const amount = priceVnd(env);
  let code = "";
  for (let i = 0; i < 5 && !code; i++) {
    const c = randOrderCode();
    try {
      await env.DB.prepare(
        `INSERT INTO license_order (code, amount, fp, created_at) VALUES (?, ?, ?, ?)`,
      )
        .bind(c, amount, fp, nowS())
        .run();
      code = c;
    } catch {
      /* PK collision — retry */
    }
  }
  if (!code) return json({ error: "server" }, 500);
  return json({
    code,
    amount,
    addInfo: code,
    ttlMin: orderTtlMin(env),
    bank: { bin: env.BANK_BIN, account: env.BANK_ACCOUNT, name: env.BANK_NAME ?? "" },
    qrUrl: vietQrUrl(env, amount, code),
  });
}

async function orderStatus(req: Request, env: Env, raw: string): Promise<Response> {
  const code = raw.toUpperCase();
  if (!ORDER_CODE_EXACT.test(code)) return json({ status: "unknown", key: null }, 400);
  const row = (await env.DB.prepare(
    `SELECT status, key, fp, created_at FROM license_order WHERE code = ?`,
  )
    .bind(code)
    .first()) as
    | { status: string; key: string | null; fp: string | null; created_at: number }
    | null;
  if (!row) return json({ status: "unknown", key: null });
  if (row.status === "pending" && nowS() - row.created_at > orderTtlMin(env) * 60) {
    await env.DB.prepare(
      `UPDATE license_order SET status = 'expired' WHERE code = ? AND status = 'pending'`,
    )
      .bind(code)
      .run();
    return json({ status: "expired", key: null });
  }
  if (row.status === "paid") {
    // Hand the key back only to the machine that opened the order.
    const fp = new URL(req.url).searchParams.get("fp");
    if (row.fp && fp && row.fp !== fp) return json({ status: "paid", key: null });
    return json({ status: "paid", key: row.key });
  }
  return json({ status: row.status, key: null });
}

// SePay (sepay.vn) webhook: fires when money lands in the linked bank account.
// Auth header is `Authorization: Apikey <SEPAY_API_KEY>`.
async function sepay(req: Request, env: Env): Promise<Response> {
  // SePay sends `Authorization: Apikey <key>`. Match the scheme case-insensitively.
  const authMatch = (req.headers.get("authorization") ?? "").match(/^apikey\s+(.+)$/i);
  if (!env.SEPAY_API_KEY || !authMatch || !timingSafeEqual(authMatch[1].trim(), env.SEPAY_API_KEY)) {
    return new Response("ok"); // ignore spoofed calls silently
  }
  let d: Record<string, unknown>;
  try {
    d = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("ok");
  }
  if (String(d.transferType ?? d.transfer_type ?? "in") !== "in") return new Response("ok");
  const content = `${d.content ?? ""} ${d.description ?? ""}`;
  const m = content.match(ORDER_CODE_RE);
  if (!m) return new Response("ok");
  const code = m[0].toUpperCase();
  const amount = Math.round(Number(d.transferAmount ?? d.transfer_amount ?? 0));
  const ref = str(d.referenceCode ?? d.reference_code ?? d.id, 64);

  const order = (await env.DB.prepare(
    `SELECT amount, status FROM license_order WHERE code = ?`,
  )
    .bind(code)
    .first()) as { amount: number; status: string } | null;
  if (!order || order.status !== "pending") return new Response("ok");
  if (amount < order.amount) return new Response("ok"); // underpaid — leave for manual rescue

  const key = randKey();
  await env.DB.prepare(
    `INSERT INTO license (key, tier, issued_at, source, note)
     VALUES (?, 'supporter', ?, 'sepay', ?)`,
  )
    .bind(key, nowS(), `order ${code} ${amount}`)
    .run();
  await env.DB.prepare(
    `UPDATE license_order SET status = 'paid', key = ?, paid_at = ?, paid_ref = ?, paid_amount = ?
     WHERE code = ? AND status = 'pending'`,
  )
    .bind(key, nowS(), ref, amount, code)
    .run();
  return new Response("ok");
}

export function handleLicense(req: Request, env: Env, path: string): Promise<Response> {
  if (req.method === "POST" && path === "/v1/license/validate") return validate(req, env);
  if (req.method === "POST" && path === "/v1/license/kofi") return kofi(req, env);
  if (req.method === "POST" && path === "/v1/license/sepay") return sepay(req, env);
  if (req.method === "POST" && path === "/v1/license/order/new") return orderNew(req, env);
  if (req.method === "GET" && path.startsWith("/v1/license/order/")) {
    return orderStatus(req, env, path.slice("/v1/license/order/".length));
  }
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

  // Manual rescue: buyer paid but the SePay webhook never landed (wrong memo,
  // underpaid, SePay outage). Mints a key and marks the order paid.
  if (req.method === "POST" && path === "/admin/license/order/paid") {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const code = (str(b.code, 12) ?? "").toUpperCase();
    if (!ORDER_CODE_EXACT.test(code)) return json({ error: "bad_code" }, 400);
    const order = (await env.DB.prepare(
      `SELECT status, key FROM license_order WHERE code = ?`,
    )
      .bind(code)
      .first()) as { status: string; key: string | null } | null;
    if (!order) return json({ error: "unknown" }, 404);
    if (order.status === "paid") return json({ ok: true, key: order.key, already: true });
    const key = randKey();
    await env.DB.prepare(
      `INSERT INTO license (key, tier, issued_at, source, note)
       VALUES (?, 'supporter', ?, 'manual', ?)`,
    )
      .bind(key, nowS(), `order-paid ${code}`)
      .run();
    await env.DB.prepare(
      `UPDATE license_order SET status = 'paid', key = ?, paid_at = ? WHERE code = ?`,
    )
      .bind(key, nowS(), code)
      .run();
    return json({ ok: true, key });
  }

  if (req.method === "GET" && path === "/admin/license/order/list") {
    const res = await env.DB.prepare(
      `SELECT code, amount, status, key, created_at, paid_at, paid_amount
       FROM license_order ORDER BY created_at DESC LIMIT 100`,
    ).all();
    return json({ orders: res.results ?? [] });
  }

  return json({ error: "not_found" }, 404);
}
