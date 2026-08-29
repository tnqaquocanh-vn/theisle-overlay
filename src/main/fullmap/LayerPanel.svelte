<script lang="ts">
  // Right-side panel: layer toggles (persisted), position status, and the
  // waypoint list with rename/delete — the CRUD UI the old app never had.
  import type {
    MeasureResult,
    NearestWaypoint,
    NearestZone,
    PositionUpdate,
    QuestTargetOut,
    Route,
    TrailFile,
    Waypoint,
    WaypointPx,
  } from "$lib/api";
  import { compassLabel, formatDistance, locale, t } from "$lib/i18n";
  import { LAYER_ORDER } from "$lib/theme";

  let {
    available,
    layers,
    zoneLabels,
    position,
    nearest,
    waypoints,
    places,
    islepilotNote = null,
    showCursorCoords,
    rulerActive,
    rulerInfo,
    pastTrails,
    shownPast,
    replayName,
    questList,
    pinnedQuest,
    pinnedZone,
    hiddenGroups,
    lc,
    ontoggle,
    ontogglezonelabels,
    onrename,
    ondelete,
    onfocus,
    oncleartrail,
    onsetcolor,
    onsetgroup,
    ontogglegroup,
    onexport,
    onimport,
    onlocate,
    onsearchcoords,
    ontoggleruler,
    onclearruler,
    ontogglecursorcoords,
    ontogglepast,
    onreplay,
    onpinquest,
    onunpinquest,
    showExplored,
    ontoggleexplored,
    onresetexplored,
    routeMode,
    routeInfo,
    routes,
    loadedRouteId,
    ontoggleroute,
    onclearroute,
    onsaveroute,
    onloadroute,
    ondeleteroute,
    teamActive = false,
    onshare,
  }: {
    available: string[];
    layers: Record<string, boolean>;
    zoneLabels: boolean;
    position: PositionUpdate | null;
    nearest: NearestWaypoint | null;
    waypoints: WaypointPx[];
    places: { label: string; px: number; py: number; kind: string }[];
    /** Why IslePilot server POIs are unavailable (already localized). */
    islepilotNote?: string | null;
    showCursorCoords: boolean;
    rulerActive: boolean;
    rulerInfo: MeasureResult | null;
    pastTrails: TrailFile[];
    shownPast: string[];
    /** Name of the session currently loaded in the replay scrubber, if any. */
    replayName: string | null;
    questList: QuestTargetOut[];
    pinnedQuest: number | null;
    pinnedZone: NearestZone | null;
    hiddenGroups: string[];
    /** Layer palette for the active colour profile. */
    lc: Record<string, string>;
    ontoggle: (key: string, visible: boolean) => void;
    ontogglezonelabels: (visible: boolean) => void;
    onrename: (id: string, name: string) => void;
    ondelete: (wp: Waypoint) => void;
    onfocus: (wp: Waypoint) => void;
    oncleartrail: () => void;
    onsetcolor: (wp: Waypoint, color: string | null) => void;
    onsetgroup: (id: string, group: string | null) => void;
    ontogglegroup: (name: string) => void;
    onexport: () => void;
    onimport: () => void;
    onlocate: (px: number, py: number) => void;
    onsearchcoords: (text: string) => Promise<boolean>;
    ontoggleruler: () => void;
    onclearruler: () => void;
    ontogglecursorcoords: (v: boolean) => void;
    ontogglepast: (name: string) => void;
    /** Load a past session into the replay scrubber. */
    onreplay: (name: string) => void;
    onpinquest: (index: number) => void;
    onunpinquest: () => void;
    showExplored: boolean;
    ontoggleexplored: (v: boolean) => void;
    onresetexplored: () => void;
    routeMode: boolean;
    routeInfo: MeasureResult | null;
    routes: Route[];
    loadedRouteId: string | null;
    ontoggleroute: () => void;
    onclearroute: () => void;
    onsaveroute: () => void;
    onloadroute: (rt: Route) => void;
    ondeleteroute: (id: string) => void;
    /** In a G6 team — show the "share waypoint" button. */
    teamActive?: boolean;
    onshare?: (wp: Waypoint) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let editingName = $state("");

  // --- waypoint groups (F6) ---------------------------------------------
  let groupingId = $state<string | null>(null);
  let groupingName = $state("");
  const groups = $derived(
    [...new Set(waypoints.map((w) => w.group).filter((g): g is string => !!g))].sort(),
  );

  function startGroupEdit(wp: WaypointPx) {
    groupingId = wp.id;
    groupingName = wp.group ?? "";
    editingId = null;
  }
  function commitGroup() {
    if (groupingId) onsetgroup(groupingId, groupingName.trim() || null);
    groupingId = null;
  }

  // --- search ---------------------------------------------------------------
  let query = $state("");
  let coordsFailed = $state(false);

  const looksLikeCoords = (q: string) => /\d[\d.,\s−-]*\d/.test(q);

  const results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [
      ...waypoints.map((w) => ({ label: w.name, px: w.px, py: w.py, kind: "wp" })),
      ...places,
    ]
      .filter((p) => p.label.toLowerCase().includes(q))
      .slice(0, 6);
  });

  function pickResult(r: { px: number; py: number }) {
    onlocate(r.px, r.py);
    query = "";
    coordsFailed = false;
  }

  async function tryCoords() {
    coordsFailed = !(await onsearchcoords(query));
    if (!coordsFailed) query = "";
  }

  function onSearchKey(e: KeyboardEvent) {
    coordsFailed = false;
    if (e.key === "Escape") {
      query = "";
      return;
    }
    if (e.key !== "Enter") return;
    if (results.length > 0) pickResult(results[0]);
    else if (looksLikeCoords(query)) void tryCoords();
  }

  const kindColor = (kind: string) =>
    kind === "wp" ? "#4fc3f7" : (lc[kind] ?? "#e8a33d");

  // --- waypoint colours ------------------------------------------------------
  const WP_PALETTE = ["#4fc3f7", "#ef5350", "#ffa726", "#ffee58", "#66bb6a", "#ab47bc", "#eceff1"];

  function cycleColor(wp: WaypointPx) {
    const i = WP_PALETTE.indexOf(wp.color ?? WP_PALETTE[0]);
    onsetcolor(wp, WP_PALETTE[(i + 1) % WP_PALETTE.length]);
  }

  const layerKey = (key: string) => `layer.${key}` as Parameters<typeof $t>[0];

  function startRename(wp: Waypoint) {
    editingId = wp.id;
    editingName = wp.name;
  }

  function commitRename() {
    if (editingId && editingName.trim()) onrename(editingId, editingName.trim());
    editingId = null;
  }

  const fmt = (n: number) =>
    Math.round(n).toLocaleString($locale === "vi" ? "vi-VN" : "en-US");

  // --- collapsible layer list ------------------------------------------------
  // The layer list is the tallest block of the panel; folding it keeps the
  // trail/position/waypoint info below in view. Remembered across sessions
  // (pure UI convenience — localStorage, not the settings file).
  const OPEN_KEY = "layerpanel.layers_open";
  let layersOpen = $state(
    (() => {
      try {
        return localStorage.getItem(OPEN_KEY) !== "false";
      } catch {
        return true;
      }
    })(),
  );
  function toggleLayers() {
    layersOpen = !layersOpen;
    try {
      localStorage.setItem(OPEN_KEY, String(layersOpen));
    } catch {
      // Storage unavailable: the toggle still works for this session.
    }
  }
</script>

<aside
  class="flex w-56 shrink-0 flex-col gap-3 overflow-y-auto p-3"
  style="background: var(--color-panel); border-left: 1px solid var(--color-border)"
>
  <section>
    <input
      class="w-full rounded border px-2 py-1 text-sm"
      style="border-color: var(--color-border); background: var(--color-bg); color: var(--color-text)"
      placeholder={$t("search.placeholder")}
      bind:value={query}
      onkeydown={onSearchKey}
    />
    {#if query.trim()}
      <ul class="mt-1 space-y-0.5">
        {#each results as r (r.kind + r.label)}
          <li>
            <button
              class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:underline"
              onclick={() => pickResult(r)}
            >
              <span
                class="inline-block size-2 shrink-0 rounded-full"
                style="background: {kindColor(r.kind)}"
              ></span>
              <span class="truncate">{r.label}</span>
            </button>
          </li>
        {/each}
        {#if looksLikeCoords(query)}
          <li>
            <button
              class="w-full cursor-pointer rounded px-1.5 py-1 text-left text-sm hover:underline"
              style="color: var(--color-accent)"
              onclick={() => void tryCoords()}
            >
              → {$t("search.goto_coords")}
            </button>
          </li>
        {/if}
        {#if results.length === 0 && !looksLikeCoords(query)}
          <li class="px-1.5 py-1 text-xs" style="color: var(--color-muted)">
            {$t("search.no_results")}
          </li>
        {/if}
        {#if coordsFailed}
          <li class="px-1.5 py-1 text-xs" style="color: #ff8a80">
            {$t("search.coords_failed")}
          </li>
        {/if}
      </ul>
    {/if}
  </section>

  <section>
    <h2 class="mb-1 text-sm font-semibold" style="color: var(--color-accent)">
      {$t("measure.section")}
    </h2>
    <div class="flex items-center gap-2">
      <button
        class="cursor-pointer rounded border px-2 py-1 text-xs"
        style={rulerActive
          ? "border-color: var(--color-accent); color: var(--color-accent)"
          : "border-color: var(--color-border)"}
        onclick={() => ontoggleruler()}
      >
        📏 {$t("ruler.tool")}
      </button>
      {#if rulerActive && rulerInfo && rulerInfo.pointsCm.length >= 2}
        <button
          class="cursor-pointer text-xs underline"
          style="color: var(--color-muted)"
          onclick={() => onclearruler()}
        >
          {$t("ruler.clear")}
        </button>
      {/if}
    </div>
    {#if rulerActive}
      {#if rulerInfo && rulerInfo.pointsCm.length >= 2}
        <div class="mt-1 font-mono text-sm" style="color: var(--color-text)">
          {formatDistance($locale, rulerInfo.totalM)}
          {#if rulerInfo.compassKey}
            · {compassLabel($locale, rulerInfo.compassKey)}
          {/if}
        </div>
      {:else}
        <p class="mt-1 text-xs" style="color: var(--color-muted)">{$t("ruler.hint")}</p>
      {/if}
    {/if}
    <label class="mt-1 flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        class="size-3.5"
        checked={showCursorCoords}
        onchange={(e) => ontogglecursorcoords(e.currentTarget.checked)}
      />
      {$t("coord.show")}
    </label>

    <!-- Route planner -->
    <div class="mt-2 flex flex-wrap items-center gap-2 border-t pt-2" style="border-color: var(--color-border)">
      <button
        class="cursor-pointer rounded border px-2 py-1 text-xs"
        style={routeMode
          ? "border-color: var(--color-accent); color: var(--color-accent)"
          : "border-color: var(--color-border)"}
        onclick={() => ontoggleroute()}
      >
        🧭 {$t("route.tool")}
      </button>
      {#if routeInfo && routeInfo.pointsCm.length >= 2}
        <span class="font-mono text-xs" style="color: var(--color-text)">
          {$t("route.total", { dist: formatDistance($locale, routeInfo.totalM) })}
        </span>
        {#if loadedRouteId === null}
          <button
            class="cursor-pointer text-xs underline"
            style="color: var(--color-accent)"
            onclick={() => onsaveroute()}
          >
            {$t("route.save")}
          </button>
        {/if}
        <button
          class="cursor-pointer text-xs underline"
          style="color: var(--color-muted)"
          onclick={() => onclearroute()}
        >
          {$t("route.clear")}
        </button>
      {:else if routeMode}
        <span class="text-xs" style="color: var(--color-muted)">{$t("ruler.hint")}</span>
      {/if}
    </div>
    {#if routes.length > 0}
      <div class="mt-1 text-xs" style="color: var(--color-muted)">{$t("route.list")}</div>
      <ul class="space-y-0.5">
        {#each routes as rt (rt.id)}
          <li class="flex items-center gap-1 text-xs">
            <button
              class="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline"
              style={loadedRouteId === rt.id ? "color: var(--color-accent)" : ""}
              onclick={() => onloadroute(rt)}
            >
              {rt.name || "?"} · {rt.points.length}
            </button>
            <button
              class="shrink-0 cursor-pointer px-1 opacity-70 hover:opacity-100"
              title={$t("wp.remove")}
              onclick={() => ondeleteroute(rt.id)}
            >
              ✕
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section>
    <button
      class="mb-1 flex w-full cursor-pointer items-center gap-1 text-sm font-semibold"
      style="color: var(--color-accent)"
      onclick={toggleLayers}
      aria-expanded={layersOpen}
    >
      <svg
        viewBox="0 0 24 24"
        class="h-3.5 w-3.5 shrink-0 transition-transform duration-150"
        style="transform: rotate({layersOpen ? 90 : 0}deg)"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      <span>{$t("layers.title")}</span>
      <span class="ml-auto text-xs font-normal" style="color: var(--color-muted)">
        {layersOpen ? $t("layers.collapse") : $t("layers.expand")}
      </span>
    </button>
    {#if layersOpen}
      {#each LAYER_ORDER as key (key)}
        {#if available.includes(key)}
          <label class="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              class="size-3.5 accent-current"
              style="color: {lc[key]}"
              checked={layers[key] ?? true}
              onchange={(e) => ontoggle(key, e.currentTarget.checked)}
            />
            <span
              class="inline-block size-2.5 rounded-full"
              style="background: {lc[key]}"
            ></span>
            {$t(layerKey(key))}
          </label>
        {/if}
      {/each}
      {#if islepilotNote}
        <p class="py-1 text-xs" style="color: var(--color-muted)">{islepilotNote}</p>
      {/if}
      <label
        class="mt-1 flex cursor-pointer items-center gap-2 border-t pt-1.5 text-sm"
        style="border-color: var(--color-border)"
      >
        <input
          type="checkbox"
          class="size-3.5"
          checked={zoneLabels}
          onchange={(e) => ontogglezonelabels(e.currentTarget.checked)}
        />
        {$t("layers.zone_labels")}
      </label>
      <div class="mt-1 flex items-center gap-2 text-sm">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            class="size-3.5"
            checked={showExplored}
            onchange={(e) => ontoggleexplored(e.currentTarget.checked)}
          />
          {$t("layer.explored")}
        </label>
        {#if showExplored}
          <button
            class="cursor-pointer text-xs underline"
            style="color: var(--color-muted)"
            onclick={() => onresetexplored()}
          >
            {$t("explored.reset")}
          </button>
        {/if}
      </div>
    {/if}
  </section>

  {#if questList.length > 0}
    <section>
      <h2 class="mb-1 text-sm font-semibold" style="color: var(--color-accent)">
        {$t("quest.section")}
        <span class="font-normal" style="color: var(--color-muted)">
          ({questList.filter((q) => q.completed).length}/{questList.length})
        </span>
      </h2>
      <ul class="space-y-0.5">
        {#each questList as q (q.index)}
          {@const text = $locale === "vi" ? (q.textVi ?? q.text) : q.text}
          <li>
            {#if q.target}
              <button
                class="flex w-full cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 text-left text-xs"
                style={pinnedQuest === q.index
                  ? "background: var(--color-bg); color: var(--color-accent)"
                  : ""}
                title={$locale === "vi" && q.textVi ? q.text : undefined}
                onclick={() => onpinquest(q.index)}
              >
                <span style="color: {q.completed ? '#72d653' : 'var(--color-muted)'}">
                  {q.completed ? "✓" : "○"}
                </span>
                <span class:line-through={q.completed}>{text}</span>
                <span class="ml-auto shrink-0">📍</span>
              </button>
              {#if pinnedQuest === q.index && pinnedZone}
                <div class="pl-5 pt-0.5 text-xs" style="color: var(--color-muted)">
                  {$t("quest.nearest", { name: pinnedZone.name || "?" })} ·
                  {compassLabel($locale, pinnedZone.compassKey)}
                  {formatDistance($locale, pinnedZone.distanceM)}
                  <button
                    class="ml-1 cursor-pointer underline"
                    onclick={() => onunpinquest()}
                  >
                    {$t("quest.unpin")}
                  </button>
                </div>
              {/if}
            {:else}
              <div
                class="flex items-start gap-1.5 px-1 py-0.5 text-xs"
                style="color: var(--color-muted)"
              >
                <span style="color: {q.completed ? '#72d653' : 'inherit'}">
                  {q.completed ? "✓" : "○"}
                </span>
                <span class:line-through={q.completed}>{text}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="mt-1 text-xs leading-snug" style="color: var(--color-muted)">
        {$t("quest.hint")}
      </p>
    </section>
  {/if}

  <section>
    <h2 class="mb-1 text-sm font-semibold" style="color: var(--color-accent)">
      {$t("trail.title")}
    </h2>
    <button
      class="cursor-pointer rounded border px-2 py-1 text-xs"
      style="border-color: var(--color-border)"
      onclick={() => oncleartrail()}
    >
      {$t("trail.clear")}
    </button>
    <p class="mt-1 text-xs leading-snug" style="color: var(--color-muted)">
      {$t("trail.clear_hint")}
    </p>
    {#if pastTrails.length > 0}
      <details class="mt-2">
        <summary class="cursor-pointer text-xs font-semibold" style="color: var(--color-muted)">
          {$t("trail.history")} ({pastTrails.length})
        </summary>
        <ul class="mt-1 space-y-0.5">
          {#each pastTrails as tf (tf.name)}
            <li class="flex items-center gap-2 text-xs">
              <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  class="size-3 shrink-0"
                  checked={shownPast.includes(tf.name)}
                  onchange={() => ontogglepast(tf.name)}
                />
                <span class="truncate" style="color: var(--color-text)">{tf.label}</span>
              </label>
              <span class="shrink-0" style="color: var(--color-muted)">
                {$t("trail.points", { n: tf.points })}
              </span>
              <button
                class="shrink-0 cursor-pointer rounded border px-1 leading-none"
                style="border-color: var(--color-border); color: {replayName === tf.name
                  ? 'var(--color-accent)'
                  : 'var(--color-muted)'}"
                title={$t("replay.start")}
                aria-label={$t("replay.start")}
                onclick={() => onreplay(tf.name)}
              >
                ▶
              </button>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </section>

  <section class="text-sm" style="color: var(--color-muted)">
    {#if position}
      <div class="font-mono" style="color: var(--color-text)">
        X {fmt(position.xCm)}<br />
        Y {fmt(position.yCm)}
      </div>
      {#if !position.inBounds}
        <div>{$t("pos.off_map")}</div>
      {/if}
      {#if position.headingDeg !== null}
        <div>
          {compassLabel($locale, position.compassKey)}
          {Math.round(position.headingDeg)}°
        </div>
      {:else}
        <div>{$t("heading.unknown")}</div>
      {/if}
      {#if nearest}
        <div class="mt-2 border-t pt-2" style="border-color: var(--color-border)">
          <div style="color: var(--color-text)">{nearest.name}</div>
          <div>
            {$t("wp.distance", {
              dir: compassLabel($locale, nearest.compassKey),
              dist: formatDistance($locale, nearest.distanceM),
            })}
          </div>
        </div>
      {/if}
    {:else}
      <div>{$t("pos.none")}</div>
      <div class="mt-1 text-xs">{$t("pos.hint")}</div>
    {/if}
  </section>

  <section class="min-h-0 flex-1">
    <div class="mb-1 flex items-center gap-2">
      <h2 class="text-sm font-semibold" style="color: var(--color-accent)">
        {$t("wp.title")}
      </h2>
      <div class="ml-auto flex gap-1">
        <button
          class="cursor-pointer rounded border px-1.5 py-0.5 text-xs"
          style="border-color: var(--color-border); color: var(--color-muted)"
          onclick={() => onimport()}
        >
          {$t("wp.import")}
        </button>
        <button
          class="cursor-pointer rounded border px-1.5 py-0.5 text-xs"
          style="border-color: var(--color-border); color: var(--color-muted)"
          disabled={waypoints.length === 0}
          onclick={() => onexport()}
        >
          {$t("wp.export")}
        </button>
      </div>
    </div>
    {#if waypoints.length === 0}
      <p class="text-xs" style="color: var(--color-muted)">{$t("wp.empty")}</p>
    {/if}
    {#if groups.length > 0}
      <div class="mb-1 flex flex-wrap gap-1">
        {#each groups as g (g)}
          {@const hiddenG = hiddenGroups.includes(g)}
          <button
            class="flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs"
            style={hiddenG
              ? "border-color: var(--color-border); color: var(--color-muted); opacity: 0.6"
              : "border-color: var(--color-accent); color: var(--color-text)"}
            title={$t("wp.group")}
            onclick={() => ontogglegroup(g)}
          >
            <span>{hiddenG ? "🚫" : "📁"}</span>
            <span class="max-w-24 truncate">{g}</span>
          </button>
        {/each}
      </div>
    {/if}
    <ul class="space-y-1">
      {#each waypoints as wp (wp.id)}
        <li
          class="rounded border p-1.5 text-sm"
          style="border-color: var(--color-border); background: var(--color-bg)"
        >
          {#if editingId === wp.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="w-full rounded border px-1 py-0.5 text-sm"
              style="border-color: var(--color-accent); background: var(--color-panel); color: var(--color-text)"
              bind:value={editingName}
              autofocus
              onkeydown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") editingId = null;
              }}
              onblur={commitRename}
            />
          {:else if groupingId === wp.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="w-full rounded border px-1 py-0.5 text-sm"
              style="border-color: var(--color-accent); background: var(--color-panel); color: var(--color-text)"
              list="wp-group-list"
              placeholder={$t("wp.group_edit")}
              bind:value={groupingName}
              autofocus
              onkeydown={(e) => {
                if (e.key === "Enter") commitGroup();
                if (e.key === "Escape") groupingId = null;
              }}
              onblur={commitGroup}
            />
          {:else}
            <div class="flex items-center gap-1">
              <button
                class="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline"
                title={wp.name}
                onclick={() => onfocus(wp)}
              >
                {wp.name}{#if wp.group}<span
                    class="text-xs"
                    style="color: var(--color-muted)"> · {wp.group}</span
                  >{/if}
              </button>
              <button
                class="size-3.5 shrink-0 cursor-pointer rounded-full border opacity-80 hover:opacity-100"
                style="background: {wp.color ?? '#4fc3f7'}; border-color: rgba(255,255,255,0.55)"
                title={$t("wp.color")}
                aria-label={$t("wp.color")}
                onclick={() => cycleColor(wp)}
              ></button>
              <button
                class="shrink-0 cursor-pointer px-1 text-xs opacity-70 hover:opacity-100"
                title={$t("wp.group")}
                aria-label={$t("wp.group")}
                onclick={() => startGroupEdit(wp)}
              >
                📁
              </button>
              {#if teamActive}
                <button
                  class="shrink-0 cursor-pointer px-1 text-xs opacity-70 hover:opacity-100"
                  title={$t("wp.share")}
                  aria-label={$t("wp.share")}
                  onclick={() => onshare?.(wp)}
                >
                  ⤴
                </button>
              {/if}
              <button
                class="shrink-0 cursor-pointer px-1 text-xs opacity-70 hover:opacity-100"
                title={$t("wp.rename")}
                onclick={() => startRename(wp)}
              >
                ✎
              </button>
              <button
                class="shrink-0 cursor-pointer px-1 text-xs opacity-70 hover:opacity-100"
                title={$t("wp.remove")}
                onclick={() => ondelete(wp)}
              >
                ✕
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
    <datalist id="wp-group-list">
      {#each groups as g (g)}
        <option value={g}></option>
      {/each}
    </datalist>
  </section>
</aside>
