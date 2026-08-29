<script lang="ts">
  // A1 — first-run wizard. Shown once, full-window, when settings.onboarding_done
  // is not true (a fresh install; load_settings() forces it true on upgrade so
  // existing users are never nagged). Walks a new user through the one-time
  // setup the old app left them to discover: map data, the optional IslePilot
  // link, and where the hotkeys live. The "Run setup again" button in Settings
  // flips the flag back to reach this.
  import { onMount } from "svelte";
  import {
    getDataStatus,
    getSettings,
    islepilotState,
    listenerBag,
    onFetchFinished,
    onFetchProgress,
    patchSettings,
    startFetchData,
    type FetchProgress,
    type Settings,
  } from "$lib/api";
  import { t } from "$lib/i18n";

  let { oncomplete }: { oncomplete: () => void } = $props();

  const STEPS = ["welcome", "data", "islepilot", "hotkeys", "done"] as const;
  let step = $state(0);
  const isLast = $derived(step === STEPS.length - 1);

  // --- step 2: map data ---
  type DataPhase = "checking" | "idle" | "running" | "have" | "partial" | "failed";
  let dataPhase = $state<DataPhase>("checking");
  let progress = $state<FetchProgress[]>([]);
  const dataReady = $derived(dataPhase === "have");

  // --- step 3: IslePilot (optional) ---
  let ipLinked = $state<boolean | null>(null);

  // --- step 4: hotkeys ---
  let hotkeys = $state<Record<string, string>>({});
  const HOTKEY_ROWS = ["toggle_minimap", "toggle_fullmap", "mark_here", "map_snapshot"] as const;

  let finishing = $state(false);

  onMount(() => {
    const bag = listenerBag();
    (async () => {
      const s = (await getSettings()) as Settings;
      hotkeys = (s.hotkeys as Record<string, string>) ?? {};

      const d = await getDataStatus();
      dataPhase = d.basemapMinimap && d.basemapFullmap ? "have" : "idle";

      await bag.add(
        onFetchProgress((p) => {
          const i = progress.findIndex((x) => x.file === p.file);
          if (i >= 0) progress[i] = p;
          else progress = [...progress, p];
        }),
      );
      await bag.add(
        onFetchFinished((f) => {
          dataPhase = f.ok ? "have" : f.basemapOk ? "partial" : "failed";
        }),
      );
      void refreshIp();
    })();
    return () => bag.dispose();
  });

  async function refreshIp() {
    try {
      ipLinked = (await islepilotState()).loggedIn;
    } catch {
      ipLinked = false;
    }
  }

  function startDownload() {
    progress = [];
    dataPhase = "running";
    void startFetchData(false);
  }

  function next() {
    if (step === 2) void refreshIp(); // leaving the IslePilot step — re-check
    if (!isLast) step += 1;
  }
  function back() {
    if (step > 0) step -= 1;
  }

  async function finish() {
    finishing = true;
    try {
      await patchSettings({ onboarding_done: true });
    } catch {
      /* even if the write fails, don't trap the user on this screen */
    }
    oncomplete();
  }

  const ICONS: Record<FetchProgress["status"], string> = {
    downloading: "⏳",
    done: "✓",
    skipped: "•",
    error: "✗",
  };
</script>

<div class="wrap">
  <div class="card">
    <header>
      <svg viewBox="0 0 24 24" class="mark" aria-hidden="true">
        <ellipse cx="12" cy="9" rx="3" ry="7.5" fill="currentColor" />
        <ellipse cx="6" cy="13" rx="2.4" ry="6" transform="rotate(-22 6 13)" fill="currentColor" />
        <ellipse cx="18" cy="13" rx="2.4" ry="6" transform="rotate(22 18 13)" fill="currentColor" />
        <ellipse cx="12" cy="20" rx="3.4" ry="3" fill="currentColor" />
      </svg>
      <span class="wordmark">{$t("app.title")}</span>
      <span class="count">{String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span>
    </header>

    <div class="track" aria-hidden="true">
      <div class="fill" style="width: {((step + 1) / STEPS.length) * 100}%"></div>
    </div>

    <div class="body">
      {#if step === 0}
        <h2>{$t("welcome.s1_title")}</h2>
        <p>{$t("welcome.s1_body")}</p>
        <p class="note">{$t("welcome.s1_anticheat")}</p>
      {:else if step === 1}
        <h2>{$t("welcome.s2_title")}</h2>
        <p>{$t("welcome.s2_body")}</p>
        {#if dataPhase === "have"}
          <p class="ok">✓ {$t("welcome.s2_have")}</p>
        {:else}
          {#if dataPhase === "idle" || dataPhase === "failed" || dataPhase === "partial"}
            <button class="btn amber" onclick={startDownload}>
              {dataPhase === "idle" ? $t("welcome.s2_download") : $t("welcome.s2_retry")}
            </button>
          {/if}
          {#if progress.length > 0}
            <ul class="files">
              {#each progress as p (p.file)}
                <li>
                  <span class="ic" class:err={p.status === "error"} class:done={p.status === "done"}
                    >{ICONS[p.status]}</span
                  >
                  <span>{p.file}</span>
                </li>
              {/each}
            </ul>
          {/if}
          {#if dataPhase === "running"}<p class="muted">{$t("welcome.s2_downloading")}</p>
          {:else if dataPhase === "partial"}<p class="warn">{$t("welcome.s2_partial")}</p>
          {:else if dataPhase === "failed"}<p class="err-text">{$t("welcome.s2_failed")}</p>
          {/if}
        {/if}
      {:else if step === 2}
        <h2>{$t("welcome.s3_title")} <span class="opt">{$t("welcome.s3_opt")}</span></h2>
        <p>{$t("welcome.s3_body")}</p>
        {#if ipLinked === true}
          <p class="ok">✓ {$t("welcome.s3_linked")}</p>
        {:else if ipLinked === false}
          <p class="muted">{$t("welcome.s3_notlinked")}</p>
        {/if}
      {:else if step === 3}
        <h2>{$t("welcome.s4_title")}</h2>
        <p>{$t("welcome.s4_body")}</p>
        <ul class="keys">
          {#each HOTKEY_ROWS as action (action)}
            <li>
              <span>{$t(`hotkey.${action}` as never)}</span>
              <kbd>{hotkeys[action] ?? "—"}</kbd>
            </li>
          {/each}
        </ul>
      {:else}
        <h2>{$t("welcome.s5_title")}</h2>
        <p>{$t("welcome.s5_body")}</p>
      {/if}
    </div>

    <footer>
      <button class="btn ghost" onclick={back} disabled={step === 0}>{$t("welcome.back")}</button>
      <span class="spacer"></span>
      {#if step === 2 && ipLinked !== true}
        <button class="btn ghost" onclick={next}>{$t("welcome.skip")}</button>
      {/if}
      {#if isLast}
        <button class="btn amber" onclick={finish} disabled={finishing}>{$t("welcome.start")}</button>
      {:else}
        <button class="btn amber" onclick={next} disabled={step === 1 && !dataReady}>
          {$t("welcome.next")}
        </button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem 1.25rem;
    background: var(--color-bg);
  }
  .card {
    width: 100%;
    max-width: 34rem;
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg, 10px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 24px 50px -24px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 1rem 1.25rem 0.85rem;
    color: var(--amber);
  }
  .mark {
    width: 20px;
    height: 20px;
    flex: none;
  }
  .wordmark {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--ink);
  }
  .count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    color: var(--ink-mute);
  }
  .track {
    height: 2px;
    background: color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .fill {
    height: 100%;
    background: var(--amber);
    transition: width var(--dur-panel, 180ms) var(--ease-out, ease);
  }
  .body {
    padding: 1.4rem 1.25rem 0.5rem;
    min-height: 12.5rem;
  }
  h2 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.3rem;
    color: var(--ink);
    margin: 0 0 0.6rem;
  }
  .opt {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.1em 0.45em;
    vertical-align: middle;
  }
  p {
    margin: 0 0 0.7rem;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--ink-mid);
  }
  .note {
    font-size: 0.82rem;
    color: var(--ink-mute);
    border-left: 2px solid var(--amber-line, var(--amber));
    padding-left: 0.7rem;
  }
  .muted {
    color: var(--ink-mute);
    font-size: 0.85rem;
  }
  .ok {
    color: var(--moss);
    font-size: 0.88rem;
  }
  .warn {
    color: var(--amber);
    font-size: 0.85rem;
  }
  .err-text {
    color: var(--blood);
    font-size: 0.85rem;
  }
  .files {
    list-style: none;
    margin: 0.4rem 0 0.7rem;
    padding: 0;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .files li {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--ink-mid);
    padding: 0.1rem 0;
  }
  .files .ic {
    color: var(--ink-mute);
  }
  .files .ic.done {
    color: var(--moss);
  }
  .files .ic.err {
    color: var(--blood);
  }
  .keys {
    list-style: none;
    margin: 0.2rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .keys li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.86rem;
    color: var(--ink-mid);
  }
  .keys li:last-child {
    border-bottom: 0;
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--ink) 8%, transparent);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.12em 0.5em;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1.25rem 1.1rem;
    border-top: 1px solid var(--color-border);
  }
  .spacer {
    flex: 1;
  }
  .btn {
    cursor: pointer;
    font: inherit;
    font-size: 0.86rem;
    border-radius: var(--radius-sm, 6px);
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--ink-mid);
    transition:
      background var(--dur-micro, 120ms) var(--ease-out, ease),
      color var(--dur-micro, 120ms) var(--ease-out, ease);
  }
  .btn.ghost:hover:not(:disabled) {
    color: var(--ink);
    background: color-mix(in srgb, var(--ink) 6%, transparent);
  }
  .btn.amber {
    background: var(--amber);
    color: var(--color-bg);
    border-color: var(--amber);
    font-weight: 600;
  }
  .btn.amber:hover:not(:disabled) {
    background: color-mix(in srgb, var(--amber) 88%, white);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn:focus-visible {
    outline: 2px solid var(--biolum);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .fill,
    .btn {
      transition: none;
    }
  }
</style>
