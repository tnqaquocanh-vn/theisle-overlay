<script lang="ts">
  // Skin editor — recolour a dino's 10 skin channels with a live 3D preview.
  // Reuses the compositing pipeline already ported for the Garage
  // (dino3d/skin.ts + DinoViewer3D). Fully local: presets live in
  // settings.skin_presets, share codes go through the clipboard. Nothing is
  // sent to IslePilot and nothing touches the game.
  import { onMount } from "svelte";
  import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
  import {
    getSettings,
    islepilotSkin,
    islepilotSkinPreset,
    islepilotState,
    listenerBag,
    onDinoSkin,
    onSettingsChanged,
    patchSettings,
    sendLiveSkin,
    type ServerSkinPreset,
    type SkinPreset,
  } from "$lib/api";
  import { t } from "$lib/i18n";
  import { isSupporter } from "$lib/license.svelte";
  import {
    DINO_MODELS,
    DEFAULT_PALETTE,
    hasModel,
    type DinoPalette,
  } from "$lib/dino3d/registry";

  // Free tier keeps a handful of local presets; supporters are uncapped.
  const FREE_PRESET_CAP = 3;
  import DinoViewer3D from "$lib/dino3d/DinoViewer3D.svelte";

  const SPECIES = Object.keys(DINO_MODELS).sort();
  const patternCountOf = (sp: string) =>
    Object.keys(DINO_MODELS[sp]?.patterns ?? { 1: 1 }).filter((k) => /^\d+$/.test(k)).length || 1;
  // Order + labels match the official overlay's channel list.
  const CHANNELS: { key: keyof DinoPalette; label: string }[] = [
    { key: "body", label: "skin.ch_body" },
    { key: "flank", label: "skin.ch_flank" },
    { key: "underbelly", label: "skin.ch_underbelly" },
    { key: "markings", label: "skin.ch_markings" },
    { key: "display", label: "skin.ch_display" },
    { key: "detail", label: "skin.ch_detail" },
    { key: "eyes", label: "skin.ch_eyes" },
    { key: "teeth", label: "skin.ch_teeth" },
    { key: "mouth", label: "skin.ch_mouth" },
    { key: "claws", label: "skin.ch_claws" },
  ];
  const ORDER = CHANNELS.map((c) => c.key);
  const DRAFT_KEY = "tio.skinEditor.draft";
  const CODE_PREFIX = "tio-skin:1";

  // Our palette key → the game/server config name (from the official overlay).
  const CFG: Record<keyof DinoPalette, string> = {
    body: "skin_body",
    flank: "skin_flank",
    underbelly: "skin_underbelly",
    markings: "skin_markings",
    display: "skin_maledisplay",
    detail: "skin_detail1",
    eyes: "skin_eyes",
    teeth: "skin_teeth",
    mouth: "skin_mouth",
    claws: "skin_claws",
  };
  const hexToRgb01 = (hex: string): [number, number, number] => {
    const n = parseInt(hex.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const rgb01ToHex = (r: number, g: number, b: number): string => {
    const c = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v * 255)))
        .toString(16)
        .padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
  };
  /** 10 hex channels → `{skin_body_r: 0.4, …}` RGB floats (black-guarded). */
  function paletteToState(pal: DinoPalette): Record<string, number> {
    const out: Record<string, number> = {};
    for (const k of ORDER) {
      let [r, g, b] = hexToRgb01(pal[k]);
      if (r === 0 && g === 0 && b === 0) b = 1 / 255;
      out[`${CFG[k]}_r`] = r;
      out[`${CFG[k]}_g`] = g;
      out[`${CFG[k]}_b`] = b;
    }
    return out;
  }
  /** `{skin_body_r: 0.4, …}` → the channels we can read, as hex. */
  function stateToPalette(state: Record<string, number>): Partial<DinoPalette> {
    const out: Partial<DinoPalette> = {};
    for (const k of ORDER) {
      const r = state[`${CFG[k]}_r`];
      if (typeof r !== "number") continue;
      out[k] = rgb01ToHex(r, state[`${CFG[k]}_g`] ?? 0, state[`${CFG[k]}_b`] ?? 0);
    }
    return out;
  }

  let species = $state(SPECIES[0] ?? "Tenontosaurus");
  let palette = $state<DinoPalette>({ ...DEFAULT_PALETTE });
  // Carried in the game skin code (`<Species><P><V><T><rgba×5>`): Pattern
  // (1-8), Pattern Variation, Theme. Editable Pattern; V/T are round-tripped.
  let patternIdx = $state(1);
  let variationIdx = $state(0);
  let themeIdx = $state(0);
  const patternCount = $derived(patternCountOf(species));
  // The game code's 5 colours, in its order.
  const GAME_ORDER: (keyof DinoPalette)[] = [
    "underbelly",
    "body",
    "flank",
    "markings",
    "display",
  ];
  // The viewer only follows this — a ~200 ms debounce keeps a colour drag
  // from re-compositing the 2K skin texture on every frame.
  let livePalette = $state<DinoPalette>({ ...DEFAULT_PALETTE });
  let presets = $state<SkinPreset[]>([]);
  let presetName = $state("");
  let toast = $state<string | null>(null);
  let hexBad = $state<Record<string, boolean>>({});
  let rolling = $state(false);

  // Level B — IslePilot "apply live on your dino" (opt-in, token mode only).
  let loggedIn = $state(false);
  let liveApply = $state(false);
  let serverPresets = $state<ServerSkinPreset[]>([]);
  let lastSentAt = 0;

  const normHex = (v: string): string | null => {
    const s = v.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    // Pure black breaks the compositing reference-match — nudge like the app.
    return s.toLowerCase() === "000000" ? "#000001" : "#" + s.toLowerCase();
  };

  let debounce: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const snap = { ...palette };
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      livePalette = snap;
      if (liveApply && loggedIn) {
        lastSentAt = Date.now();
        void sendLiveSkin(paletteToState(snap));
      }
    }, 180);
  });
  $effect(() => () => clearTimeout(debounce));

  // Persist the working draft (species + palette + pattern) as a convenience.
  $effect(() => {
    const snap = JSON.stringify({ species, palette, patternIdx, variationIdx, themeIdx });
    try {
      localStorage.setItem(DRAFT_KEY, snap);
    } catch {
      /* private mode / blocked — the editor still works */
    }
  });

  function flashToast(msg: string) {
    toast = msg;
    setTimeout(() => (toast === msg ? (toast = null) : null), 1600);
  }

  function setChannel(key: keyof DinoPalette, hex: string) {
    const n = normHex(hex);
    if (!n) {
      hexBad = { ...hexBad, [key]: true };
      return;
    }
    hexBad = { ...hexBad, [key]: false };
    palette = { ...palette, [key]: n };
  }

  function randomize() {
    rolling = true;
    const next = { ...palette };
    for (const k of ORDER) {
      next[k] = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
    }
    palette = next;
    hexBad = {};
    setTimeout(() => (rolling = false), 420);
  }

  function reset() {
    palette = { ...DEFAULT_PALETTE };
    hexBad = {};
  }

  /** App-to-app code: `tio-skin:1|<species>|<hex×10>`. */
  function encodeApp(): string {
    return `${CODE_PREFIX}|${species}|${ORDER.map((k) => palette[k].replace("#", "")).join(",")}`;
  }

  /** The Isle Evrima's own skin string: `<Species><P><V><T>` then five
   *  `RRGGBBAA` colours (alpha FF) in [underbelly, body, flank, markings,
   *  display] order — pastes straight into the in-game "Import". */
  function encodeGame(): string {
    const nib = (n: number) => Math.max(0, Math.min(15, Math.round(n))).toString(16).toUpperCase();
    const rgba = (hex: string) => hex.replace("#", "").toUpperCase() + "FF";
    return (
      species + nib(patternIdx) + nib(variationIdx) + nib(themeIdx) + GAME_ORDER.map((k) => rgba(palette[k])).join("")
    );
  }

  function decodeGame(raw: string): boolean {
    const s = raw.trim();
    const sp =
      SPECIES.filter((x) => s.startsWith(x)).sort((a, b) => b.length - a.length)[0] ??
      SPECIES.find((x) => s.toLowerCase().startsWith(x.toLowerCase()));
    if (!sp) return false;
    const rest = s.slice(sp.length);
    // 3 header nibbles + 5 × RRGGBBAA
    if (!/^[0-9a-fA-F]{43}$/.test(rest)) return false;
    const next = { ...palette };
    GAME_ORDER.forEach((k, i) => {
      const c6 = rest.slice(3 + i * 8, 3 + i * 8 + 6).toLowerCase();
      next[k] = c6 === "000000" ? "#000001" : `#${c6}`;
    });
    patternIdx = parseInt(rest[0], 16) || 1;
    variationIdx = parseInt(rest[1], 16);
    themeIdx = parseInt(rest[2], 16);
    if (hasModel(sp)) species = sp;
    palette = next;
    hexBad = {};
    return true;
  }

  async function writeClip(text: string): Promise<boolean> {
    try {
      await writeText(text);
      return true;
    } catch {
      try {
        await navigator.clipboard?.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
  }

  async function copyGame() {
    const code = encodeGame();
    flashToast((await writeClip(code)) ? $t("skin.copied_game") : code);
  }
  async function copyApp() {
    const code = encodeApp();
    flashToast((await writeClip(code)) ? $t("skin.copied_app") : code);
  }

  async function pasteCode() {
    let text = "";
    try {
      text = await readText();
    } catch {
      try {
        text = (await navigator.clipboard?.readText()) ?? "";
      } catch {
        /* fall through to the error toast */
      }
    }
    text = text.trim();

    // App format.
    const m = text.match(/^tio-skin:1\|([^|]+)\|(.+)$/);
    if (m) {
      const parts = m[2].split(",");
      if (parts.length === ORDER.length) {
        const next = { ...DEFAULT_PALETTE };
        let ok = true;
        ORDER.forEach((k, i) => {
          const n = normHex(parts[i]);
          if (n) next[k] = n;
          else ok = false;
        });
        if (ok) {
          if (hasModel(m[1])) species = m[1];
          palette = next;
          hexBad = {};
          return;
        }
      }
      flashToast($t("skin.paste_bad"));
      return;
    }

    // Game format.
    if (decodeGame(text)) return;
    flashToast($t("skin.paste_bad"));
  }

  const presetCapped = $derived(!isSupporter() && presets.length >= FREE_PRESET_CAP);

  function savePreset() {
    if (presetCapped) {
      flashToast($t("skin.preset_cap", { n: FREE_PRESET_CAP }));
      return;
    }
    const name = presetName.trim() || $t("skin.title");
    const id = "sk_" + Math.random().toString(36).slice(2, 10);
    const now = new Date().toISOString();
    const next: SkinPreset = { id, name, species, palette: { ...palette }, created: now };
    void patchSettings({ skin_presets: [...presets, next] });
    presetName = "";
  }

  function applyPreset(p: SkinPreset) {
    if (hasModel(p.species)) species = p.species;
    palette = { ...DEFAULT_PALETTE, ...p.palette };
    hexBad = {};
  }

  function deletePreset(id: string) {
    void patchSettings({ skin_presets: presets.filter((p) => p.id !== id) });
  }

  async function refreshServerPresets() {
    try {
      const res = await islepilotSkin();
      serverPresets = Array.isArray(res.presets) ? res.presets : [];
    } catch {
      serverPresets = [];
    }
  }

  async function saveCloudPreset() {
    const name = presetName.trim() || $t("skin.title");
    try {
      const res = await islepilotSkinPreset({ action: "save", name, palette: { ...palette } });
      if (res.error) flashToast($t("skin.cloud_err", { err: res.error }));
      else {
        flashToast($t("skin.cloud_saved"));
        presetName = "";
        await refreshServerPresets();
      }
    } catch (e) {
      flashToast($t("skin.cloud_err", { err: String(e) }));
    }
  }

  async function deleteServerPreset(id: string) {
    try {
      await islepilotSkinPreset({ action: "delete", id });
    } catch {
      /* ignore — refresh below reconciles */
    }
    await refreshServerPresets();
  }

  function applyServerPreset(p: ServerSkinPreset) {
    palette = { ...palette, ...stateToPalette(p.state) };
    hexBad = {};
  }

  onMount(() => {
    const bag = listenerBag();
    void getSettings().then((s) => {
      presets = Array.isArray(s.skin_presets) ? (s.skin_presets as SkinPreset[]) : [];
    });
    void bag.add(
      onSettingsChanged((s) => {
        presets = Array.isArray(s.skin_presets) ? (s.skin_presets as SkinPreset[]) : [];
      }),
    );

    // Level B: only when signed in to IslePilot in token mode.
    void islepilotState().then((st) => {
      loggedIn = st.loggedIn && st.authMode === "token";
      if (loggedIn) void refreshServerPresets();
    });
    void bag.add(
      onDinoSkin((skin) => {
        // Ignore the echo of our own change.
        if (Date.now() - lastSentAt < 1500) return;
        const patch = stateToPalette(skin);
        if (Object.keys(patch).length) {
          palette = { ...palette, ...patch };
          hexBad = {};
        }
      }),
    );

    // Seed from a saved draft, else from the species the player is on.
    let seeded = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as {
          species?: string;
          palette?: Partial<DinoPalette>;
          patternIdx?: number;
          variationIdx?: number;
          themeIdx?: number;
        };
        if (d.species && hasModel(d.species)) species = d.species;
        if (d.palette) palette = { ...DEFAULT_PALETTE, ...d.palette };
        if (typeof d.patternIdx === "number") patternIdx = d.patternIdx;
        if (typeof d.variationIdx === "number") variationIdx = d.variationIdx;
        if (typeof d.themeIdx === "number") themeIdx = d.themeIdx;
        livePalette = { ...palette };
        seeded = true;
      }
    } catch {
      /* ignore */
    }
    if (!seeded) {
      void islepilotState().then((st) => {
        const sp = st.lastUpdate?.player?.dinoName;
        if (sp && hasModel(sp)) species = sp;
      });
    }
    return () => bag.dispose();
  });
</script>

<div class="wrap">
  <header class="head">
    <h1>{$t("skin.title")}</h1>
    <p>{$t("skin.subtitle")}</p>
  </header>

  <div class="grid">
    <!-- Preview -->
    <section class="preview">
      <label class="species">
        <span>{$t("skin.species")}</span>
        <select bind:value={species}>
          {#each SPECIES as sp (sp)}
            <option value={sp}>{sp}</option>
          {/each}
        </select>
      </label>

      {#key species}
        <div class="stage">
          <DinoViewer3D {species} palette={livePalette} pattern={patternIdx} height={340} />
        </div>
      {/key}
      {#if !hasModel(species)}
        <p class="nomodel">{$t("skin.no_model")}</p>
      {:else if patternIdx > patternCount}
        <p class="nomodel">{$t("skin.pattern_nopreview", { n: patternCount })}</p>
      {/if}

      <label class="species pat">
        <span>{$t("skin.pattern")}</span>
        <select bind:value={patternIdx}>
          {#each [1, 2, 3, 4, 5, 6, 7, 8] as n (n)}
            <option value={n}>{n}</option>
          {/each}
        </select>
      </label>

      <div class="actions">
        <button class="btn primary" class:rolling onclick={randomize}>🎲 {$t("skin.randomize")}</button>
        <button class="btn" onclick={reset}>↺ {$t("skin.reset")}</button>
      </div>
      <div class="actions">
        <button class="btn" onclick={() => void copyGame()}>⧉ {$t("skin.copy_game")}</button>
        <button class="btn" onclick={() => void copyApp()}>⧉ {$t("skin.copy_app")}</button>
        <button class="btn" onclick={() => void pasteCode()}>⇤ {$t("skin.paste")}</button>
      </div>

      {#if loggedIn}
        <label class="live">
          <input type="checkbox" bind:checked={liveApply} />
          <span>☁ {$t("skin.live_apply")}</span>
        </label>
        <p class="livehint">{$t("skin.live_hint")}</p>
      {/if}
    </section>

    <!-- Channels -->
    <section class="channels">
      <p class="eyebrow">{$t("skin.channels")}</p>
      <ul>
        {#each CHANNELS as ch (ch.key)}
          <li class:rolling>
            <span class="sw" style="background: {palette[ch.key]}"></span>
            <span class="lbl">{$t(ch.label as never)}</span>
            <input
              class="pick"
              type="color"
              value={palette[ch.key]}
              oninput={(e) => setChannel(ch.key, e.currentTarget.value)}
              aria-label={$t(ch.label as never)}
            />
            <input
              class="hex"
              class:bad={hexBad[ch.key]}
              value={palette[ch.key].replace("#", "")}
              spellcheck="false"
              maxlength="7"
              onchange={(e) => setChannel(ch.key, e.currentTarget.value)}
              aria-label="{$t(ch.label as never)} hex"
            />
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <!-- Presets -->
  <section class="presets">
    <div class="prow">
      <p class="eyebrow">{$t("skin.your_skins")}</p>
      <input
        class="pname"
        placeholder={$t("skin.preset_name")}
        bind:value={presetName}
        onkeydown={(e) => e.key === "Enter" && savePreset()}
      />
      <button class="btn" onclick={savePreset} disabled={presetCapped}>{$t("skin.save")}</button>
      {#if loggedIn}
        <button class="btn" onclick={() => void saveCloudPreset()}>☁ {$t("skin.save_cloud")}</button>
      {/if}
    </div>
    {#if presetCapped}
      <p class="empty">★ {$t("skin.preset_cap_hint", { n: FREE_PRESET_CAP })}</p>
    {/if}
    {#if presets.length > 0}
      <div class="chips">
        {#each presets as p (p.id)}
          <div class="chip">
            <button class="apply" onclick={() => applyPreset(p)}>
              <span class="sw" style="background: {p.palette.body ?? '#888'}"></span>
              <span class="nm">{p.name}</span>
              <span class="sp">{p.species}</span>
            </button>
            <button class="del" title={$t("skin.delete")} aria-label={$t("skin.delete")} onclick={() => deletePreset(p.id)}>×</button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">{$t("skin.no_presets")}</p>
    {/if}

    {#if loggedIn && serverPresets.length > 0}
      <p class="eyebrow" style="margin-top: 1rem">☁ {$t("skin.cloud_presets")}</p>
      <div class="chips">
        {#each serverPresets as p (p.id)}
          <div class="chip">
            <button class="apply" onclick={() => applyServerPreset(p)}>
              <span
                class="sw"
                style="background: {rgb01ToHex(
                  p.state.skin_body_r ?? 0.5,
                  p.state.skin_body_g ?? 0.5,
                  p.state.skin_body_b ?? 0.5,
                )}"
              ></span>
              <span class="nm">{p.name}</span>
            </button>
            <button
              class="del"
              title={$t("skin.delete")}
              aria-label={$t("skin.delete")}
              onclick={() => void deleteServerPreset(p.id)}>×</button
            >
          </div>
        {/each}
      </div>
    {/if}
  </section>

  {#if toast}
    <div class="toast">{toast}</div>
  {/if}
</div>

<style>
  .wrap {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.4rem 1.6rem 3rem;
  }
  .head h1 {
    font-family: var(--font-display, "Fraunces", serif);
    font-weight: 600;
    font-size: 1.5rem;
    margin: 0;
    color: var(--color-text);
  }
  .head p {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--color-muted);
    max-width: 42rem;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
    gap: 1.4rem;
    margin-top: 1.4rem;
  }
  @media (max-width: 780px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .species {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--color-muted);
    margin-bottom: 0.7rem;
  }
  .species select {
    flex: 1;
    background: var(--color-panel);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.35rem 0.5rem;
    font-size: 0.85rem;
  }
  .species.pat {
    margin: 0.6rem 0 0;
  }
  .species.pat select {
    flex: 0 0 5rem;
  }
  .stage {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .nomodel {
    margin: 0.5rem 0 0;
    font-size: 0.78rem;
    color: var(--color-muted);
  }
  .live {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.9rem;
    font-size: 0.85rem;
    color: var(--color-text);
    cursor: pointer;
  }
  .livehint {
    margin: 0.25rem 0 0;
    font-size: 0.76rem;
    color: var(--color-muted);
    max-width: 34rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.9rem;
  }
  .btn {
    cursor: pointer;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    border-radius: 7px;
    padding: 0.4rem 0.7rem;
    font-size: 0.82rem;
    line-height: 1;
  }
  .btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .btn:disabled:hover {
    border-color: var(--color-border);
    color: var(--color-text);
  }
  .btn.primary {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .btn.rolling {
    animation: nudge 0.42s ease;
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }

  .eyebrow {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-muted);
    margin: 0 0 0.6rem;
  }
  .channels ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .channels li {
    display: grid;
    grid-template-columns: 22px 1fr 30px 74px;
    align-items: center;
    gap: 0.55rem;
  }
  .channels li.rolling .sw {
    transition: background 0.28s ease;
  }
  .sw {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  .lbl {
    font-size: 0.85rem;
    color: var(--color-text);
  }
  .pick {
    width: 30px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 5px;
    background: none;
    cursor: pointer;
  }
  .hex {
    width: 74px;
    background: var(--color-panel);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 5px;
    padding: 0.25rem 0.4rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.78rem;
    text-transform: lowercase;
  }
  .hex.bad {
    border-color: #d9604a;
    color: #d9604a;
  }

  .presets {
    margin-top: 1.6rem;
    border-top: 1px solid var(--color-border);
    padding-top: 1.1rem;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .prow .eyebrow {
    margin: 0;
  }
  .pname {
    flex: 1;
    min-width: 140px;
    background: var(--color-panel);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 0.35rem 0.55rem;
    font-size: 0.82rem;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
    background: var(--color-panel);
  }
  .chip .apply {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    background: none;
    border: none;
    color: var(--color-text);
    padding: 0.28rem 0.5rem 0.28rem 0.4rem;
    font-size: 0.8rem;
  }
  .chip .apply:hover {
    color: var(--color-accent);
  }
  .chip .apply .sw {
    width: 16px;
    height: 16px;
  }
  .chip .sp {
    color: var(--color-muted);
    font-size: 0.72rem;
  }
  .chip .del {
    cursor: pointer;
    border: none;
    border-left: 1px solid var(--color-border);
    background: none;
    color: var(--color-muted);
    padding: 0 0.5rem;
    font-size: 0.9rem;
  }
  .chip .del:hover {
    color: #d9604a;
  }
  .empty {
    margin: 0.7rem 0 0;
    font-size: 0.82rem;
    color: var(--color-muted);
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 20px;
    transform: translateX(-50%);
    z-index: 50;
    background: var(--color-panel);
    border: 1px solid var(--color-accent);
    color: var(--color-text);
    border-radius: 8px;
    padding: 0.45rem 0.9rem;
    font-size: 0.82rem;
    max-width: 90vw;
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    .btn.rolling,
    .channels li.rolling .sw {
      animation: none;
      transition: none;
    }
  }
</style>
