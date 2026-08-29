<script lang="ts">
  // v1.25 — the in-game big map. A thin shell around the same <FullMap> the
  // main window uses: a dimmed obsidian panel over the game, a one-line header
  // (label · pin · close), and the shared Amber skin / accessibility attributes
  // kept in sync. All map data comes through the existing IPC + events; this
  // webview adds no new backend surface. Ctrl+Alt+G (Rust) and Esc both close.
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { getSettings, listenerBag, onSettingsChanged } from "$lib/api";
  import { locale, t, type Locale } from "$lib/i18n";
  import FullMap from "../main/fullmap/FullMap.svelte";

  let opacity = $state(0.96);
  let shown = $state(false); // drives the fade — set by the bigmap://vis event
  let pinned = $state(false);
  // <FullMap> bakes every layer's px + colour at build time, so a basemap or
  // colour-profile switch needs a full remount — same {#key} the main window
  // uses. Without it, switching the basemap while the big map is open left it
  // on the old geometry until you closed and reopened it.
  let basemap = $state("vulnona");
  let colorProfile = $state("default");

  function applySettings(s: Record<string, unknown>) {
    locale.set((s.language as Locale) ?? "vi");
    const skin = (s.skin as string) ?? "obsidian";
    colorProfile = (s.color_profile as string) ?? "default";
    basemap = ((s.map as { basemap?: string } | undefined)?.basemap as string) ?? "vulnona";
    document.documentElement.dataset.skin = skin;
    document.documentElement.dataset.colorProfile = colorProfile;
    const o = Number((s.bigmap as { opacity?: number } | undefined)?.opacity);
    opacity = Number.isFinite(o) ? Math.min(1, Math.max(0.6, o)) : 0.96;
  }

  function close() {
    void getCurrentWindow().hide();
  }
  function togglePin() {
    pinned = !pinned;
    void invoke("bigmap_set_pinned", { pinned });
  }

  onMount(() => {
    const bag = listenerBag();
    void getSettings().then(applySettings);
    void bag.add(onSettingsChanged(applySettings));
    void bag.add(
      listen<boolean>("bigmap://vis", (e) => {
        shown = e.payload;
        if (!shown) pinned = false; // Rust drops the pin on hide too
      }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      bag.dispose();
    };
  });
</script>

<div class="bm" class:in={shown} style="--bm-opacity: {opacity}">
  <header>
    <span class="dot" aria-hidden="true"></span>
    <span class="ttl">{$t("bigmap.title")}</span>
    <span class="hint">{$t("bigmap.hint")}</span>
    <button
      class="pin"
      class:on={pinned}
      onclick={togglePin}
      title={pinned ? $t("bigmap.unpin") : $t("bigmap.pin")}
      aria-pressed={pinned}
    >
      📌 {pinned ? $t("bigmap.pinned") : $t("bigmap.pin")}
    </button>
    <button class="x" onclick={close} title={$t("btn.close")} aria-label={$t("btn.close")}>✕</button>
  </header>
  <div class="map">
    {#key `${basemap}:${colorProfile}`}
      <FullMap visible={true} />
    {/key}
  </div>
</div>

<style>
  .bm {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: color-mix(in srgb, var(--color-bg) calc(var(--bm-opacity) * 100%), transparent);
    color: var(--ink);
    opacity: 0;
    transition: opacity var(--dur-map, 200ms) var(--ease-out, ease);
  }
  .bm.in {
    opacity: 1;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.4rem 0.8rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-panel);
    flex: none;
    user-select: none;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--amber);
    flex: none;
  }
  .ttl {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--ink);
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.03em;
    color: var(--ink-mute);
  }
  .pin,
  .x {
    cursor: pointer;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--ink-mid);
    border-radius: var(--radius-sm, 6px);
    font-size: 0.72rem;
    line-height: 1;
    padding: 0.32rem 0.5rem;
  }
  .pin {
    margin-left: auto;
  }
  .pin.on {
    color: var(--color-bg);
    background: var(--amber);
    border-color: var(--amber);
    font-weight: 600;
  }
  .pin:hover:not(.on),
  .x:hover {
    color: var(--ink);
    border-color: var(--amber);
  }
  .x {
    width: 26px;
    padding: 0;
    height: 24px;
    font-size: 0.8rem;
  }
  .map {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .bm {
      transition: none;
    }
  }
</style>
