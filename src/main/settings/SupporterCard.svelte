<script lang="ts">
  // Settings → "Người ủng hộ". Shows the current tier, activates a pasted key,
  // and links out to the support page. The free core is never gated — this
  // card only unlocks the extras listed in the license plan.
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { t } from "$lib/i18n";
  import { license, activate, refresh, clearLicense } from "$lib/license.svelte";

  // TODO(BumBum): thay bằng trang Ko-fi / PayPal.me của bạn. Host phải nằm
  // trong allowlist ở src-tauri/capabilities/default.json (ko-fi.com,
  // www.paypal.com, paypal.me đã được thêm sẵn).
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

    <button
      class="mt-3 cursor-pointer text-xs underline"
      style="color: var(--color-accent)"
      onclick={() => void openUrl(SUPPORT_URL)}
    >
      {$t("sup.get_key")}
    </button>
    <p class="mt-1 text-xs" style="color: var(--color-muted)">{$t("sup.price_hint")}</p>
  {/if}
</section>
