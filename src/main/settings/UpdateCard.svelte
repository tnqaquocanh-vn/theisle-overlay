<script lang="ts">
  // Settings → "App updates". Manual check + the download/install flow +
  // the "check on startup" toggle. The shared state also drives the banner
  // in App.svelte, so a check started here shows there too.
  import { t } from "$lib/i18n";
  import { updater, checkForUpdate, installUpdate } from "$lib/updater.svelte";

  let { autoCheck, onautocheck }: { autoCheck: boolean; onautocheck: (v: boolean) => void } =
    $props();

  const pct = $derived(Math.round(updater.progress * 100));
  const busy = $derived(updater.phase === "checking" || updater.phase === "downloading");
</script>

<section>
  <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
    {$t("update.title")}
  </h2>

  <p class="mb-2 text-xs" style="color: var(--color-muted)">
    {$t("update.current", { version: __APP_VERSION__ })}
  </p>

  <div class="flex flex-wrap items-center gap-2">
    <button
      class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
      style="border-color: var(--color-border)"
      disabled={busy}
      onclick={() => void checkForUpdate(false)}
    >
      {updater.phase === "checking" ? $t("update.checking") : $t("update.check")}
    </button>

    {#if updater.phase === "available"}
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm"
        style="border-color: var(--color-accent); color: var(--color-accent)"
        onclick={() => void installUpdate()}
      >
        {$t("update.install", { version: updater.version ?? "" })}
      </button>
    {/if}
  </div>

  {#if updater.phase === "available"}
    <p class="mt-2 text-sm" style="color: var(--color-text)">
      {$t("update.available", { version: updater.version ?? "" })}
    </p>
    {#if updater.notes}
      <details class="mt-1">
        <summary class="cursor-pointer text-xs font-semibold" style="color: var(--color-muted)">
          {$t("update.notes")}
        </summary>
        <pre class="mt-1 max-h-40 overflow-auto rounded p-2 text-xs"
          style="background: var(--color-bg); color: var(--color-muted); white-space: pre-wrap">{updater.notes}</pre>
      </details>
    {/if}
  {:else if updater.phase === "downloading"}
    <div class="mt-2">
      <div class="h-1.5 overflow-hidden rounded" style="background: var(--color-border)">
        <div class="h-full" style="width: {pct}%; background: var(--color-accent)"></div>
      </div>
      <p class="mt-1 text-xs" style="color: var(--color-muted)">
        {$t("update.downloading", { pct })}
      </p>
    </div>
  {:else if updater.phase === "ready"}
    <p class="mt-2 text-sm" style="color: var(--color-accent)">{$t("update.ready")}</p>
  {:else if updater.phase === "uptodate"}
    <p class="mt-2 text-sm" style="color: var(--color-muted)">{$t("update.uptodate")}</p>
  {:else if updater.phase === "error"}
    <p class="mt-2 text-sm" style="color: #ff8a80">
      {$t("update.error", { err: updater.error ?? "" })}
    </p>
  {/if}

  <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={autoCheck}
      onchange={(e) => onautocheck(e.currentTarget.checked)}
    />
    {$t("update.auto_check")}
  </label>
  <p class="mt-1 text-xs leading-relaxed" style="color: var(--color-muted)">
    {$t("update.auto_check_hint")}
  </p>
</section>
