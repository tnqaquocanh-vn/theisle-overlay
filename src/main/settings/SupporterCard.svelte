<script lang="ts">
  // Settings → "Người ủng hộ". Three ways in:
  //   1. "Mua mã" — opens an order, shows a VietQR, polls until SePay's webhook
  //      marks it paid, then auto-activates the minted key. No copy/paste.
  //   2. "Lấy mã ủng hộ →" — Ko-fi (foreign cards / PayPal).
  //   3. paste a key you were given (friends / family).
  // The free core is never gated; this only unlocks the plan's extras.
  import { onDestroy } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { writeText } from "@tauri-apps/plugin-clipboard-manager";
  import { t } from "$lib/i18n";
  import { license, activate, refresh, clearLicense } from "$lib/license.svelte";
  import { licenseOrderNew, licenseOrderPoll, type LicenseOrder } from "$lib/api";

  // TODO(BumBum): thay bằng trang Ko-fi / PayPal.me của bạn (host phải nằm
  // trong allowlist ở src-tauri/capabilities/default.json).
  const SUPPORT_URL = "https://ko-fi.com/";

  let keyInput = $state("");
  const busy = $derived(license.phase === "checking");
  const isSupporter = $derived(license.tier === "supporter");

  const REASONS: Record<string, string> = {
    unknown: "sup.err_unknown",
    revoked: "sup.err_revoked",
    fp_limit: "sup.err_fp_limit",
    bad_request: "sup.err_bad",
    invalid: "sup.err_bad",
  };
  const errorText = $derived(
    license.error ? $t((REASONS[license.error] ?? "sup.err_network") as never) : "",
  );

  async function onActivate() {
    if (!keyInput.trim() || busy) return;
    const ok = await activate(keyInput);
    if (ok) keyInput = "";
  }

  // --- "Mua mã" order flow -------------------------------------------------
  type BuyPhase =
    | "idle"
    | "creating"
    | "await"
    | "activating"
    | "expired"
    | "error"
    | "unconfigured";
  let buy = $state<BuyPhase>("idle");
  let order = $state<LicenseOrder | null>(null);
  let qrFailed = $state(false);
  let copied = $state<"" | "acct" | "memo">("");
  let startedMs = 0;
  let nowMs = $state(0);
  let pollT: ReturnType<typeof setInterval> | undefined;
  let tickT: ReturnType<typeof setInterval> | undefined;
  let unknownStreak = 0;

  const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
  const remainMs = $derived(
    order ? Math.max(0, startedMs + order.ttlMin * 60_000 - nowMs) : 0,
  );
  const remainLabel = $derived(
    `${Math.floor(remainMs / 60_000)}:${String(Math.floor((remainMs % 60_000) / 1000)).padStart(2, "0")}`,
  );

  function stopTimers() {
    clearInterval(pollT);
    clearInterval(tickT);
    pollT = undefined;
    tickT = undefined;
  }

  function cancelOrder() {
    stopTimers();
    order = null;
    qrFailed = false;
    buy = "idle";
  }

  async function startOrder() {
    buy = "creating";
    qrFailed = false;
    try {
      const o = await licenseOrderNew();
      if (o.error === "not_configured") {
        buy = "unconfigured";
        return;
      }
      if (o.error || !o.code) {
        buy = "error";
        return;
      }
      order = o;
      startedMs = Date.now();
      nowMs = startedMs;
      unknownStreak = 0;
      buy = "await";
      tickT = setInterval(() => (nowMs = Date.now()), 1000);
      pollT = setInterval(() => void poll(), 5000);
    } catch {
      buy = "error";
    }
  }

  async function poll() {
    if (!order) return;
    if (remainMs <= 0) {
      stopTimers();
      buy = "expired";
      return;
    }
    let s;
    try {
      s = await licenseOrderPoll(order.code);
    } catch {
      return; // transient — try again next tick
    }
    if (s.status === "paid" && s.key) {
      stopTimers();
      buy = "activating";
      const ok = await activate(s.key);
      buy = ok ? "idle" : "error"; // on ok, isSupporter flips and the card re-renders
      if (ok) order = null;
      return;
    }
    if (s.status === "expired") {
      stopTimers();
      buy = "expired";
      return;
    }
    if (s.status === "unknown" && ++unknownStreak >= 3) {
      stopTimers();
      buy = "error";
    }
  }

  async function copy(what: "acct" | "memo", text: string) {
    try {
      await writeText(text);
      copied = what;
      setTimeout(() => (copied = ""), 1500);
    } catch {
      /* ignore */
    }
  }

  onDestroy(stopTimers);
</script>

<section>
  <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
    {$t("sup.title")}
  </h2>

  {#if isSupporter}
    <p class="text-sm" style="color: var(--color-text)">
      ★ {$t("sup.active")}
      {#if license.keyMasked}
        <span class="ml-1 font-mono text-xs" style="color: var(--color-muted)"
          >{license.keyMasked}</span
        >
      {/if}
    </p>
    {#if license.grace}
      <p class="mt-1 text-xs" style="color: #ffd591">{$t("sup.grace")}</p>
    {/if}
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
        style="border-color: var(--color-border)"
        disabled={busy}
        onclick={() => void refresh()}
      >
        {busy ? $t("sup.checking") : $t("sup.recheck")}
      </button>
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm"
        style="border-color: var(--color-border); color: var(--color-muted)"
        onclick={() => void clearLicense()}
      >
        {$t("sup.remove")}
      </button>
    </div>
  {:else}
    <p class="text-xs leading-relaxed" style="color: var(--color-muted)">
      {$t("sup.pitch")}
    </p>
    <ul class="mt-1 ml-4 list-disc text-xs leading-relaxed" style="color: var(--color-muted)">
      <li>{$t("sup.perk_companion")}</li>
      <li>{$t("sup.perk_liveskin")}</li>
      <li>{$t("sup.perk_presets")}</li>
      <li>{$t("sup.perk_more")}</li>
    </ul>

    <!-- 1. Mua mã (VN bank transfer, auto) -->
    <div class="mt-3 rounded border p-3" style="border-color: var(--color-border)">
      {#if buy === "idle" || buy === "error" || buy === "unconfigured"}
        <button
          class="cursor-pointer rounded border px-3 py-1.5 text-sm font-semibold"
          style="border-color: var(--color-accent); color: var(--color-accent)"
          onclick={() => void startOrder()}
        >
          {$t("sup.buy_btn")}
        </button>
        <p class="mt-1 text-xs" style="color: var(--color-muted)">{$t("sup.price_hint")}</p>
        {#if buy === "error"}
          <p class="mt-1 text-xs" style="color: #ff8a80">{$t("sup.buy_err")}</p>
        {:else if buy === "unconfigured"}
          <p class="mt-1 text-xs" style="color: #ffd591">{$t("sup.buy_unconfigured")}</p>
        {/if}
      {:else if buy === "creating"}
        <p class="text-sm" style="color: var(--color-muted)">{$t("sup.buy_creating")}</p>
      {:else if buy === "await" && order}
        {@const o = order}
        <p class="mb-2 text-sm">{$t("sup.buy_scan")}</p>
        <div class="flex flex-wrap items-start gap-3">
          {#if !qrFailed}
            <img
              src={o.qrUrl}
              alt={$t("sup.buy_qr_alt")}
              width="190"
              height="190"
              class="rounded bg-white p-1"
              onerror={() => (qrFailed = true)}
            />
          {/if}
          <div class="min-w-0 flex-1 text-xs" style="color: var(--color-text)">
            <div class="mb-1">
              <span style="color: var(--color-muted)">{$t("sup.buy_amount")}:</span>
              <b class="ml-1">{fmtVnd(o.amount)}</b>
            </div>
            <div class="mb-1">
              <span style="color: var(--color-muted)">{$t("sup.buy_bank")}:</span>
              <span class="ml-1">{o.bank.name || o.bank.bin} · </span>
              <span class="font-mono">{o.bank.account}</span>
              <button
                class="ml-1 cursor-pointer underline"
                style="color: var(--color-accent)"
                onclick={() => void copy("acct", o.bank.account)}
                >{copied === "acct" ? $t("sup.buy_copied") : $t("sup.buy_copy")}</button
              >
            </div>
            <div class="mb-1">
              <span style="color: var(--color-muted)">{$t("sup.buy_memo")}:</span>
              <b class="ml-1 font-mono tracking-wider" style="color: var(--color-accent)"
                >{o.code}</b
              >
              <button
                class="ml-1 cursor-pointer underline"
                style="color: var(--color-accent)"
                onclick={() => void copy("memo", o.code)}
                >{copied === "memo" ? $t("sup.buy_copied") : $t("sup.buy_copy")}</button
              >
            </div>
            <p class="mt-1" style="color: #ffd591">⚠ {$t("sup.buy_memo_warn")}</p>
          </div>
        </div>
        <p class="mt-2 flex items-center gap-2 text-sm" style="color: var(--color-muted)">
          <span
            class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          ></span>
          {$t("sup.buy_waiting")}
          <span class="ml-auto font-mono text-xs">{$t("sup.buy_expires", { t: remainLabel })}</span>
        </p>
        <button
          class="mt-1 cursor-pointer text-xs underline"
          style="color: var(--color-muted)"
          onclick={cancelOrder}
        >
          {$t("sup.buy_cancel")}
        </button>
      {:else if buy === "activating"}
        <p class="text-sm" style="color: var(--color-accent)">{$t("sup.buy_activating")}</p>
      {:else if buy === "expired"}
        <p class="text-sm" style="color: #ffd591">{$t("sup.buy_expired")}</p>
        <button
          class="mt-1 cursor-pointer rounded border px-3 py-1 text-sm"
          style="border-color: var(--color-accent); color: var(--color-accent)"
          onclick={() => void startOrder()}
        >
          {$t("sup.buy_new")}
        </button>
      {/if}
    </div>

    <!-- 2. Ko-fi (foreign) -->
    <button
      class="mt-3 cursor-pointer text-xs underline"
      style="color: var(--color-accent)"
      onclick={() => void openUrl(SUPPORT_URL)}
    >
      {$t("sup.get_key")}
    </button>

    <!-- 3. paste a key you were given -->
    <div class="mt-3 flex flex-wrap gap-2">
      <input
        type="text"
        class="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 font-mono text-sm"
        style="border-color: var(--color-border)"
        placeholder="BUMBUM-XXXX-XXXX-XXXX"
        spellcheck="false"
        autocomplete="off"
        bind:value={keyInput}
        onkeydown={(e) => e.key === "Enter" && void onActivate()}
      />
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
        style="border-color: var(--color-accent); color: var(--color-accent)"
        disabled={busy || !keyInput.trim()}
        onclick={() => void onActivate()}
      >
        {busy ? $t("sup.checking") : $t("sup.activate")}
      </button>
    </div>

    {#if license.phase === "error" && errorText}
      <p class="mt-2 text-sm" style="color: #ff8a80">{errorText}</p>
    {/if}
  {/if}
</section>
