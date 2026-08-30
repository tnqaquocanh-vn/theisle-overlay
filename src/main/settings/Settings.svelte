<script lang="ts">
  // Settings screen — the UI the old app never had (hotkeys were edited by
  // hand in settings.json). Every control writes through patch_settings, so
  // the minimap window and the Rust supervisor react live.
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import {
    applyPreset,
    deletePreset,
    getDataAgeDays,
    getLocalposStatus,
    getSettings,
    listenerBag,
    onFetchFinished,
    onSettingsChanged,
    patchSettings,
    savePreset,
    setBasemapSource,
    startFetchData,
    submitFeedback,
    type BasemapSource,
    type FeedbackCategory,
    type NpcapStatus,
    type Settings,
  } from "$lib/api";
  import { LOCALES, t } from "$lib/i18n";
  import { license } from "$lib/license.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import HotkeyEditor from "./HotkeyEditor.svelte";
  import UpdateCard from "./UpdateCard.svelte";
  import SupporterCard from "./SupporterCard.svelte";

  let settings = $state<Settings | null>(null);
  let refetching = $state(false);
  let dataAgeDays = $state<number | null>(null);
  let npcap = $state<NpcapStatus | null>(null);
  let presetName = $state("");

  // Supporter gate for the Pro-only toggles below. Rust is authoritative (it
  // clamps these settings for a free tier); this just disables the controls.
  const sup = $derived(license.tier === "supporter");
  const supLabel = (s: string) => (sup ? s : `★ ${s}`);

  onMount(() => {
    const bag = listenerBag();
    void getSettings().then((s) => (settings = s));
    void getDataAgeDays().then((d) => (dataAgeDays = d));
    void getLocalposStatus().then((s) => (npcap = s));
    void bag.add(
      onFetchFinished(() => {
        refetching = false;
        void getDataAgeDays().then((d) => (dataAgeDays = d));
      }),
    );
    // Hotkeys (Ctrl+Alt+M etc.) patch settings from Rust while this screen
    // is open. Without mirroring the broadcast, the "visible" checkbox kept
    // its stale tick after a hotkey hide, and the click meant to turn the
    // minimap back on actually sent visible:false (field report).
    void bag.add(onSettingsChanged((s) => (settings = s)));
    return () => bag.dispose();
  });

  function redownload() {
    refetching = true;
    void startFetchData(true);
  }

  async function patch(p: object) {
    settings = await patchSettings(p);
  }

  // A2 — HUD panel stacking order (dino / quests / team).
  const PANELS = ["dino", "quests", "team"] as const;
  const panelOrder = $derived.by(() => {
    const raw = (settings?.minimap as { panel_order?: string[] } | undefined)?.panel_order ?? [];
    const given = raw.filter((k): k is (typeof PANELS)[number] =>
      (PANELS as readonly string[]).includes(k),
    );
    const seen = new Set(given);
    return [...given, ...PANELS.filter((k) => !seen.has(k))];
  });
  function movePanel(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= panelOrder.length) return;
    const next = [...panelOrder];
    [next[i], next[j]] = [next[j], next[i]];
    void patch({ minimap: { panel_order: next } });
  }

  // Basemap switch: the command downloads the imagery on first selection, so
  // the active pill only moves after the command succeeds — a failed
  // (offline) download leaves settings and UI exactly as they were.
  let basemapBusy = $state<BasemapSource | null>(null);
  let basemapError = $state(false);

  async function chooseBasemap(source: BasemapSource) {
    if (basemapBusy || settings?.map.basemap === source) return;
    basemapBusy = source;
    basemapError = false;
    try {
      await setBasemapSource(source);
      settings = await getSettings();
    } catch {
      basemapError = true;
    } finally {
      basemapBusy = null;
    }
  }

  const BASEMAPS = ["vulnona", "islemaps_light", "islemaps_dark"] as const;

  // --- feedback -------------------------------------------------------------
  const FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const;
  let feedbackCategory = $state<FeedbackCategory>("bug");
  let feedbackBody = $state("");
  let feedbackContact = $state("");
  let feedbackState = $state<"idle" | "sending" | "sent" | "failed">("idle");

  async function sendFeedback() {
    if (!feedbackBody.trim() || feedbackState === "sending") return;
    feedbackState = "sending";
    try {
      await submitFeedback(feedbackCategory, feedbackBody, feedbackContact);
      feedbackBody = "";
      feedbackContact = "";
      feedbackState = "sent";
    } catch {
      // Deliberately vague: the user cannot act on "signature rejected" and
      // the only useful advice is the same either way.
      feedbackState = "failed";
    }
  }

  const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

  const openTrails = () => invoke("open_trails_folder");
</script>

{#if settings}
  <div class="mx-auto max-w-2xl space-y-8 overflow-y-auto p-6">
    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_interface")}</p>

    <!-- Language -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.language")}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each LOCALES as loc (loc.code)}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm"
            style={settings.language === loc.code
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            onclick={() => void patch({ language: loc.code })}
          >
            {loc.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Skin (A9) -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.skin")}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each ["obsidian", "bonefield", "biolum"] as sk (sk)}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm"
            style={(settings.skin ?? "obsidian") === sk
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            onclick={() => void patch({ skin: sk })}
          >
            {$t(`skin.${sk}` as never)}
          </button>
        {/each}
      </div>
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("settings.skin_hint")}
      </p>
    </section>

    <!-- Number format -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.number_format")}
      </h2>
      <div class="flex gap-2">
        {#each ["auto", "us", "eu"] as fmt (fmt)}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm"
            style={settings.number_format === fmt
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            onclick={() => void patch({ number_format: fmt })}
          >
            {$t(`format.${fmt}` as never)}
          </button>
        {/each}
      </div>
    </section>

    <!-- Colour profile -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.color_profile")}
      </h2>
      <div class="flex gap-2">
        {#each ["default", "deuteranopia"] as prof (prof)}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm"
            style={(settings.color_profile ?? "default") === prof
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            onclick={() => void patch({ color_profile: prof })}
          >
            {$t(`color.${prof}` as never)}
          </button>
        {/each}
      </div>
    </section>
    </div>

    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_hud")}</p>

    <!-- Minimap -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.minimap")}
      </h2>
      <div class="space-y-3">
        {#each [["visible", "settings.visible"], ["require_game", "settings.require_game"], ["click_through", "settings.click_through"], ["show_trail", "settings.show_trail"], ["show_waypoints", "settings.show_waypoints"], ["rotate_with_heading", "settings.rotate_minimap"], ["show_team_panel", "settings.show_team_panel"], ["last_seen_beacon", "settings.last_seen_beacon"], ["smooth_motion", "settings.smooth_motion"], ["solo_mode", "settings.solo_mode"]] as [key, labelKey] (key)}
          <Toggle
            label={$t(labelKey as never)}
            checked={Boolean((settings.minimap as never as Record<string, boolean>)[key])}
            onchange={(v) => void patch({ minimap: { [key]: v } })}
          />
        {/each}
        <Toggle
          label={$t("settings.mouse_gestures")}
          hint={$t("settings.mouse_gestures_hint")}
          checked={settings.minimap.mouse_gestures ?? false}
          onchange={(v) => void patch({ minimap: { mouse_gestures: v } })}
        />
        <!-- Supporter-only: auto-preset, diagnostics readout, sound cues -->
        <Toggle
          label={supLabel($t("settings.auto_preset"))}
          hint={sup ? undefined : $t("sup.locked_hint")}
          disabled={!sup}
          checked={sup && Boolean(settings.minimap.auto_preset)}
          onchange={(v) => void patch({ minimap: { auto_preset: v } })}
        />
        <Toggle
          label={supLabel($t("settings.minimap_diag"))}
          hint={sup ? undefined : $t("sup.locked_hint")}
          disabled={!sup}
          checked={sup && Boolean(settings.minimap.diagnostics)}
          onchange={(v) => void patch({ minimap: { diagnostics: v } })}
        />
        <Toggle
          label={supLabel($t("settings.sound_cues"))}
          hint={sup ? $t("settings.sound_cues_hint") : $t("sup.locked_hint")}
          disabled={!sup}
          checked={sup && ((settings.sound as { enabled?: boolean } | undefined)?.enabled ?? false)}
          onchange={(v) => void patch({ sound: { enabled: v } })}
        />

        <div class="text-sm">
          <div class="mb-1">{$t("settings.corner")}</div>
          <div class="grid w-40 grid-cols-2 gap-1">
            {#each CORNERS as corner (corner)}
              <button
                class="cursor-pointer rounded border px-2 py-1 text-xs"
                style={settings.minimap.corner === corner
                  ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
                  : "border-color: var(--color-border)"}
                onclick={() => void patch({ minimap: { corner } })}
              >
                {$t(`corner.${corner}` as never)}
              </button>
            {/each}
          </div>
        </div>

        <!-- A2: HUD panel stacking order -->
        <div class="text-sm">
          <div class="mb-1">{$t("settings.panel_order")}</div>
          {#each panelOrder as key, i (key)}
            <div class="flex items-center gap-2 py-0.5">
              <span class="w-44">{$t(`settings.panel_${key}` as never)}</span>
              <button
                class="cursor-pointer rounded border px-2 leading-none disabled:opacity-30"
                style="border-color: var(--color-border)"
                disabled={i === 0}
                aria-label="↑"
                onclick={() => movePanel(i, -1)}>↑</button
              >
              <button
                class="cursor-pointer rounded border px-2 leading-none disabled:opacity-30"
                style="border-color: var(--color-border)"
                disabled={i === panelOrder.length - 1}
                aria-label="↓"
                onclick={() => movePanel(i, 1)}>↓</button
              >
            </div>
          {/each}
        </div>

        {#each [["size_px", "settings.size", 180, 400, 10, "px"], ["margin_px", "settings.margin", 0, 64, 2, "px"], ["opacity", "settings.opacity", 0.25, 1, 0.05, ""], ["radius_m", "settings.radius", 150, 3000, 50, "m"]] as [key, labelKey, min, max, step, unit] (key)}
          <Slider
            label={$t(labelKey as never)}
            min={min as number}
            max={max as number}
            step={step as number}
            value={(settings.minimap as never as Record<string, number>)[key as string]}
            format={(v) => (key === "opacity" ? `${Math.round(v * 100)}%` : `${v} ${unit}`)}
            oninput={(v) => void patch({ minimap: { [key as string]: v } })}
          />
        {/each}

        <Slider
          label={$t("settings.hud_scale")}
          hint={$t("settings.hud_scale_hint")}
          min={0.65}
          max={1.75}
          step={0.05}
          value={settings.minimap.hud_scale ?? 1}
          format={(v) => `${Math.round(v * 100)}%`}
          oninput={(v) => void patch({ minimap: { hud_scale: v } })}
        />

        <Slider
          label={$t("settings.map_sharpness")}
          hint={$t("settings.map_sharpness_hint")}
          min={975}
          max={3900}
          step={25}
          value={settings.minimap.basemap_px ?? 2600}
          format={(v) => `${v} px`}
          onchange={(v) => void patch({ minimap: { basemap_px: v } })}
        />

        <!-- P5: overlay-look presets -->
        <div class="border-t pt-3 text-sm" style="border-color: var(--color-border)">
          <div class="mb-1">{$t("settings.presets")}</div>
          {#if (settings.presets ?? []).length > 0}
            <div class="mb-2 flex flex-wrap gap-1">
              {#each settings.presets as p (p.name)}
                <span
                  class="flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                  style="border-color: var(--color-border)"
                >
                  <button
                    class="cursor-pointer hover:underline"
                    onclick={async () => (settings = await applyPreset(p.name))}
                  >
                    {p.name}
                  </button>
                  <button
                    class="cursor-pointer opacity-60 hover:opacity-100"
                    aria-label={$t("btn.cancel")}
                    onclick={async () => (settings = await deletePreset(p.name))}
                  >
                    ✕
                  </button>
                </span>
              {/each}
            </div>
          {/if}
          <div class="flex gap-2">
            <input
              type="text"
              class="min-w-0 flex-1 rounded border bg-transparent px-2 py-1 text-xs"
              style="border-color: var(--color-border)"
              placeholder={$t("settings.preset_name_ph")}
              bind:value={presetName}
            />
            <button
              class="cursor-pointer rounded border px-2 py-1 text-xs"
              style="border-color: var(--color-border)"
              onclick={async () => {
                if (!presetName.trim()) return;
                settings = await savePreset(presetName.trim());
                presetName = "";
              }}
            >
              {$t("settings.preset_save")}
            </button>
          </div>
          <p class="mt-0.5 text-xs" style="color: var(--color-muted)">
            {$t("settings.presets_hint")}
          </p>
        </div>
      </div>
    </section>

    <!-- Big map (v1.25) -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.bigmap")}
      </h2>
      <Slider
        label={$t("settings.bigmap_opacity")}
        min={0.6}
        max={1}
        step={0.02}
        value={(settings.bigmap as { opacity?: number } | undefined)?.opacity ?? 0.96}
        format={(v) => `${Math.round(v * 100)}%`}
        oninput={(v) => void patch({ bigmap: { opacity: v } })}
      />
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("settings.bigmap_hint")}
      </p>
    </section>

    <!-- Companion window (A7, v1.27) — supporter-gated since v1.31 -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("companion.title")}
        {#if license.tier !== "supporter"}
          <span class="ml-1 text-xs" style="color: var(--color-muted)">★ {$t("sup.badge")}</span>
        {/if}
      </h2>
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
        style="border-color: var(--color-border)"
        disabled={license.tier !== "supporter"}
        onclick={() => void invoke("toggle_companion")}
      >
        {$t("companion.open")}
      </button>
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {license.tier === "supporter" ? $t("companion.open_hint") : $t("sup.locked_hint")}
      </p>
    </section>
    </div>

    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_autopos")}</p>

    <!-- G1: automatic position from packet capture -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.localpos")}
      </h2>
      <div class="space-y-2">
        <Toggle
          label={$t("settings.localpos_enable")}
          hint={$t("settings.localpos_disclaimer")}
          checked={settings.localpos?.enabled ?? false}
          onchange={(v) => {
            void patch({ localpos: { enabled: v } });
            void getLocalposStatus().then((s) => (npcap = s));
          }}
        />
        {#if npcap}
          <p class="text-xs" style="color: {npcap.available ? 'var(--color-muted)' : '#ffb4a1'}">
            {npcap.available
              ? $t("settings.localpos_npcap_ok")
              : $t("settings.localpos_npcap_missing")}
          </p>
          {#if !npcap.available}
            <button
              class="cursor-pointer rounded border px-2 py-1 text-xs"
              style="border-color: var(--color-border)"
              onclick={() => void openUrl(npcap!.downloadUrl)}
            >
              {$t("settings.localpos_get_npcap")}
            </button>
          {/if}
        {/if}
      </div>
    </section>
    </div>

    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_hotkeys")}</p>

    <!-- Hotkeys -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.hotkeys")}
      </h2>
      <HotkeyEditor {settings} onchanged={(s) => (settings = s)} />
    </section>
    </div>

    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_map")}</p>

    <!-- Basemap style -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.basemap")}
      </h2>
      <div class="flex flex-wrap gap-2">
        {#each BASEMAPS as source (source)}
          {@const locked = !sup && source !== "vulnona"}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
            style={settings.map.basemap === source
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            disabled={basemapBusy !== null || locked}
            onclick={() => void chooseBasemap(source)}
          >
            {locked ? "★ " : ""}{basemapBusy === source
              ? $t("basemap.downloading")
              : $t(`basemap.${source}` as never)}
          </button>
        {/each}
      </div>
      {#if basemapError}
        <p class="mt-2 text-xs" style="color: #ff8a80">{$t("basemap.failed")}</p>
      {/if}
      {#if !sup}
        <p class="mt-2 text-xs" style="color: var(--color-muted)">★ {$t("sup.locked_hint")}</p>
      {/if}
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("basemap.hint")}
      </p>
    </section>

    <!-- Data -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.data")}
      </h2>
      <div class="flex gap-2">
        <button
          class="cursor-pointer rounded border px-3 py-1 text-sm"
          style="border-color: var(--color-border)"
          onclick={() => void openTrails()}
        >
          {$t("settings.open_trails")}
        </button>
        <button
          class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
          style="border-color: var(--color-border)"
          disabled={refetching}
          onclick={redownload}
        >
          {refetching ? $t("firstrun.downloading") : $t("settings.redownload")}
        </button>
      </div>
      {#if dataAgeDays !== null && dataAgeDays >= 30}
        <p class="mt-2 text-xs" style="color: #ffd591">
          {$t("settings.data_age", { n: dataAgeDays })}
        </p>
      {/if}
      <div class="mt-3 text-xs leading-relaxed" style="color: var(--color-muted)">
        <div class="mb-1 font-semibold">{$t("credits.title")}</div>
        {$t("credits.body")}
      </div>
    </section>
    </div>

    <div class="setgroup">
      <p class="eyebrow">{$t("settings.group_advanced")}</p>

    <!-- Supporter license (v1.31) -->
    <SupporterCard />

    <!-- In-app auto-update -->
    <UpdateCard
      autoCheck={settings.updates?.auto_check ?? true}
      onautocheck={(v) => void patch({ updates: { auto_check: v } })}
    />

    <!-- First-run wizard -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("settings.setup_title")}
      </h2>
      <button
        class="cursor-pointer rounded border px-3 py-1 text-sm"
        style="border-color: var(--color-border)"
        onclick={() => void patch({ onboarding_done: false })}
      >
        {$t("settings.setup_rerun")}
      </button>
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("settings.setup_hint")}
      </p>
    </section>

    <!-- Usage data & feedback -->
    <section>
      <h2 class="mb-2 font-semibold" style="color: var(--color-accent)">
        {$t("telemetry.title")}
      </h2>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.telemetry?.enabled ?? true}
          onchange={(e) => void patch({ telemetry: { enabled: e.currentTarget.checked } })}
        />
        {$t("telemetry.enabled")}
      </label>
      <p class="mt-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("telemetry.hint")}
      </p>

      <h3 class="mt-4 mb-2 text-sm font-semibold">{$t("feedback.title")}</h3>
      <div class="mb-2 flex gap-1">
        {#each FEEDBACK_CATEGORIES as cat (cat)}
          <button
            class="cursor-pointer rounded border px-2 py-1 text-xs"
            style={feedbackCategory === cat
              ? "background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); font-weight: 600"
              : "border-color: var(--color-border)"}
            onclick={() => (feedbackCategory = cat)}
          >
            {$t(`feedback.cat_${cat}` as never)}
          </button>
        {/each}
      </div>
      <textarea
        class="w-full rounded border p-2 text-sm"
        style="border-color: var(--color-border); background: transparent"
        rows="4"
        maxlength="2000"
        placeholder={$t("feedback.body")}
        bind:value={feedbackBody}
      ></textarea>
      <input
        class="mt-2 w-full rounded border p-2 text-sm"
        style="border-color: var(--color-border); background: transparent"
        maxlength="200"
        placeholder={$t("feedback.contact")}
        bind:value={feedbackContact}
      />
      <div class="mt-2 flex items-center gap-3">
        <button
          class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
          style="border-color: var(--color-border)"
          disabled={feedbackState === "sending" || !feedbackBody.trim()}
          onclick={() => void sendFeedback()}
        >
          {feedbackState === "sending" ? $t("feedback.sending") : $t("feedback.send")}
        </button>
        {#if feedbackState === "sent"}
          <span class="text-xs" style="color: var(--color-muted)">{$t("feedback.sent")}</span>
        {:else if feedbackState === "failed"}
          <span class="text-xs" style="color: #ff8a80">{$t("feedback.failed")}</span>
        {/if}
      </div>
    </section>
    </div>
  </div>
{/if}

<style>
  .setgroup {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink-mute);
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--color-border);
  }
</style>
