<script lang="ts">
  // A7 — the second-monitor companion dashboard. A thin composition layer:
  //   • the SAME <FullMap> the main window / big map use (left)
  //   • a compact dino card, team roster and Prime-quest list (right)
  // all fed by the existing events (dino://update, team://status,
  // settings://changed). No new backend, nothing reads the game.
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import {
    getSettings,
    islepilotState,
    listenerBag,
    onDinoUpdate,
    onSettingsChanged,
    onTeamStatus,
    patchSettings,
    teamStatus,
    type DinoPlayer,
    type DinoStatBar,
    type TeamStatus,
  } from "$lib/api";
  import { locale, t, type Locale } from "$lib/i18n";
  import StatBar from "$lib/ui/StatBar.svelte";
  import Pill from "$lib/ui/Pill.svelte";
  import NutritionTriangle from "$lib/ui/NutritionTriangle.svelte";
  import FullMap from "../main/fullmap/FullMap.svelte";

  let player = $state<DinoPlayer | null>(null);
  let team = $state<TeamStatus | null>(null);
  let updatedMs = $state<number | null>(null);
  // The window is built hidden at startup and this webview keeps running; only
  // un-park the (expensive) <FullMap> once the window is actually on screen.
  // Rust flips this via companion://vis on every show/hide.
  let shown = $state(false);

  // <FullMap> bakes every layer's px + colour at build time — a basemap or
  // colour-profile switch needs a full remount, same {#key} the main window
  // and the big map use.
  let basemap = $state("vulnona");
  let colorProfile = $state("default");
  // Compact = drop the map column, sidebar only (tiny secondary screen).
  let compact = $state(false);

  const quests = $derived(player?.primeQuests ?? []);
  const questsDone = $derived(quests.filter((q) => q.completed).length);
  const roster = $derived(team?.roster ?? []);

  const vitals = $derived(
    player
      ? ([
          ["dino.health", player.health],
          ["dino.hunger", player.hunger],
          ["dino.thirst", player.thirst],
          ...(player.stamina ? ([["dino.stamina", player.stamina]] as const) : []),
        ] as const)
      : [],
  );

  function applySettings(s: Record<string, unknown>) {
    locale.set((s.language as Locale) ?? "vi");
    document.documentElement.dataset.skin = (s.skin as string) ?? "obsidian";
    colorProfile = (s.color_profile as string) ?? "default";
    document.documentElement.dataset.colorProfile = colorProfile;
    basemap = ((s.map as { basemap?: string } | undefined)?.basemap as string) ?? "vulnona";
    compact = Boolean((s.companion as { compact?: boolean } | undefined)?.compact);
  }

  function toggleCompact() {
    void patchSettings({ companion: { compact: !compact } });
  }

  function timeStr(ms: number): string {
    return new Date(ms).toLocaleTimeString($locale === "vi" ? "vi-VN" : $locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function close() {
    void getCurrentWindow().hide();
  }

  onMount(() => {
    const bag = listenerBag();
    void getSettings().then(applySettings);
    void bag.add(onSettingsChanged(applySettings));

    // Fill straight away from the last poll, then follow live.
    void islepilotState().then((st) => {
      if (st.lastUpdate?.player) player = st.lastUpdate.player;
      if (st.lastUpdate?.fetchedAtMs) updatedMs = st.lastUpdate.fetchedAtMs;
    });
    void bag.add(
      onDinoUpdate((u) => {
        if (u.player) player = u.player;
        updatedMs = u.fetchedAtMs;
      }),
    );
    void teamStatus().then((s) => (team = s));
    void bag.add(onTeamStatus((s) => (team = s)));

    void bag.add(
      listen<boolean>("companion://vis", (e) => {
        shown = e.payload;
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

<div class="cp">
  <header>
    <span class="dot" aria-hidden="true"></span>
    <span class="ttl">{$t("companion.title")}</span>
    <span class="hint">{$t("companion.hint")}</span>
    {#if updatedMs}
      <span class="upd">{$t("dino.updated", { time: timeStr(updatedMs) })}</span>
    {/if}
    <button
      class="x"
      class:on={compact}
      onclick={toggleCompact}
      title={$t(compact ? "companion.show_map" : "companion.hide_map")}
      aria-pressed={compact}
    >
      {compact ? "⊞" : "⊟"}
    </button>
    <button class="x" onclick={close} title={$t("btn.close")} aria-label={$t("btn.close")}>✕</button>
  </header>

  <div class="body" class:compact>
    <div class="map">
      {#key `${basemap}:${colorProfile}`}
        <FullMap visible={shown && !compact} />
      {/key}
    </div>

    <aside class="side">
      <!-- Dino stats -->
      <section class="card">
        {#if player}
          <div class="nameline">
            <span class="dname">{player.dinoName ?? "?"}</span>
            {#if player.female !== null && player.female !== undefined}
              <span class="sex">{player.female ? "♀" : "♂"}</span>
            {/if}
            {#if player.online !== null}
              <Pill tone={player.online ? "live" : "danger"} mono={false}>
                {player.online ? $t("dino.online") : $t("dino.offline")}
              </Pill>
            {/if}
            {#if player.primeEligible}
              <Pill tone="live" mono={false}>{$t("dino.prime")} ✦</Pill>
            {/if}
          </div>
          {#if player.server}
            <div class="subline">{$t("dino.server_playing")}: <b>{player.server}</b></div>
          {/if}

          <div class="vitals">
            <StatBar
              label={$t("dino.growth")}
              value={player.growthPct}
              max={100}
              tone="accent"
              text={player.growth ?? "—"}
            />
            {#each vitals as [labelKey, bar] (labelKey)}
              <StatBar
                label={$t(labelKey as never)}
                value={(bar as DinoStatBar | null)?.current ?? null}
                max={(bar as DinoStatBar | null)?.max ?? null}
                text={(bar as DinoStatBar | null)?.raw ?? "—"}
              />
            {/each}
          </div>

          {#if player.nutrition}
            <div class="nutri">
              <div class="ntitle">{$t("dino.nutrition")}</div>
              <NutritionTriangle
                carb={player.nutrition.carb}
                protein={player.nutrition.protein}
                lipid={player.nutrition.lipid}
              />
            </div>
          {/if}
        {:else}
          <p class="empty">{$t("dino.no_data")}</p>
        {/if}
      </section>

      <!-- Team roster -->
      <section class="card">
        <div class="chead">
          <span class="ctitle">{$t("team.title")}</span>
          {#if roster.length}
            <span class="ccount">{$t("team.members", { n: roster.length })}</span>
          {/if}
        </div>
        {#if roster.length}
          <ul class="roster">
            {#each roster as m, mi (mi)}
              <li class:off={!m.online}>
                <span class="rname">
                  {m.name}{#if m.isSelf}<span class="self"> · {$t("team.you")}</span>{/if}
                </span>
                {#if m.species}<span class="rspec">{m.species}</span>{/if}
                {#if !m.online}
                  <span class="rhp muted">{$t("team.offline")}</span>
                {:else if m.hp !== null}
                  <span
                    class="rhp"
                    style="color: {m.hp > 50
                      ? 'var(--sem-ok)'
                      : m.hp > 25
                        ? 'var(--sem-warn)'
                        : 'var(--sem-danger)'}"
                  >
                    {Math.round(m.hp)}%
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">{$t("companion.no_team")}</p>
        {/if}
      </section>

      <!-- Prime quests -->
      <section class="card">
        <div class="chead">
          <span class="ctitle">{$t("quest.section")}</span>
          {#if quests.length}
            <span class="ccount">{questsDone}/{quests.length}</span>
          {/if}
        </div>
        {#if quests.length}
          <div class="ptrack">
            <span class="pfill" style="width: {(questsDone / quests.length) * 100}%"></span>
          </div>
          <ul class="quests">
            {#each quests as q, qi (qi)}
              <li class:done={q.completed}>
                <span class="mark">{q.completed ? "✓" : "○"}</span>
                <span title={$locale === "vi" && q.textVi ? q.text : undefined}>
                  {$locale === "vi" ? (q.textVi ?? q.text) : q.text}
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">{$t("companion.no_quests")}</p>
        {/if}
      </section>
    </aside>
  </div>
</div>

<style>
  .cp {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    color: var(--ink);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.45rem 0.9rem;
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
    font-size: 0.95rem;
  }
  .hint {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.03em;
    color: var(--ink-mute);
  }
  .upd {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--ink-mute);
  }
  .x {
    cursor: pointer;
    border: 1px solid var(--color-border);
    background: none;
    color: var(--ink-mid);
    border-radius: var(--radius-sm, 6px);
    width: 26px;
    height: 24px;
    font-size: 0.8rem;
    line-height: 1;
    padding: 0;
  }
  header .x:first-of-type {
    margin-left: auto;
  }
  .upd + .x {
    margin-left: 0;
  }
  .x:hover {
    color: var(--ink);
    border-color: var(--amber);
  }
  .x.on {
    color: var(--color-bg);
    background: var(--amber);
    border-color: var(--amber);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr minmax(300px, 340px);
  }
  /* Compact: no map, sidebar fills the window (kept comfortably narrow). */
  .body.compact {
    grid-template-columns: minmax(0, 460px);
    justify-content: center;
  }
  .body.compact .map {
    display: none;
  }
  .map {
    position: relative;
    min-width: 0;
    min-height: 0;
    border-right: 1px solid var(--color-border);
  }
  .side {
    overflow-y: auto;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    background: var(--color-bg);
  }
  @media (max-width: 820px) {
    .body {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1.4fr) minmax(0, 1fr);
    }
    .map {
      border-right: none;
      border-bottom: 1px solid var(--color-border);
    }
  }

  .card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-panel);
    padding: 0.7rem 0.8rem;
  }
  .nameline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .dname {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.05rem;
  }
  .sex {
    color: var(--ink-mid);
    font-size: 0.95rem;
  }
  .subline {
    margin-top: 0.2rem;
    font-size: 0.75rem;
    color: var(--ink-mute);
  }
  .vitals {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.42rem;
  }
  .nutri {
    margin-top: 0.75rem;
  }
  .ntitle,
  .ctitle {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }
  .chead {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  .ccount {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--amber);
  }
  .empty {
    font-size: 0.8rem;
    color: var(--ink-mute);
    margin: 0.2rem 0;
  }

  .roster {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .roster li {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: 0.82rem;
  }
  .roster li.off {
    opacity: 0.5;
  }
  .rname {
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .self {
    color: var(--ink-mute);
  }
  .rspec {
    color: var(--ink-mute);
    font-size: 0.72rem;
  }
  .rhp {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  .rhp.muted {
    color: var(--ink-mute);
  }

  .ptrack {
    height: 4px;
    border-radius: 2px;
    background: var(--panel-2, rgba(255, 255, 255, 0.08));
    overflow: hidden;
    margin-bottom: 0.5rem;
  }
  .pfill {
    display: block;
    height: 100%;
    background: var(--amber);
  }
  .quests {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
  }
  .quests li {
    display: flex;
    gap: 0.45rem;
    font-size: 0.82rem;
    color: var(--ink-mid);
  }
  .quests li .mark {
    color: var(--ink-mute);
  }
  .quests li.done {
    color: var(--ink-mute);
  }
  .quests li.done .mark {
    color: var(--sem-ok);
  }
  .quests li.done span:last-child {
    text-decoration: line-through;
  }
</style>
