export interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  DB: D1Database;
  AE: AnalyticsEngineDataset;
  RL_PING: RateLimiter;
  RL_WRITE: RateLimiter;
  /** Ephemeral team rooms (G6). One instance per invite code. */
  TEAM: DurableObjectNamespace;
  BUILD_ENV: string;
  /** Root secret. Per-version client keys are derived from it, never shipped. */
  ATTEST_MASTER: string;
  /** Bearer token for /admin/*. */
  ADMIN_TOKEN: string;
  /** Ko-fi webhook "Verification Token" (Ko-fi → Settings → API). */
  KOFI_VERIFICATION_TOKEN?: string;
  /** Minimum Ko-fi donation (seller currency) that mints a key. Default 1.5. */
  KOFI_MIN?: string;
  /** In-app "Mua mã" order flow (v1.32). Price in VND; default 50000. */
  PRICE_VND?: string;
  /** Minutes a pending order stays open. Default 30. */
  ORDER_TTL_MIN?: string;
  /** VietQR napas BIN of the receiving bank, e.g. "970422" (MB Bank). */
  BANK_BIN?: string;
  /** Receiving bank account number. */
  BANK_ACCOUNT?: string;
  /** Account holder name (shown on the QR). */
  BANK_NAME?: string;
  /** SePay webhook auth — sent as `Authorization: Apikey <SEPAY_API_KEY>`. */
  SEPAY_API_KEY?: string;
  /** Cloudflare API token with Account Analytics Read, for the AE SQL API. */
  AE_QUERY_TOKEN?: string;
  AE_ACCOUNT_ID?: string;
}
