<script lang="ts">
  // "Your dino" tab: IslePilot login + live stats + Prime progress.
  //
  // Two auth modes: TOKEN (primary — one Steam login against islepilot.eu,
  // works on every IslePilot server) and LEGACY (fallback — per-server URL +
  // cookie, the original flow, collapsed under <details>).
  import { onMount } from "svelte";
  import {
    alertsTest,
    getSettings,
    islepilotApply,
    islepilotCancelLogin,
    islepilotLogin,
    islepilotLogout,
    islepilotSetCookie,
    islepilotSetToken,
    islepilotState,
    islepilotTokenLogin,
    listenerBag,
    onDinoAuthExpired,
    onDinoLoginFailed,
    onDinoLoginOk,
    onDinoUpdate,
    onTeamStatus,
    patchSettings,
    teamCreate,
    teamJoin,
    teamLeave,
    teamStatus,
    type DinoStatBar,
    type DinoUpdate,
    type Settings,
    type TeamStatus,
  } from "$lib/api";
  import { locale, t, tNow } from "$lib/i18n";
  import { ask } from "@tauri-apps/plugin-dialog";
  import StatBar from "$lib/ui/StatBar.svelte";
  import Pill from "$lib/ui/Pill.svelte";
  import Toggle from "$lib/ui/Toggle.svelte";
  import Slider from "$lib/ui/Slider.svelte";
  import NutritionTriangle from "$lib/ui/NutritionTriangle.svelte";
  import NutritionAdvice from "./NutritionAdvice.svelte";
  import StatsHistory from "./StatsHistory.svelte";


  let settings = $state<Settings | null>(null);
  let loggedIn = $state(false);
  let authMode = $state<"token" | "legacy">("legacy");
  // Login setup is bulky; once signed in it collapses so the stats are
  // visible without scrolling. The gear button reopens it.
  let serverOpen = $state(true);
  let update = $state<DinoUpdate | null>(null);
  let loginBusy = $state(false);
  let loginError = $state(false);
  let authExpired = $state(false);
  let domainInput = $state("");
  let cookieInput = $state("");
  let cookieBusy = $state(false);
  let cookieError = $state(false);
  let tokenInput = $state("");
  let tokenBusy = $state(false);
  let tokenError = $state(false);

  // G6 team relay.
  let team = $state<TeamStatus>({
    active: false,
    connected: false,
    code: "",
    name: "",
    members: 0,
    error: null,
    roster: [],
  });
  let teamName = $state("");
  let teamCode = $state("");
  let teamError = $state("");

  // P7: manual hard-swap countdown (30 min after hitting adult in The Isle).
  let hardSwapEnd = $state<number | null>(null);
  let nowMs = $state(Date.now());
  const hardSwapLeft = $derived(hardSwapEnd ? Math.max(0, hardSwapEnd - nowMs) : 0);
  $effect(() => {
    if (!hardSwapEnd) return;
    const t = setInterval(() => {
      nowMs = Date.now();
      if (hardSwapEnd && nowMs >= hardSwapEnd) {
        // keep showing 00:00 for a bit, then clear
        setTimeout(() => (hardSwapEnd = null), 5000);
      }
    }, 1000);
    return () => clearInterval(t);
  });
  const fmtMMSS = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  async function doTeam(kind: "create" | "join") {
    teamError = "";
    try {
      team =
        kind === "create"
          ? await teamCreate(teamName.trim())
          : await teamJoin(teamCode.trim(), teamName.trim());
    } catch (e) {
      teamError = String(e);
    }
  }

  async function refreshState() {
    const st = await islepilotState();
    loggedIn = st.loggedIn;
    authMode = st.authMode;
    update = st.lastUpdate ?? update;
  }

  onMount(() => {
    const bag = listenerBag();
    (async () => {
      settings = await getSettings();
      domainInput = settings.islepilot.domain;
      const st = await islepilotState();
      loggedIn = st.loggedIn;
      authMode = st.authMode;
      serverOpen = !st.loggedIn;
      update = st.lastUpdate;
      await bag.add(
        onDinoUpdate((u) => {
          update = u;
          authExpired = false;
        }),
      );
      await bag.add(
        onDinoLoginOk(async () => {
          loginBusy = false;
          loginError = false;
          authExpired = false;
          serverOpen = false;
          settings = await getSettings();
          await refreshState();
        }),
      );
      await bag.add(
        onDinoLoginFailed(() => {
          loginBusy = false;
          loginError = true;
        }),
      );
      await bag.add(
        onDinoAuthExpired(() => {
          authExpired = true;
          serverOpen = true; // re-login lives in the collapsed section
        }),
      );
      team = await teamStatus();
      await bag.add(onTeamStatus((s) => (team = s)));
    })();
    return () => bag.dispose();
  });

  async function patch(p: object, reapply = false) {
    settings = await patchSettings(p);
    if (reapply) await islepilotApply();
  }

  // Party view is intrusive on servers with third-party-tool rules: gate the
  // first enable behind an explicit acknowledgement.
  async function toggleParty(want: boolean) {
    if (want) {
      const ok = await ask(tNow("party.rules_ack"), {
        title: tNow("dino.show_party"),
        kind: "warning",
      });
      // Cancelled: the Toggle is controlled by settings, so doing nothing
      // leaves the switch where it was.
      if (!ok) return;
    }
    await patch({ islepilot: { show_party: want } }, true);
  }

  async function tokenLogin() {
    loginBusy = true;
    loginError = false;
    try {
      await islepilotTokenLogin();
    } catch {
      loginBusy = false;
      loginError = true;
    }
  }

  async function saveToken() {
    tokenBusy = true;
    tokenError = false;
    try {
      await islepilotSetToken(tokenInput);
      tokenInput = "";
    } catch {
      tokenError = true;
    } finally {
      tokenBusy = false;
    }
  }

  async function login() {
    loginBusy = true;
    loginError = false;
    try {
      await islepilotLogin(domainInput.trim());
    } catch {
      loginBusy = false;
      loginError = true;
    }
  }

  async function logout() {
    await islepilotLogout();
    loggedIn = false;
    serverOpen = true;
    update = null;
    settings = await getSettings();
  }

  async function cancelLogin() {
    await islepilotCancelLogin();
    loginBusy = false;
  }

  async function saveCookie() {
    cookieBusy = true;
    cookieError = false;
    try {
      await islepilotSetCookie(domainInput.trim(), cookieInput);
      cookieInput = "";
    } catch {
      cookieError = true;
    } finally {
      cookieBusy = false;
    }
  }

  const timeStr = (ms: number) =>
    new Date(ms).toLocaleTimeString($locale === "vi" ? "vi-VN" : "en-US");

  const player = $derived(update?.player ?? null);
  /** Server live-map capability: true / false / null while unknown. */
  const liveMap = $derived(update?.liveMapAvailable ?? null);
  const nutrition = $derived(player?.nutrition ?? null);
</script>

{#if settings}
  <div class="mx-auto max-w-2xl space-y-5 p-6">
    <section>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold" style="color: var(--color-accent)">
          {$t("dino.title")}
        </h2>
        <button
          class="cursor-pointer rounded border px-2 py-1 text-xs"
          style={serverOpen
            ? "border-color: var(--color-accent); color: var(--color-accent)"
            : "border-color: var(--color-border); color: var(--color-muted)"}
          onclick={() => (serverOpen = !serverOpen)}
        >
          ⚙ {$t("dino.server_settings")}
        </button>
      </div>
      {#if serverOpen}
        <p class="mt-1 text-sm" style="color: var(--color-muted)">{$t("dino.explain")}</p>
        <p class="mt-2 text-xs" style="color: #ffd591">{$t("dino.rules_note")}</p>
      {/if}
    </section>

    <!-- Login (collapsed once signed in) -->
    {#if serverOpen}
    <section
      class="rounded border p-3"
      style="border-color: var(--color-border); background: var(--color-panel)"
    >
      <!-- Primary: token mode — one Steam login for every server -->
      <div class="mb-1 text-sm font-semibold" style="color: var(--color-accent)">
        {$t("dino.token_login")}
      </div>
      <p class="mb-2 text-xs leading-relaxed" style="color: var(--color-muted)">
        {$t("dino.token_login_hint")}
      </p>
      {#if authExpired}
        <p class="mb-2 text-sm" style="color: #ff8a80">{$t("dino.auth_expired")}</p>
      {/if}
      {#if loginError}
        <p class="mb-2 text-sm" style="color: #ff8a80">{$t("dino.login_failed")}</p>
      {/if}
      <div class="flex items-center gap-3">
        {#if loggedIn && authMode === "token" && !authExpired}
          <span class="text-sm" style="color: #72d653">✓ {$t("dino.logged_in")}</span>
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm"
            style="border-color: var(--color-border)"
            onclick={() => void logout()}
          >
            {$t("dino.logout")}
          </button>
        {:else}
          <button
            class="cursor-pointer rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
            style="background: var(--color-accent); color: var(--color-bg)"
            disabled={loginBusy}
            onclick={() => void tokenLogin()}
          >
            {$t("dino.login")}
          </button>
          {#if loginBusy}
            <span class="text-sm" style="color: var(--color-muted)">
              {$t("dino.login_wait")}
            </span>
            <button
              class="cursor-pointer rounded border px-2 py-0.5 text-xs"
              style="border-color: var(--color-border)"
              onclick={() => void cancelLogin()}
            >
              {$t("dino.cancel_login")}
            </button>
          {/if}
        {/if}
      </div>

      <!-- Manual token paste (escape hatch) -->
      <details class="mt-3">
        <summary class="cursor-pointer text-xs" style="color: var(--color-muted)">
          {$t("dino.token_paste")}
        </summary>
        <p class="mb-2 mt-1 text-xs leading-relaxed" style="color: var(--color-muted)">
          {$t("dino.token_paste_hint")}
        </p>
        <textarea
          class="mb-2 w-full rounded border px-2 py-1 font-mono text-xs"
          style="border-color: var(--color-border); background: var(--color-bg); color: var(--color-text)"
          rows="2"
          placeholder="theisle-overlay://?sid=…&token=…"
          bind:value={tokenInput}
        ></textarea>
        {#if tokenError}
          <p class="mb-2 text-xs" style="color: #ff8a80">{$t("dino.token_bad")}</p>
        {/if}
        <button
          class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
          style="border-color: var(--color-border)"
          disabled={tokenBusy || !tokenInput.trim()}
          onclick={() => void saveToken()}
        >
          {tokenBusy ? $t("dino.token_checking") : $t("dino.token_save")}
        </button>
      </details>

      <!-- Legacy fallback: per-server URL + cookie -->
      <details class="mt-3 border-t pt-3" style="border-color: var(--color-border)">
        <summary class="cursor-pointer text-xs font-semibold" style="color: var(--color-muted)">
          {$t("dino.legacy_section")}
        </summary>
        <p class="mb-2 mt-1 text-xs" style="color: var(--color-muted)">
          {$t("dino.legacy_hint")}
        </p>
        <div class="mb-1 text-sm font-semibold">{$t("dino.server")}</div>
        <p class="mb-2 text-xs" style="color: var(--color-muted)">
          {$t("dino.supported_servers")}
        </p>
        <input
          class="mb-3 w-full rounded border px-2 py-1 font-mono text-sm"
          style="border-color: var(--color-border); background: var(--color-bg); color: var(--color-text)"
          bind:value={domainInput}
          placeholder="https://…islepilot.eu"
        />
        <div class="flex items-center gap-3">
          {#if loggedIn && authMode === "legacy" && domainInput === settings.islepilot.domain && !authExpired}
            <span class="text-sm" style="color: #72d653">✓ {$t("dino.logged_in")}</span>
            <button
              class="cursor-pointer rounded border px-3 py-1 text-sm"
              style="border-color: var(--color-border)"
              onclick={() => void logout()}
            >
              {$t("dino.logout")}
            </button>
          {:else}
            <button
              class="cursor-pointer rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
              style="background: var(--color-accent); color: var(--color-bg)"
              disabled={loginBusy || !domainInput.startsWith("https://")}
              onclick={() => void login()}
            >
              {$t("dino.login")}
            </button>
            {#if loginBusy}
              <span class="text-sm" style="color: var(--color-muted)">
                {$t("dino.login_wait")}
              </span>
              <button
                class="cursor-pointer rounded border px-2 py-0.5 text-xs"
                style="border-color: var(--color-border)"
                onclick={() => void cancelLogin()}
              >
                {$t("dino.cancel_login")}
              </button>
            {/if}
          {/if}
        </div>

        <!-- Cookie paste: the reliable legacy path -->
        <div class="mt-3 border-t pt-3" style="border-color: var(--color-border)">
          <div class="text-sm font-semibold" style="color: var(--color-accent)">
            {$t("dino.manual_cookie")}
          </div>
          <p class="mb-2 mt-1 text-xs leading-relaxed" style="color: var(--color-muted)">
            {$t("dino.manual_cookie_hint")}
          </p>
          <textarea
            class="mb-2 w-full rounded border px-2 py-1 font-mono text-xs"
            style="border-color: var(--color-border); background: var(--color-bg); color: var(--color-text)"
            rows="3"
            placeholder="islepilot_player=eyJhbGciOi…  (hoặc chỉ dán phần Value)"
            bind:value={cookieInput}
          ></textarea>
          {#if cookieError}
            <p class="mb-2 text-xs" style="color: #ff8a80">{$t("dino.manual_cookie_bad")}</p>
          {/if}
          <button
            class="cursor-pointer rounded border px-3 py-1 text-sm disabled:opacity-50"
            style="border-color: var(--color-border)"
            disabled={cookieBusy || !cookieInput.trim() || !domainInput.startsWith("https://")}
            onclick={() => void saveCookie()}
          >
            {cookieBusy ? $t("dino.manual_cookie_checking") : $t("dino.manual_cookie_save")}
          </button>
        </div>
      </details>
    </section>
    {/if}

    <!-- Options -->
    <section
      class="space-y-2 rounded border p-3"
      style="border-color: var(--color-border); background: var(--color-panel)"
    >
      <Toggle
        label={$t("dino.enabled")}
        checked={settings.islepilot.enabled}
        onchange={(v) => void patch({ islepilot: { enabled: v } }, true)}
      />
      <Toggle
        label={$t("dino.overlay_panel")}
        checked={settings.islepilot.show_overlay_panel}
        onchange={(v) => void patch({ islepilot: { show_overlay_panel: v } })}
      />
      <Toggle
        label={$t("dino.quests_panel")}
        checked={settings.islepilot.show_quests_panel}
        onchange={(v) => void patch({ islepilot: { show_quests_panel: v } })}
      />
      <Toggle
        label={$t("dino.history_track")}
        checked={settings.islepilot.history_enabled}
        onchange={(v) => void patch({ islepilot: { history_enabled: v } })}
      />
      <Toggle
        label={$t("dino.death_marker")}
        hint={$t("dino.death_marker_hint")}
        checked={settings.islepilot.death_marker ?? true}
        onchange={(v) => void patch({ islepilot: { death_marker: v } })}
      />
      <!-- Live-map position: driven by the server's capability. No live map
           -> forced off and not clickable; live map -> on by default, and a
           manual flip marks map_pref_user_set so auto-on never overrides. -->
      <Toggle
        label={$t("dino.use_map_position")}
        checked={settings.islepilot.use_map_position}
        disabled={liveMap === false}
        onchange={(v) =>
          void patch(
            { islepilot: { use_map_position: v, map_pref_user_set: true } },
            true,
          )}
      />
      {#if settings.islepilot.enabled && loggedIn}
        {#if liveMap === true}
          <p class="pl-6 text-xs" style="color: #72d653">✓ {$t("dino.live_map_yes")}</p>
        {:else if liveMap === false}
          <p class="pl-6 text-xs" style="color: var(--color-muted)">
            ✗ {$t("dino.map_disabled")}
          </p>
        {:else}
          <p class="pl-6 text-xs" style="color: var(--color-muted)">
            {$t("dino.live_map_checking")}
          </p>
        {/if}
      {/if}
      <Toggle
        label={$t("dino.show_party")}
        checked={settings.islepilot.show_party}
        onchange={(v) => void toggleParty(v)}
      />
      {#if settings.islepilot.show_party && !team.active}
        <p class="pl-6 text-xs" style="color: {liveMap === false ? '#ffb4a1' : '#72d653'}">
          {#if liveMap === true}
            ✓ {$t("dino.party_via_livemap")}
          {:else if liveMap === false}
            {$t("dino.party_needs_relay")}
          {:else}
            {$t("dino.live_map_checking")}
          {/if}
        </p>
      {/if}
      <Slider
        label={$t("dino.interval")}
        min={5}
        max={60}
        step={5}
        value={settings.islepilot.poll_interval_s}
        format={(v) => `${v}s`}
        oninput={(v) => void patch({ islepilot: { poll_interval_s: v } }, true)}
      />
      {#if settings.islepilot.auth_mode === "token"}
        <Toggle
          label={$t("dino.realtime")}
          hint={$t("dino.realtime_hint")}
          checked={settings.islepilot.realtime ?? true}
          onchange={(v) => void patch({ islepilot: { realtime: v } }, true)}
        />
      {/if}
    </section>

    <!-- Alerts -->
    <section
      class="space-y-2 rounded border p-3"
      style="border-color: var(--color-border); background: var(--color-panel)"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold" style="color: var(--color-accent)">
          {$t("alert.section")}
        </h3>
        <button
          class="cursor-pointer rounded border px-2 py-0.5 text-xs"
          style="border-color: var(--color-border); color: var(--color-muted)"
          onclick={() => void alertsTest()}
        >
          {$t("alert.test")}
        </button>
      </div>
      <p class="text-xs" style="color: var(--color-muted)">{$t("alert.hint")}</p>
      <Toggle
        label={$t("alert.enabled")}
        checked={settings.islepilot.alerts.enabled}
        onchange={(v) => void patch({ islepilot: { alerts: { enabled: v } } })}
      />
      {#if settings.islepilot.alerts.enabled}
        <div class="space-y-2 pl-6">
          {#each [["alert.thirst_label", "thirst_pct"], ["alert.hunger_label", "hunger_pct"], ["alert.hp_label", "hp_pct"]] as [labelKey, key] (key)}
            <label class="flex items-center gap-2 text-sm">
              <span class="w-36" style="color: var(--color-muted)">{$t(labelKey as never)}</span>
              <input
                type="number"
                class="w-16 rounded border px-2 py-0.5 text-sm"
                style="border-color: var(--color-border); background: var(--color-bg); color: var(--color-text)"
                min="0"
                max="100"
                value={settings.islepilot.alerts[key as "thirst_pct" | "hunger_pct" | "hp_pct"]}
                onchange={(e) =>
                  void patch({
                    islepilot: {
                      alerts: {
                        [key]: Math.max(
                          0,
                          Math.min(100, Number(e.currentTarget.value) || 0),
                        ),
                      },
                    },
                  })}
              />
              <span class="text-xs" style="color: var(--color-muted)">
                {$t("alert.threshold_off")}
              </span>
            </label>
          {/each}
          <Toggle
            label={$t("alert.prime_ready")}
            checked={settings.islepilot.alerts.prime_ready}
            onchange={(v) => void patch({ islepilot: { alerts: { prime_ready: v } } })}
          />
          <Toggle
            label={$t("alert.growth_milestones")}
            checked={settings.islepilot.alerts.growth_milestones}
            onchange={(v) =>
              void patch({ islepilot: { alerts: { growth_milestones: v } } })}
          />
        </div>
      {/if}
    </section>

    <!-- Profile card -->
    <section class="profile">
      {#if player}
        <header class="phead">
          <div class="avatar" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="currentColor">
              <g transform="translate(20 21) scale(1.5)">
                <ellipse cx="0" cy="-1" rx="4" ry="10.5" />
                <ellipse cx="-9" cy="4" rx="3.3" ry="8.5" transform="rotate(-22)" />
                <ellipse cx="9" cy="4" rx="3.3" ry="8.5" transform="rotate(22)" />
                <ellipse cx="0" cy="11.5" rx="4.6" ry="4" />
              </g>
            </svg>
          </div>
          <div class="pmeta">
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
            <div class="subline">
              {#if player.server}
                <span>{$t("dino.server_playing")}: <b>{player.server}</b></span>
              {/if}
              {#if update}
                <span>{$t("dino.updated", { time: timeStr(update.fetchedAtMs) })}</span>
              {/if}
            </div>
          </div>
        </header>

        <div class="pgrid">
          <div class="vitals">
            <StatBar
              label={$t("dino.growth")}
              value={player.growthPct}
              max={100}
              tone="accent"
              text={player.growth ?? "—"}
            />
            {#each [["dino.health", player.health], ["dino.hunger", player.hunger], ["dino.thirst", player.thirst], ...(player.stamina ? [["dino.stamina", player.stamina]] : [])] as [labelKey, bar] (labelKey)}
              <StatBar
                label={$t(labelKey as never)}
                value={(bar as DinoStatBar | null)?.current ?? null}
                max={(bar as DinoStatBar | null)?.max ?? null}
                text={(bar as DinoStatBar | null)?.raw ?? "—"}
              />
            {/each}
          </div>

          {#if nutrition}
            <div class="nutri">
              <div class="ntitle">{$t("dino.nutrition")}</div>
              <NutritionTriangle
                carb={nutrition.carb}
                protein={nutrition.protein}
                lipid={nutrition.lipid}
              />
              <NutritionAdvice
                carb={nutrition.carb}
                protein={nutrition.protein}
                lipid={nutrition.lipid}
                name={player.dinoName}
              />
            </div>
          {/if}
        </div>

        <!-- Prime progress -->
        {#if player.primeQuests.length > 0}
          {@const primeDone = player.primeQuests.filter((q) => q.completed).length}
          <div class="prime">
            <div class="prime-head">
              <span class="prime-label">{$t("dino.prime")}</span>
              <span class="prime-count">{primeDone}/{player.primeQuests.length}</span>
            </div>
            <div class="prime-track">
              <span
                class="prime-fill"
                style="width: {(primeDone / player.primeQuests.length) * 100}%"
              ></span>
            </div>
            <ul>
              <!-- Key by index: Prime quest text is NOT unique (the game can
                   hand out two objectives with identical text), and a keyed
                   dup throws each_key_duplicate. The list is replaced whole
                   each poll and rendered in order, so index is stable. -->
              {#each player.primeQuests as quest, qi (qi)}
                <li class:done={quest.completed}>
                  <span class="mark">{quest.completed ? "✓" : "○"}</span>
                  <!-- Vietnamese when available; the English original stays a
                       hover away so in-game terms remain checkable. -->
                  <span title={$locale === "vi" && quest.textVi ? quest.text : undefined}>
                    {$locale === "vi" ? (quest.textVi ?? quest.text) : quest.text}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if update?.layoutChanged}
          <p class="mt-3 text-xs" style="color: #ffd591">{$t("dino.layout_changed")}</p>
        {/if}
      {:else if update?.error}
        <p class="text-sm" style="color: #ff8a80">
          {$t("dino.fetch_error")} <span class="font-mono text-xs">{update.error}</span>
        </p>
      {:else}
        <p class="text-sm" style="color: var(--color-muted)">{$t("dino.no_data")}</p>
      {/if}
    </section>

    {#if loggedIn && settings.islepilot.enabled && settings.islepilot.history_enabled}
      <StatsHistory />
    {/if}

    <!-- P7: hard-swap countdown -->
    <div class="rounded-lg border p-3 text-sm" style="border-color: var(--color-border)">
      <div class="flex flex-wrap items-center gap-3">
        <span>{$t("dino.hardswap_timer")}</span>
        {#if hardSwapEnd}
          <span
            class="font-mono text-lg"
            style="color: {hardSwapLeft > 0 ? 'var(--color-accent)' : '#72d653'}"
          >
            {fmtMMSS(hardSwapLeft)}
          </span>
          <button
            class="cursor-pointer rounded border px-2 py-0.5 text-xs"
            style="border-color: var(--color-border)"
            onclick={() => (hardSwapEnd = null)}
          >
            {$t("btn.cancel")}
          </button>
        {:else}
          <button
            class="cursor-pointer rounded px-2 py-1 text-xs font-medium"
            style="background: var(--color-accent); color: var(--color-bg)"
            onclick={() => (hardSwapEnd = Date.now() + 30 * 60 * 1000)}
          >
            {$t("dino.hardswap_start")}
          </button>
        {/if}
      </div>
    </div>

    <!-- G6: ad-hoc team via a hosted relay. Deliberately simple — name +
         two buttons, like IsleLiveMap. Works on every server. The relay URL
         has a baked-in default; only power users touch it. -->
    <section class="rounded-lg border p-4" style="border-color: var(--color-border)">
      <h2 class="mb-1 text-lg font-semibold" style="color: var(--color-accent)">
        {$t("team.title")}
      </h2>
      <p class="mb-3 text-xs" style="color: var(--color-muted)">{$t("team.intro")}</p>

      {#if team.active}
        <div class="space-y-2 text-sm">
          <div>
            {$t("team.code")}:
            <button
              class="cursor-pointer font-mono text-xl tracking-[0.3em]"
              style="color: var(--color-accent)"
              title={$t("team.copy_code")}
              onclick={() => navigator.clipboard?.writeText(team.code)}
            >
              {team.code}
            </button>
          </div>
          <div style="color: var(--color-muted)">
            {team.connected ? "🟢 " + $t("team.connected") : "🟡 " + $t("team.connecting")} ·
            {$t("team.members", { n: String(team.members) })}
            {#if team.error}· <span style="color: #ffb4a1">{team.error}</span>{/if}
          </div>

          {#if team.roster.length > 0}
            <ul class="mt-1 space-y-1.5">
              <!-- Index-keyed: two teammates can pick the same display name. -->
              {#each team.roster as m, mi (mi)}
                <li class="text-xs" style="opacity: {m.online ? 1 : 0.45}">
                  <div class="flex items-center justify-between">
                    <span style="color: var(--color-text)">
                      {m.name}{#if m.isSelf}<span style="color: var(--color-muted)"> ({$t("team.you")})</span>{/if}
                    </span>
                    <span style="color: var(--color-muted)">
                      {m.species ?? ""}{#if !m.online} · {$t("team.offline")}{/if}
                    </span>
                  </div>
                  {#if m.hp != null || m.hunger != null || m.thirst != null}
                    <div class="mt-0.5 flex gap-1">
                      {#each [["HP", m.hp, "#72d653"], ["🍖", m.hunger, "#e8a33d"], ["💧", m.thirst, "#4aa8d8"]] as [lbl, val, col] (lbl)}
                        <div class="flex flex-1 items-center gap-1">
                          <span style="color: var(--color-muted)">{lbl}</span>
                          <div class="h-1.5 flex-1 overflow-hidden rounded" style="background: rgba(255,255,255,.12)">
                            {#if val != null}
                              <div class="h-full" style="width: {Math.max(0, Math.min(100, val as number))}%; background: {col}"></div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}

          <button
            class="cursor-pointer rounded border px-3 py-1 text-xs"
            style="border-color: var(--color-border)"
            onclick={() => void teamLeave()}
          >
            {$t("team.leave")}
          </button>
        </div>
      {:else}
        <div class="space-y-2">
          <input
            type="text"
            class="w-full rounded border bg-transparent px-2 py-1.5 text-sm"
            style="border-color: var(--color-border)"
            placeholder={$t("team.name_ph")}
            bind:value={teamName}
          />
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="cursor-pointer rounded px-3 py-1.5 text-sm font-medium"
              style="background: var(--color-accent); color: var(--color-bg)"
              onclick={() => void doTeam("create")}
            >
              {$t("team.create")}
            </button>
            <span class="text-xs" style="color: var(--color-muted)">{$t("team.or")}</span>
            <input
              type="text"
              class="w-24 rounded border bg-transparent px-2 py-1.5 text-center text-sm uppercase tracking-[0.2em]"
              style="border-color: var(--color-border)"
              placeholder={$t("team.code_ph")}
              maxlength="6"
              bind:value={teamCode}
            />
            <button
              class="cursor-pointer rounded border px-3 py-1.5 text-sm"
              style="border-color: var(--color-border)"
              onclick={() => void doTeam("join")}
            >
              {$t("team.join")}
            </button>
          </div>
          {#if teamError}
            <p class="text-xs" style="color: #ffb4a1">{teamError}</p>
          {/if}
        </div>
      {/if}

      <details class="mt-3">
        <summary class="cursor-pointer text-xs" style="color: var(--color-muted)">
          {$t("team.advanced")}
        </summary>
        <label class="mt-2 block text-xs" style="color: var(--color-muted)">
          {$t("team.relay_base")}
          <input
            type="text"
            class="mt-1 w-full rounded border bg-transparent px-2 py-1 text-xs"
            style="border-color: var(--color-border)"
            placeholder={$t("team.relay_default_ph")}
            value={settings.team?.relay_base ?? ""}
            onchange={(e) =>
              void patch({ team: { relay_base: e.currentTarget.value.trim() } })}
          />
        </label>
      </details>
    </section>

  </div>
{/if}

<style>
  .profile {
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--amber);
    border-radius: var(--radius-lg);
    background: var(--color-panel);
    padding: 1rem 1.1rem 1.1rem;
  }
  .phead {
    display: flex;
    gap: 0.85rem;
    align-items: center;
    padding-bottom: 0.85rem;
    border-bottom: 1px solid var(--color-border);
  }
  .avatar {
    flex: none;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--amber) 12%, transparent);
    color: var(--amber);
  }
  .avatar svg {
    width: 34px;
    height: 34px;
  }
  .pmeta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .nameline {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .dname {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.25rem;
    line-height: 1.05;
    color: var(--ink);
  }
  .sex {
    font-family: var(--font-mono);
    color: var(--ink-mute);
    font-size: 0.95rem;
  }
  .subline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 1rem;
    font-size: 0.78rem;
    color: var(--ink-mute);
  }
  .subline b {
    color: var(--ink-mid);
    font-weight: 500;
  }
  .pgrid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem 1.4rem;
    margin-top: 0.9rem;
  }
  @media (min-width: 40rem) {
    .pgrid {
      grid-template-columns: 1fr minmax(9rem, 13rem);
      align-items: start;
    }
  }
  .vitals {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .nutri {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .ntitle {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
    text-align: center;
  }

  .prime {
    margin-top: 1rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--color-border);
  }
  .prime-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: var(--font-mono);
  }
  .prime-label {
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-mute);
  }
  .prime-count {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--amber);
    font-variant-numeric: tabular-nums;
  }
  .prime-track {
    height: 3px;
    margin: 0.35rem 0 0.7rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--ink) 10%, transparent);
    overflow: hidden;
  }
  .prime-fill {
    display: block;
    height: 100%;
    background: var(--amber);
    transition: width var(--dur-panel) var(--ease-out);
  }
  .prime ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
  }
  .prime li {
    display: flex;
    gap: 0.55rem;
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--ink-mid);
  }
  .prime li .mark {
    flex: none;
    color: var(--ink-mute);
    font-variant-numeric: tabular-nums;
  }
  .prime li.done,
  .prime li.done .mark {
    color: var(--sem-ok);
  }
  @media (prefers-reduced-motion: reduce) {
    .prime-fill {
      transition: none;
    }
  }
</style>

