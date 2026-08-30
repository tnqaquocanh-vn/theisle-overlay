<script lang="ts">
  // Main window shell: tab navigation (map | settings | guide), the
  // exclusive-fullscreen warning banner, and locale bootstrapping.
  import { onMount } from "svelte";
  import {
    getDataStatus,
    getFullscreenMode,
    getSettings,
    listenerBag,
    onFetchFinished,
    onFullmapShow,
    onHotkeyFailed,
    onSettingsChanged,
    onSupporterRequired,
    onTeamMark,
    onTeamWaypoint,
    simulatePosition,
    trackFeature,
    type DataStatus,
    type FailedHotkey,
    type Feature,
  } from "$lib/api";
  import { locale, t, type Locale } from "$lib/i18n";
  import { updater, checkForUpdate, installUpdate, dismissUpdate } from "$lib/updater.svelte";
  import { loadLicense } from "$lib/license.svelte";
  import FullMap from "./fullmap/FullMap.svelte";
  import Footer from "./Footer.svelte";
  import NavRail from "./NavRail.svelte";
  import DinoTab from "./dino/DinoTab.svelte";
  import GarageTab from "./garage/GarageTab.svelte";
  import SkinEditor from "./skin/SkinEditor.svelte";
  import Settings from "./settings/Settings.svelte";
  import Guide from "./guide/Guide.svelte";
  import FirstRun from "./firstrun/FirstRun.svelte";
  import Welcome from "./firstrun/Welcome.svelte";

  type Tab = "map" | "dino" | "garage" | "skin" | "settings" | "guide";
  const initialTab = ["map", "dino", "garage", "skin", "settings", "guide"].includes(
    location.hash.slice(1),
  )
    ? (location.hash.slice(1) as Tab)
    : "map";

  // Lucide-style tab icons (24x24, stroke = currentColor) as inline path
  // markup — no icon library, and the color follows the button state.
  const TAB_ICONS: Record<Tab, string> = {
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    dino: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    garage:
      '<path d="M22 8.35V20a2 2 0 0 1-2 2h-4v-9H8v9H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/>',
    skin: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>',
    settings:
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    guide:
      '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  };
  let tab = $state<Tab>(initialTab);
  let innerWidth = $state(1280);
  const NAV_TABS: Tab[] = ["map", "dino", "garage", "skin", "settings", "guide"];
  const navItems = $derived(
    NAV_TABS.map((key) => ({ key, label: $t(`tab.${key}` as never), icon: TAB_ICONS[key] })),
  );
  // Write-back so F5 restores the tab the user was on (the hash was already
  // read above; nothing ever wrote it). replaceState: no history spam.
  $effect(() => {
    history.replaceState(null, "", `#${tab}`);
  });
  // Which tabs people actually open. Everything else is counted in Rust, so
  // the hotkey and UI paths to the same action share one counter.
  // Deliberately a total Record, not Partial: adding a tab without deciding
  // how it is counted should be a compile error, not a silent zero.
  const TAB_FEATURE: Record<Tab, Feature> = {
    map: "fullmap_open",
    dino: "dino_tab_open",
    garage: "islepilot_garage",
    // Shares the garage slot: same 3D/CDN surface, and the telemetry slot
    // array is full (see counters.rs — a new slot needs a data-point bump).
    skin: "islepilot_garage",
    settings: "settings_open",
    guide: "guide_open",
  };
  // The first run of this effect is where the app OPENED — the default tab,
  // or whatever hash a reload restored — not somewhere the user went. It is
  // skipped: counting it inflated fullmap_open by one per launch, and
  // launches are already counted on the Rust side.
  let tabEffectPrimed = false;
  $effect(() => {
    const feature = TAB_FEATURE[tab];
    if (!tabEffectPrimed) {
      tabEffectPrimed = true;
      return;
    }
    trackFeature(feature);
  });
  // Map, Dino and Garage tabs are KEPT ALIVE after their first visit (hidden
  // with display:none, not unmounted). Dino/Garage host a 3D viewer whose
  // teardown/rebuild made tab switching visibly laggy; the map is a Leaflet
  // instance over ~630 POI objects behind a 16-call IPC chain, and telemetry
  // shows people come back to it about twice a session. First visit still
  // lazy-mounts so an untouched tab costs nothing.
  let visitedMap = $state(false);
  let visitedDino = $state(false);
  let visitedGarage = $state(false);
  let visitedSkin = $state(false);
  $effect(() => {
    if (tab === "map") visitedMap = true;
    if (tab === "dino") visitedDino = true;
    if (tab === "garage") visitedGarage = true;
    if (tab === "skin") visitedSkin = true;
  });
  let dataStatus = $state<DataStatus | null>(null);
  let exclusiveFullscreen = $state(false);
  let failedHotkeys = $state<FailedHotkey[]>([]);
  let ready = $state(false);
  // A1: the first-run wizard runs full-window until it's done. Assume done
  // until settings load so an established user never flashes the wizard;
  // load_settings() also forces onboarding_done true on any upgrade.
  let onboardingDone = $state(true);
  let wizardDismissed = $state(false);
  const showWizard = $derived(ready && !onboardingDone && !wizardDismissed);
  let teamToast = $state<string | null>(null);
  let teamToastTimer: ReturnType<typeof setTimeout> | undefined;
  function showTeamToast(text: string) {
    teamToast = text;
    clearTimeout(teamToastTimer);
    teamToastTimer = setTimeout(() => (teamToast = null), 6000);
  }
  // A supporter-gated action was blocked in Rust (companion / big map). A soft
  // nudge, not an error — the free core is never touched.
  let supporterToast = $state<string | null>(null);
  let supporterToastTimer: ReturnType<typeof setTimeout> | undefined;
  function showSupporterToast(text: string) {
    supporterToast = text;
    clearTimeout(supporterToastTimer);
    supporterToastTimer = setTimeout(() => (supporterToast = null), 7000);
  }
  // Remount FullMap when the basemap changes ({#key} below): the imageOverlay
  // bounds and every layer's px change together, so a rebuild IS the correct
  // "in-place" update. Seeded before ready=true — no spurious first remount.
  // The colour profile is on the same key: every layer's colour is baked into
  // its Leaflet path at build time, so a swap needs the same full rebuild.
  let basemapSource = $state("vulnona");
  let colorProfile = $state("default");
  // A9: the selected ground palette. <html data-skin> drives every --color-*
  // in the window; "obsidian" (default) has no CSS block and falls through.
  let skin = $state("obsidian");
  // A8: drive the --sem-* status colours (stat bars, HP thresholds) off the
  // same accessibility setting the map-layer palette uses.
  $effect(() => {
    document.documentElement.dataset.colorProfile = colorProfile;
  });
  $effect(() => {
    document.documentElement.dataset.skin = skin;
  });

  // POIs are optional (fail-soft: the map works without dots); the basemap
  // images are the hard requirement.
  const dataOk = $derived(
    dataStatus !== null && dataStatus.basemapMinimap && dataStatus.basemapFullmap,
  );

  onMount(() => {
    const bag = listenerBag();
    (async () => {
      const settings = await getSettings();
      locale.set((settings.language as Locale) ?? "vi");
      basemapSource = settings.map?.basemap ?? "vulnona";
      colorProfile = (settings.color_profile as string) ?? "default";
      skin = (settings.skin as string) ?? "obsidian";
      onboardingDone = settings.onboarding_done === true;
      dataStatus = await getDataStatus();
      exclusiveFullscreen = (await getFullscreenMode()) === 0;
      await bag.add(
        onSettingsChanged((s) => {
          locale.set((s.language as Locale) ?? "vi");
          basemapSource = s.map?.basemap ?? "vulnona";
          colorProfile = (s.color_profile as string) ?? "default";
          skin = (s.skin as string) ?? "obsidian";
          // "Run setup again" (Settings) flips this back to false.
          onboardingDone = s.onboarding_done === true;
          if (!onboardingDone) wizardDismissed = false;
        }),
      );
      await bag.add(onHotkeyFailed((failed) => (failedHotkeys = failed)));
      await bag.add(
        onTeamMark((m) => showTeamToast($t("team.mark_toast", { from: m.from }))),
      );
      await bag.add(
        onTeamWaypoint((e) => {
          if (e.own) return;
          showTeamToast($t("team.wp_toast", { from: e.from, name: e.name }));
        }),
      );
      // Full-map hotkey mid-game: land on the map, not the last-open tab.
      await bag.add(onFullmapShow(() => (tab = "map")));
      // Supporter status for the UI gates (Rust keeps its own flag). Fire and
      // forget — a failure just leaves everyone on the free tier.
      void loadLicense();
      await bag.add(
        onSupporterRequired(() => showSupporterToast($t("sup.required_toast"))),
      );
      // One silent check on startup — surfaces the green banner only if a
      // newer signed release exists; failures/no-op stay quiet.
      if (settings.updates?.auto_check ?? true) void checkForUpdate(true);
      // The download can finish while the user is on another tab (FirstRun
      // unmounted) — the App itself must notice and unlock the map tab.
      await bag.add(onFetchFinished(() => void getDataStatus().then((d) => (dataStatus = d))));
      ready = true;
    })();
    return () => bag.dispose();
  });

  // Dev-only: walk south-east to exercise the pipeline without the game.
  let simX = -231654;
  function simulateStep() {
    simX += 30_000;
    void simulatePosition(simX, 52099.673, 0);
  }
</script>

<svelte:window bind:innerWidth />

{#if showWizard}
  <Welcome
    oncomplete={() => {
      wizardDismissed = true;
      void getDataStatus().then((d) => (dataStatus = d));
    }}
  />
{:else}
<div class="flex h-screen flex-col">
  <div class="flex min-h-0 flex-1">
    <NavRail
      {tab}
      items={navItems}
      collapsed={innerWidth > 0 && innerWidth < 880}
      version={__APP_VERSION__}
      onSelect={(k) => (tab = k as Tab)}
      onDevStep={import.meta.env.DEV ? simulateStep : undefined}
    />

    <div class="flex min-h-0 flex-1 flex-col">
      {#if teamToast}
        <div
          class="flex shrink-0 items-center gap-2 px-3 py-2 text-sm"
          style="background: #4a1a10; color: #ffb4a1"
        >
          ⚠ {teamToast}
        </div>
      {/if}

      {#if supporterToast}
        <button
          class="flex shrink-0 cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm"
          style="background: var(--color-bg-elev, #23202b); color: var(--color-accent)"
          onclick={() => {
            tab = "settings";
            supporterToast = null;
          }}
        >
          ★ {supporterToast}
        </button>
      {/if}

      {#if failedHotkeys.length > 0}
        <div
          class="shrink-0 px-3 py-2 text-sm"
          style="background: #4a1a10; color: #ffb4a1"
        >
          ⚠ {$t("warn.hotkey_failed")}
          {failedHotkeys
            .map((f) => `${f.spec} (${$t(`hotkey.${f.action}` as never)})`)
            .join(", ")}
          <button
            class="ml-2 cursor-pointer underline"
            onclick={() => (failedHotkeys = [])}
          >
            {$t("btn.close")}
          </button>
        </div>
      {/if}

      {#if exclusiveFullscreen}
        <div
          class="shrink-0 px-3 py-2 text-sm"
          style="background: #4a3210; color: #ffd591"
        >
          ⚠ {$t("warn.exclusive_fullscreen")}
          <button
            class="ml-2 cursor-pointer underline"
            onclick={() => (exclusiveFullscreen = false)}
          >
            {$t("btn.close")}
          </button>
        </div>
      {/if}

      {#if updater.phase === "available" || updater.phase === "downloading" || updater.phase === "ready"}
        <div
          class="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 text-sm"
          style="background: #12331f; color: #a9e8c4"
        >
          {#if updater.phase === "available"}
            <span>↑ {$t("update.available", { version: updater.version ?? "" })}</span>
            <button
              class="cursor-pointer rounded border px-2 py-0.5"
              style="border-color: currentColor"
              onclick={() => void installUpdate()}
            >
              {$t("update.install", { version: updater.version ?? "" })}
            </button>
            <button class="cursor-pointer underline" onclick={dismissUpdate}>
              {$t("update.later")}
            </button>
          {:else if updater.phase === "downloading"}
            <span>{$t("update.downloading", { pct: Math.round(updater.progress * 100) })}</span>
          {:else}
            <span>{$t("update.ready")}</span>
          {/if}
        </div>
      {/if}

      <main class="min-h-0 flex-1">
    {#if !ready}
      <div class="p-6" style="color: var(--color-muted)">…</div>
    {:else if tab === "map" && !dataOk}
      <!-- Only the map needs the downloaded data; the other tabs must stay
           usable during (and before) the first-run download. The map itself
           lives in the kept-alive block below. -->
      <FirstRun oncomplete={() => void getDataStatus().then((d) => (dataStatus = d))} />
    {:else if tab === "settings"}
      <div class="h-full overflow-y-auto"><Settings /></div>
    {:else if tab === "guide"}
      <div class="h-full overflow-y-auto"><Guide /></div>
    {/if}
    <!-- Kept-alive tabs (see visitedMap/visitedDino/visitedGarage above).
         All are error-isolated: a Leaflet throw, a failure in the IslePilot
         integration or the 3D viewer must never take down the shell (and
         its tab bar) or any other feature. -->
    {#if ready && dataOk && visitedMap}
      <div class="h-full min-h-0" style:display={tab === "map" ? null : "none"}>
        {#key `${basemapSource}:${colorProfile}`}
          <svelte:boundary>
            <FullMap visible={tab === "map"} />
            {#snippet failed(_error, reset)}
              <div class="mx-auto max-w-lg p-8">
                <p class="mb-3 text-sm" style="color: #ff8a80">{$t("map.crashed")}</p>
                <button
                  class="cursor-pointer rounded border px-3 py-1 text-sm"
                  style="border-color: var(--color-border)"
                  onclick={reset}
                >
                  {$t("btn.retry")}
                </button>
              </div>
            {/snippet}
          </svelte:boundary>
        {/key}
      </div>
    {/if}
    {#if ready && visitedDino}
      <div class="h-full overflow-y-auto" style:display={tab === "dino" ? null : "none"}>
        <svelte:boundary>
          <DinoTab />
          {#snippet failed(_error, reset)}
            <div class="mx-auto max-w-lg p-8">
              <p class="mb-3 text-sm" style="color: #ff8a80">{$t("dino.crashed")}</p>
              <button
                class="cursor-pointer rounded border px-3 py-1 text-sm"
                style="border-color: var(--color-border)"
                onclick={reset}
              >
                {$t("btn.retry")}
              </button>
            </div>
          {/snippet}
        </svelte:boundary>
      </div>
    {/if}
    {#if ready && visitedGarage}
      <div class="h-full overflow-y-auto" style:display={tab === "garage" ? null : "none"}>
        <svelte:boundary>
          <GarageTab />
          {#snippet failed(_error, reset)}
            <div class="mx-auto max-w-lg p-8">
              <p class="mb-3 text-sm" style="color: #ff8a80">{$t("dino.crashed")}</p>
              <button
                class="cursor-pointer rounded border px-3 py-1 text-sm"
                style="border-color: var(--color-border)"
                onclick={reset}
              >
                {$t("btn.retry")}
              </button>
            </div>
          {/snippet}
        </svelte:boundary>
      </div>
    {/if}
    {#if ready && visitedSkin}
      <div class="h-full overflow-y-auto" style:display={tab === "skin" ? null : "none"}>
        <svelte:boundary>
          <SkinEditor />
          {#snippet failed(_error, reset)}
            <div class="mx-auto max-w-lg p-8">
              <p class="mb-3 text-sm" style="color: #ff8a80">{$t("dino.crashed")}</p>
              <button
                class="cursor-pointer rounded border px-3 py-1 text-sm"
                style="border-color: var(--color-border)"
                onclick={reset}
              >
                {$t("btn.retry")}
              </button>
            </div>
          {/snippet}
        </svelte:boundary>
      </div>
    {/if}
      </main>
    </div>
  </div>

  <Footer />
</div>
{/if}
