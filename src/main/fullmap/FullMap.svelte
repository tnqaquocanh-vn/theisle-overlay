<script lang="ts">
  // Full map: Leaflet with CRS.Simple over the ACTIVE basemap's pixel space
  // (geometry from get_map_info — vulnona 7800x7817 or islemaps 2500x2500),
  // so every px/py from Rust is used directly as a map coordinate. The
  // frontend never runs a world<->pixel transform. On a basemap switch the
  // whole component is remounted by App.svelte ({#key}) — every layer's px
  // changes together with the imageOverlay.
  import { onDestroy, onMount, untrack } from "svelte";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import { tokens, glideK } from "$lib/tokens";
  import {
    addWaypointAtPixel,
    clearTrail,
    deleteWaypoint,
    getBasemapUrls,
    getCurrentPosition,
    getCurrentTrail,
    getMapInfo,
    getNearestWaypoint,
    getPoisRender,
    getExplored,
    resetExplored,
    onExploredChanged,
    listRoutes,
    saveRoute,
    deleteRoute,
    worldPointsToPx,
    type Route,
    getPreviousTrail,
    getSettings,
    islepilotOverlayMap,
    type IslepilotOverlayMap,
    listenerBag,
    listWaypointsPx,
    patchSettings,
    resolveCoordinates,
    pixelToCoords,
    measure,
    listTrails,
    getTrailFile,
    getTrailReplay,
    getTrailStats,
    exportTrailGeojson,
    type TrailReplay,
    type TrailStatPoint,
    questTargets,
    nearestZone,
    setWaypointColor,
    setWaypointGroup,
    exportWaypoints,
    importWaypoints,
    onFetchFinished,
    onWaypointsChanged,
    onPositionUpdate,
    onSettingsChanged,
    onTrailChanged,
    onDinoUpdate,
    onPartyUpdate,
    onTeamMark,
    onTeamStatus,
    teamShareWaypoint,
    onDinoAuthExpired,
    renameWaypoint,
    type NearestWaypoint,
    type OverlayRender,
    type PoiLayer,
    type PositionUpdate,
    type Settings,
    type TrailPayload,
    type Waypoint,
    type WaypointPx,
    type PixelCoords,
    type MeasureResult,
    type TrailFile,
    type QuestTargetOut,
    type NearestZone,
    type PartyMarker,
  } from "$lib/api";
  import {
    ANIMAL_GLYPHS,
    COLORS,
    LAYER_COLORS,
    layerColors,
    type ColorProfile,
    LAYER_ORDER,
    POI_DOT_RADIUS,
    WAYPOINT_GLYPHS,
    WAYPOINT_RADIUS,
    waypointGlyph,
    ZONE_FILL_OPACITY,
    ZONE_STROKE_OPACITY,
  } from "$lib/theme";
  import LayerPanel from "./LayerPanel.svelte";
  import NamePrompt from "./NamePrompt.svelte";
  import { t, tNow, locale } from "$lib/i18n";
  import { ask, message, open, save } from "@tauri-apps/plugin-dialog";

  // Ground-anchored zoom envelope: the same real-world scale range on every
  // basemap (zoom is screen px per BASEMAP px, which differs per source).
  // Derived from the original QGraphicsView envelope, scale 0.04 .. 3.0 over
  // the vulnona space (pxPerMY = 7817/11160): 0.04 * 0.70044 and 3.0 *
  // 0.70044 — so on vulnona these reproduce log2(0.04)..log2(3.0) exactly.
  const MIN_PX_PER_M = 0.028018;
  const MAX_PX_PER_M = 2.1013;

  const toLatLng = (px: number, py: number): L.LatLngTuple => [-py, px];

  // App.svelte keeps this component mounted across tab switches and says
  // whether its tab is the one on screen. Hidden means: keep the Leaflet
  // instance, do no per-sample work.
  let { visible = true }: { visible?: boolean } = $props();

  let mapEl: HTMLDivElement;
  let map: L.Map | undefined;
  let mapBounds: L.LatLngBoundsExpression | null = null;
  // True when fitBounds ran against a hidden (0x0) container because the tab
  // was switched away mid-load. The zoom it computed is meaningless and is
  // redone on the next show.
  let fitPending = false;
  // Set by onDestroy. The onMount loader awaits several IPC calls; a basemap
  // remount via {#key} (a tab switch no longer unmounts — see `visible`)
  // during any of them tears `map` down, so every resume re-checks this
  // before touching the map. Field crash: "Cannot read properties of
  // undefined (reading 'on')" on a slow first load.
  let destroyed = false;
  let layerGroups: Record<string, L.LayerGroup> = {};
  // Image overlays (fresh water). Separate from layerGroups so POI rebuilds
  // (after a background top-up) never tear them down.
  let overlayGroups: Record<string, L.LayerGroup> = {};
  // Zone name labels live in their own groups so the "zone names" toggle can
  // hide the text while the outlines stay.
  let zoneLabelGroups: Record<string, L.LayerGroup> = {};
  let waypointGroup: L.LayerGroup | undefined;
  let currentTrail: L.LayerGroup | undefined;
  let previousTrail: L.LayerGroup | undefined;
  let playerMarker: L.Marker | undefined;
  let playerArrowEl: HTMLElement | null = null;

  let settings = $state<Settings | null>(null);
  let teamActive = $state(false);
  // Layer palette for this mount. App.svelte remounts FullMap on a colour-
  // profile change ({#key}), so this is effectively constant per instance —
  // $state only so the LayerPanel prop tracks the one onMount assignment.
  let LC = $state<Record<string, string>>(LAYER_COLORS);
  let position = $state<PositionUpdate | null>(null);
  let nearest = $state<NearestWaypoint | null>(null);
  // The newest sample/trail that arrived while the tab was hidden. Nothing is
  // painted for them until the tab shows again: keeping the map alive must
  // not become a map that pans, re-projects and round-trips to Rust for the
  // nearest waypoint on every sample while nobody is looking at it — that
  // would trade a rebuild-per-visit for a cost-per-sample and come out worse.
  let parkedPosition: PositionUpdate | null = null;
  let parkedTrail: TrailPayload | null = null;
  let availableLayers = $state<string[]>([]);
  let promptOpen = $state(false);
  let pendingPixel: { px: number; py: number } | null = null;

  // Follow mode: the map auto-centres on each position update until the user
  // drags away; then the edge arrow points back and a click resumes follow.
  let follow = $state(true);
  let edgeArrow = $state<{ x: number; y: number; angle: number } | null>(null);
  let pxPerMY = 0.70044; // replaced by get_map_info at mount

  /** Searchable places (region/landmark/water names) for the panel. */
  let searchPlaces = $state<{ label: string; px: number; py: number; kind: string }[]>([]);

  // --- ruler + cursor readout (F3) ---------------------------------------
  let rulerActive = $state(false);
  let rulerPointsPx: [number, number][] = [];
  let rulerInfo = $state<MeasureResult | null>(null);
  let rulerLayer: L.LayerGroup | undefined;
  let cursorCoords = $state<PixelCoords | null>(null);
  let lastCursorAt = 0;

  // --- past-session trails (F8) -----------------------------------------
  let pastTrails = $state<TrailFile[]>([]);
  let shownPast = $state<string[]>([]);
  let pastTrailLayers: Record<string, L.LayerGroup> = {};
  const PAST_COLORS = ["#7e57c2", "#26a69a", "#8d6e63", "#5c6bc0", "#ec407a", "#9ccc65"];

  // --- session replay scrubber (A6) -----------------------------------
  let replay = $state<TrailReplay | null>(null);
  let replayName = $state<string | null>(null);
  let replayClockMs = $state(0);
  let replayPlaying = $state(false);
  let replaySpeed = $state(1);
  const REPLAY_SPEEDS = [1, 4, 16];
  let replayRaf = 0;
  let replayLastFrame = 0;
  let replayMarker: L.Marker | undefined;
  let replayPath: L.LayerGroup | undefined;
  // Stats-history samples under the loaded session (A6 overlay); null when
  // history tracking was off or the session predates it.
  let replayStats = $state<TrailStatPoint[] | null>(null);
  const REPLAY_ICON = L.divIcon({
    className: "replay-marker",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<svg viewBox="0 0 26 26" width="26" height="26">
      <circle cx="13" cy="13" r="8.5" fill="none" stroke="#0b0b0d" stroke-width="5"/>
      <circle cx="13" cy="13" r="8.5" fill="none" stroke="#f5b301" stroke-width="3"/>
      <circle cx="13" cy="13" r="3" fill="#f5b301"/>
    </svg>`,
  });

  function fmtClock(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function fmtPct(v: number | null | undefined): string {
    return v === null || v === undefined ? "—" : `${Math.round(v)}%`;
  }

  function replayCaption(): string {
    const iso = replay?.startedIso;
    if (!iso) return "";
    const d = new Date(iso);
    const when = Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString($locale === "vi" ? "vi-VN" : $locale, {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
    return $t("replay.caption", { when });
  }

  /** Interpolated map position at playback time `ms`; holds at the earlier
   * point across a gap so the marker teleports rather than gliding a route
   * that never happened. */
  function replayPosAt(ms: number): { px: number; py: number } {
    const pts = replay!.points;
    if (ms <= 0) return pts[0];
    const last = pts[pts.length - 1];
    if (ms >= last.clockMs) return last;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].clockMs <= ms) lo = mid;
      else hi = mid - 1;
    }
    const a = pts[lo];
    const b = pts[lo + 1] ?? a;
    if (replay!.gaps.includes(lo + 1)) return a;
    const span = b.clockMs - a.clockMs;
    const f = span > 0 ? (ms - a.clockMs) / span : 0;
    return { px: a.px + (b.px - a.px) * f, py: a.py + (b.py - a.py) * f };
  }

  /** Wall-clock epoch ms at playback time `ms` — lerped on the same bracket
   * as the marker, so the stat cursor stays lined up with it even where the
   * playback clock was compressed. */
  function replayRealMsAt(ms: number): number {
    const pts = replay!.points;
    if (ms <= 0) return pts[0].realMs;
    const last = pts[pts.length - 1];
    if (ms >= last.clockMs) return last.realMs;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].clockMs <= ms) lo = mid;
      else hi = mid - 1;
    }
    const a = pts[lo];
    const b = pts[lo + 1] ?? a;
    const span = b.clockMs - a.clockMs;
    const f = span > 0 ? (ms - a.clockMs) / span : 0;
    return a.realMs + (b.realMs - a.realMs) * f;
  }

  // The stat strip: three 0..100 polylines over the sampled window, drawn in
  // an SVG viewBox of 100×32 (preserveAspectRatio="none"), plus the cursor x.
  const replayStatGeom = $derived.by(() => {
    const pts = replayStats;
    if (!replay || !pts || pts.length < 2) return null;
    const t0 = pts[0].t * 1000;
    const span = pts[pts.length - 1].t * 1000 - t0 || 1;
    const line = (key: "healthPct" | "hungerPct" | "thirstPct"): string =>
      pts
        .map((p) => {
          const v = p[key];
          if (v === null) return null;
          const x = ((p.t * 1000 - t0) / span) * 100;
          const y = 30 - (Math.max(0, Math.min(100, v)) / 100) * 28;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .filter((s): s is string => s !== null)
        .join(" ");
    return { t0, span, hp: line("healthPct"), hunger: line("hungerPct"), thirst: line("thirstPct") };
  });

  const replayStatCursorX = $derived(
    replay && replayStatGeom
      ? Math.max(
          0,
          Math.min(100, ((replayRealMsAt(replayClockMs) - replayStatGeom.t0) / replayStatGeom.span) * 100),
        )
      : 0,
  );

  const replayStatAtCursor = $derived.by((): TrailStatPoint | null => {
    const pts = replayStats;
    if (!replay || !pts || !pts.length) return null;
    const tMs = replayRealMsAt(replayClockMs);
    let best = pts[0];
    let bd = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.t * 1000 - tMs);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  });

  function replayApply(): void {
    if (!replay || !replayMarker || !map) return;
    const p = replayPosAt(replayClockMs);
    const ll = toLatLng(p.px, p.py);
    replayMarker.setLatLng(ll);
    if (replayPlaying && !map.getBounds().pad(-0.2).contains(ll)) {
      map.panTo(ll, { animate: false });
    }
  }

  function replayStep(now: number): void {
    replayRaf = 0;
    if (!replay || !replayPlaying) return;
    const dt = now - replayLastFrame;
    replayLastFrame = now;
    replayClockMs = Math.min(replay.durationMs, replayClockMs + dt * replaySpeed);
    replayApply();
    if (replayClockMs >= replay.durationMs) {
      replayPlaying = false;
      return;
    }
    replayRaf = requestAnimationFrame(replayStep);
  }

  function replayToggle(): void {
    if (!replay) return;
    if (replayClockMs >= replay.durationMs) replayClockMs = 0;
    replayPlaying = !replayPlaying;
    replayLastFrame = performance.now();
    if (replayPlaying && !replayRaf) replayRaf = requestAnimationFrame(replayStep);
  }

  function replaySeek(ms: number): void {
    replayClockMs = ms;
    replayApply();
  }

  function replayCycleSpeed(): void {
    replaySpeed = REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(replaySpeed) + 1) % REPLAY_SPEEDS.length];
  }

  async function startReplay(name: string): Promise<void> {
    if (!map) return;
    const data = await getTrailReplay(name);
    if (!map) return;
    if (data.points.length < 2) {
      void message($t("replay.empty"), { kind: "warning" });
      return;
    }
    stopReplay();
    replay = data;
    replayName = name;
    replayClockMs = 0;
    replayPlaying = false;
    replaySpeed = 1;
    follow = false; // the scrubber owns the map now

    replayPath = L.layerGroup();
    const cut = [...data.gaps, data.points.length];
    let start = 0;
    for (const end of cut) {
      if (end - start >= 2) {
        L.polyline(
          data.points.slice(start, end).map((p) => toLatLng(p.px, p.py)),
          { color: "#f5b301", weight: 2.5, opacity: 0.5, interactive: false },
        ).addTo(replayPath);
      }
      start = end;
    }
    replayPath.addTo(map);

    const p0 = data.points[0];
    replayMarker = L.marker(toLatLng(p0.px, p0.py), {
      icon: REPLAY_ICON,
      interactive: false,
      keyboard: false,
      zIndexOffset: 700,
    }).addTo(map);
    map.setView(toLatLng(p0.px, p0.py));

    // Stats history under this session's wall-clock span — optional; the bar
    // just omits the strip when there is nothing recorded.
    replayStats = null;
    const spanEnd = data.points[data.points.length - 1].realMs;
    void getTrailStats(p0.realMs, spanEnd)
      .then((s) => {
        if (replayName === name) replayStats = s.length ? s : null;
      })
      .catch(() => {
        if (replayName === name) replayStats = null;
      });
  }

  function stopReplay(): void {
    replayPlaying = false;
    if (replayRaf) {
      cancelAnimationFrame(replayRaf);
      replayRaf = 0;
    }
    replayMarker?.remove();
    replayMarker = undefined;
    replayPath?.remove();
    replayPath = undefined;
    replay = null;
    replayName = null;
    replayStats = null;
    replayClockMs = 0;
  }

  async function exportReplay(): Promise<void> {
    if (!replayName) return;
    const path = await save({
      defaultPath: replayName.replace(/\.jsonl$/, "") + ".geojson",
      filters: [{ name: "GeoJSON", extensions: ["geojson", "json"] }],
    });
    if (!path) return;
    try {
      const n = await exportTrailGeojson(path, replayName);
      void message($t("replay.exported", { n }), { kind: "info" });
    } catch (e) {
      void message($t("replay.export_failed", { err: String(e) }), { kind: "error" });
    }
  }

  // --- party positions (F7) ------------------------------------------
  let partyLayer: L.LayerGroup | undefined;
  const PARTY_COLOR = "#ff7bd0";
  // Persistent markers keyed by name so a relay update eases the dot to its
  // new spot instead of stepping — since v1.19 the sender only transmits on
  // real movement (~1–2 Hz walking). Big gaps (respawn) snap.
  type PartyEntry = {
    marker: L.CircleMarker;
    from: L.LatLngTuple;
    to: L.LatLngTuple;
    xCm: number;
    yCm: number;
  };
  const partyMarkers = new Map<string, PartyEntry>();
  let partyRaf = 0;
  let partyTweenStart = 0;
  const PARTY_TWEEN_MS = tokens.motion.dur.glide;
  const PARTY_SNAP_CM = 8000;

  // --- fog of war (F9) ---------------------------------------------
  let exploredLayer: L.LayerGroup | undefined;

  // --- saved routes (F11) ----------------------------------------
  let routeLayer: L.LayerGroup | undefined;
  let routeMode = $state(false);
  let routePointsPx: [number, number][] = [];
  let routeInfo = $state<MeasureResult | null>(null);
  let routes = $state<Route[]>([]);
  let loadedRouteId = $state<string | null>(null);
  let routeNameOpen = $state(false);

  // --- Prime quest -> POI layer hints (F4) -----------------------------
  let questList = $state<QuestTargetOut[]>([]);
  let pinnedQuest = $state<number | null>(null);
  let pinnedZone = $state<NearestZone | null>(null);
  let lastQuestFetch = 0;

  const bag = listenerBag();

  // The self-marker: a yellow dart when the heading is known, a plain disc
  // when it is not — always with the dark+white double outline so it can
  // never be confused with waypoint/POI circles.
  const PLAYER_SVG = `<svg viewBox="0 0 28 28" width="28" height="28">
    <g class="glyph-arrow">
      <path d="M14 2 L24 24 L14 18 L4 24 Z" fill="${COLORS.playerArrow}"
            stroke="${COLORS.playerArrowOutline}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 2 L24 24 L14 18 L4 24 Z" fill="${COLORS.playerArrow}"
            stroke="rgba(255,255,255,0.9)" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
    <g class="glyph-dot">
      <circle cx="14" cy="14" r="6.5" fill="${COLORS.playerArrow}"
              stroke="${COLORS.playerArrowOutline}" stroke-width="3"/>
      <circle cx="14" cy="14" r="6.5" fill="${COLORS.playerArrow}"
              stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/>
    </g>
  </svg>`;

  function upsertPlayer(p: PositionUpdate) {
    if (!map) return;
    const ll = toLatLng(p.px, p.py);
    if (!playerMarker) {
      playerMarker = L.marker(ll, {
        icon: L.divIcon({
          className: "player-arrow",
          html: `<div class="player-arrow-inner">${PLAYER_SVG}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      playerArrowEl = playerMarker.getElement()?.querySelector(".player-arrow-inner") ?? null;
    } else {
      playerMarker.setLatLng(ll);
    }
    if (playerArrowEl) {
      // Rotate the INNER element: Leaflet owns the icon's own transform for
      // positioning. Compass 0 = north = up, clockwise — CSS rotate matches.
      playerArrowEl.classList.toggle("no-heading", p.headingDeg === null);
      playerArrowEl.style.transform = p.headingDeg !== null ? `rotate(${p.headingDeg}deg)` : "";
    }
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Union of POI layers and image overlays, in draw order. */
  function refreshAvailable(poiKeys: Set<string>) {
    availableLayers = LAYER_ORDER.filter(
      (k) => poiKeys.has(k) || k in overlayGroups,
    );
  }

  /** Register one image overlay (fresh water) as a toggleable layer. */
  function addOverlay(ov: OverlayRender) {
    if (!map || overlayGroups[ov.key]) return;
    const [left, top, right, bottom] = ov.boundsPx;
    const group = L.layerGroup([
      L.imageOverlay(
        ov.url,
        [
          [-bottom, left],
          [-top, right],
        ],
        { opacity: 0.9, interactive: false },
      ),
    ]);
    overlayGroups[ov.key] = group;
    if (settings?.layers?.[ov.key] ?? true) group.addTo(map);
  }

  let poiKeysPresent = new Set<string>();

  /** Tear down and rebuild the POI layers (after a re-download/top-up). */
  function rebuildPoiLayers(pois: PoiLayer[]) {
    if (!map) return;
    for (const group of [...Object.values(layerGroups), ...Object.values(zoneLabelGroups)]) {
      map.removeLayer(group);
    }
    layerGroups = {};
    zoneLabelGroups = {};
    buildPoiLayers(pois);
    // The rebuild tore the IslePilot group down with the rest — restore it
    // from the cached data, no refetch.
    if (islepilotData) buildIslepilotLayer(islepilotData);
    // The groups above were built straight from `settings`, so they already
    // match; forgetting the memo anyway means the next apply does one real
    // pass rather than trusting that to stay true through future edits.
    appliedLayerState = "";
  }

  // --- IslePilot live server POIs (token mode) -----------------------------
  let islepilotData: IslepilotOverlayMap | null = null;
  let islepilotNote = $state<string | null>(null);

  function buildIslepilotLayer(data: IslepilotOverlayMap) {
    if (!map || !data.available) return;
    const catName = new Map(data.categories.map((c) => [c.id, c.name]));
    const group = L.layerGroup();
    for (const poi of data.pois) {
      const color = poi.color ?? LC.islepilot;
      const cat = poi.categoryId ? catName.get(poi.categoryId) : undefined;
      const tooltip = [poi.name, cat].filter(Boolean).join(" · ");
      const pts = poi.pointsPx.map(([px, py]) => toLatLng(px, py));
      if (pts.length >= 3) {
        L.polygon(pts, {
          color,
          weight: 1.6,
          opacity: ZONE_STROKE_OPACITY,
          fillColor: color,
          fillOpacity: ZONE_FILL_OPACITY,
        })
          .bindTooltip(tooltip || "IslePilot", { sticky: true })
          .addTo(group);
      } else if (pts.length === 2) {
        L.polyline(pts, { color, weight: 2, opacity: ZONE_STROKE_OPACITY })
          .bindTooltip(tooltip || "IslePilot", { sticky: true })
          .addTo(group);
      } else if (pts.length === 1) {
        L.circleMarker(pts[0], {
          radius: POI_DOT_RADIUS,
          color: "rgba(0,0,0,0.63)",
          weight: 1,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindTooltip(tooltip || "IslePilot")
          .addTo(group);
      }
    }
    layerGroups["islepilot"] = group;
    if (settings?.layers?.["islepilot"] ?? false) group.addTo(map);
    poiKeysPresent.add("islepilot");
    refreshAvailable(poiKeysPresent);
  }

  async function loadIslepilotPois() {
    try {
      const data = await islepilotOverlayMap();
      if (data.available) {
        islepilotData = data;
        islepilotNote = null;
        buildIslepilotLayer(data);
      } else if (data.reason === "discord") {
        islepilotNote = tNow("poi.islepilot_discord");
      } else if (data.reason === "disabled") {
        islepilotNote = tNow("poi.islepilot_disabled");
      }
      // "not-logged-in" / "empty": stay silent — the layer simply is absent.
    } catch {
      // Token expired or offline: the map works without server POIs.
    }
  }

  function buildPoiLayers(pois: PoiLayer[]) {
    if (!map) return;
    const byKey = new Map(pois.map((l) => [l.key, l]));
    for (const key of LAYER_ORDER) {
      const layer = byKey.get(key);
      if (!layer) continue;
      const color = LC[key] ?? COLORS.accent;
      const group = L.layerGroup();
      const labelGroup = layer.kind === "zone" ? L.layerGroup() : undefined;
      for (const item of layer.items) {
        if (layer.kind === "label") {
          // Pure text label (region/landmark names) — no shape.
          L.marker(toLatLng(item.px, item.py), {
            icon: L.divIcon({
              className: `map-label map-label--${key}`,
              html: escapeHtml(item.label),
              iconSize: undefined,
            }),
            interactive: false,
            keyboard: false,
          }).addTo(group);
          continue;
        }
        if (
          labelGroup &&
          item.label &&
          item.labelPx !== undefined &&
          item.labelPy !== undefined
        ) {
          // Permanent name at the zone's centre, colour-matched to its layer.
          L.tooltip({
            permanent: true,
            direction: "center",
            className: "zone-label",
            opacity: 1,
            interactive: false,
          })
            .setContent(
              `<span style="color: ${color}">${escapeHtml(item.label)}</span>`,
            )
            .setLatLng(toLatLng(item.labelPx, item.labelPy))
            .addTo(labelGroup);
        }
        if (item.pointsPx) {
          L.polygon(item.pointsPx.map(([px, py]) => toLatLng(px, py)), {
            color,
            weight: 1.6,
            opacity: ZONE_STROKE_OPACITY,
            fillColor: color,
            fillOpacity: ZONE_FILL_OPACITY,
          })
            .bindTooltip(item.label, { sticky: true })
            .addTo(group);
        } else if (item.radiusPx) {
          // CRS.Simple: L.circle radius is in map units = basemap pixels.
          L.circle(toLatLng(item.px, item.py), {
            radius: item.radiusPx,
            color,
            weight: 1.6,
            opacity: ZONE_STROKE_OPACITY,
            fillColor: color,
            fillOpacity: ZONE_FILL_OPACITY,
          })
            .bindTooltip(item.label, { sticky: true })
            .addTo(group);
        } else {
          // Animals get a per-species glyph "logo"; everything else (and any
          // species without a glyph) stays a fixed screen-size dot.
          const glyph = key === "animal" ? ANIMAL_GLYPHS[item.label] : undefined;
          if (glyph) {
            L.marker(toLatLng(item.px, item.py), {
              icon: L.divIcon({
                className: "animal-glyph",
                html: glyph,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              }),
              keyboard: false,
            })
              .bindTooltip(item.label)
              .addTo(group);
          } else {
            // Fixed screen-size dot at any zoom (circleMarker radius is px).
            L.circleMarker(toLatLng(item.px, item.py), {
              radius: POI_DOT_RADIUS,
              color: "rgba(0,0,0,0.63)",
              weight: 1,
              fillColor: color,
              fillOpacity: 1,
            })
              .bindTooltip(item.label)
              .addTo(group);
          }
        }
      }
      layerGroups[key] = group;
      if (settings?.layers?.[key] ?? true) group.addTo(map);
      if (labelGroup) {
        zoneLabelGroups[key] = labelGroup;
        if ((settings?.layers?.[key] ?? true) && (settings?.map?.zone_labels ?? true)) {
          labelGroup.addTo(map);
        }
      }
    }
    poiKeysPresent = new Set(byKey.keys());
    refreshAvailable(poiKeysPresent);
    // Named places for the search box (labels only, not zones).
    searchPlaces = ["region", "landmark", "water"].flatMap((key) =>
      (byKey.get(key)?.items ?? [])
        .filter((it) => it.label)
        .map((it) => ({ label: it.label, px: it.px, py: it.py, kind: key })),
    );
  }

  function drawTrail(target: L.LayerGroup, trail: TrailPayload, dimmed: boolean) {
    target.clearLayers();
    for (const seg of trail.segmentsPx) {
      if (seg.length < 2) continue;
      L.polyline(seg.map(([px, py]) => toLatLng(px, py)), {
        color: COLORS.trail,
        weight: 2,
        opacity: dimmed ? 0.35 : 0.9,
        dashArray: dimmed ? "6 6" : undefined,
        interactive: false,
      }).addTo(target);
    }
  }

  let waypointsPx = $state<WaypointPx[]>([]);

  async function refreshWaypoints() {
    // px/py for rendering come from Rust — the transform stays single-sourced.
    waypointsPx = await listWaypointsPx();
    if (!map || !waypointGroup) return;
    waypointGroup.clearLayers();
    // Hidden groups: dropped from the MAP, still listed in the panel so they
    // can be reassigned / unhidden.
    const hidden = new Set(settings?.hidden_waypoint_groups ?? []);
    for (const wp of waypointsPx) {
      if (wp.group && hidden.has(wp.group)) continue;
      // A name starting with a preset icon (💀 🏠 💧 ⚠️ 🍖) renders as that
      // glyph itself; everything else stays a colour dot.
      const glyph = waypointGlyph(wp.name);
      if (glyph) {
        L.marker(toLatLng(wp.px, wp.py), {
          icon: L.divIcon({
            className: "wp-glyph",
            html: glyph,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          keyboard: false,
        })
          .bindTooltip(wp.name)
          .addTo(waypointGroup);
        continue;
      }
      L.circleMarker(toLatLng(wp.px, wp.py), {
        radius: WAYPOINT_RADIUS,
        color: "rgba(0,0,0,0.78)",
        weight: 1.2,
        fillColor: wp.color ?? COLORS.waypoint,
        fillOpacity: 1,
      })
        .bindTooltip(wp.name)
        .addTo(waypointGroup);
    }
    nearest = await getNearestWaypoint();
  }

  // The last layer state actually applied. Two callers hit this per layer
  // click — the click handler, then the settings broadcast looping back — and
  // every settings broadcast of any kind lands here too: an opacity hotkey, a
  // language switch, the telemetry checkbox. Comparing first turns all of
  // those into a no-op instead of a sweep over every Leaflet group.
  let appliedLayerState = "";

  function applyLayerVisibility(layers: Record<string, boolean>, zoneLabels: boolean) {
    if (!map) return;
    const next = JSON.stringify(layers) + (zoneLabels ? "|1" : "|0");
    if (next === appliedLayerState) return;
    appliedLayerState = next;
    const setVisible = (group: L.LayerGroup, visible: boolean) => {
      if (visible && !map!.hasLayer(group)) group.addTo(map!);
      if (!visible && map!.hasLayer(group)) map!.removeLayer(group);
    };
    for (const [key, group] of Object.entries({ ...overlayGroups, ...layerGroups })) {
      setVisible(group, layers[key] ?? true);
    }
    for (const [key, group] of Object.entries(zoneLabelGroups)) {
      setVisible(group, (layers[key] ?? true) && zoneLabels);
    }
  }

  const zoneLabelsOn = (s: Settings | null) => s?.map?.zone_labels ?? true;

  async function onToggleLayer(key: string, visible: boolean) {
    // Persisted (bug fix 1) — settings://changed loops back to every window,
    // including the minimap's POI filter.
    settings = await patchSettings({ layers: { [key]: visible } });
    applyLayerVisibility(settings.layers, zoneLabelsOn(settings));
  }

  async function onToggleZoneLabels(visible: boolean) {
    settings = await patchSettings({ map: { zone_labels: visible } });
    applyLayerVisibility(settings.layers, zoneLabelsOn(settings));
  }

  async function confirmPrompt(name: string) {
    promptOpen = false;
    if (!pendingPixel) return;
    await addWaypointAtPixel(pendingPixel.px, pendingPixel.py, name || tNow("wp.new"));
    pendingPixel = null;
    await refreshWaypoints();
  }

  async function onRename(id: string, name: string) {
    await renameWaypoint(id, name);
    await refreshWaypoints();
  }

  async function onDelete(wp: Waypoint) {
    const yes = await ask(tNow("wp.confirm_delete", { name: wp.name }), {
      title: tNow("wp.title"),
      kind: "warning",
    });
    if (!yes) return;
    await deleteWaypoint(wp.id);
    await refreshWaypoints();
  }

  function focusWaypoint(wp: Waypoint) {
    const found = waypointsPx.find((w) => w.id === wp.id);
    if (map && found) locatePx(found.px, found.py);
  }

  async function onClearTrail() {
    // The command clears the tracker and broadcasts trail://changed (empty),
    // which repaints currentTrail here AND on the minimap. The previous
    // session's dimmed trail has no event channel — clear it locally.
    await clearTrail();
    previousTrail?.clearLayers();
  }

  async function onSetColor(wp: Waypoint, color: string | null) {
    await setWaypointColor(wp.id, color);
    await refreshWaypoints();
  }

  async function onSetGroup(id: string, group: string | null) {
    await setWaypointGroup(id, group);
    await refreshWaypoints();
  }

  async function onToggleGroup(name: string) {
    const cur = settings?.hidden_waypoint_groups ?? [];
    const next = cur.includes(name) ? cur.filter((g) => g !== name) : [...cur, name];
    settings = await patchSettings({ hidden_waypoint_groups: next });
    await refreshWaypoints();
  }

  async function onExportWaypoints() {
    const path = await save({
      defaultPath: "waypoints.tio-wp.json",
      filters: [{ name: "TheIsle waypoints", extensions: ["json"] }],
    });
    if (!path) return;
    const n = await exportWaypoints(path, []);
    await message(tNow("wp.export_done", { n }), { title: tNow("wp.title"), kind: "info" });
  }

  async function onImportWaypoints() {
    const picked = await open({
      multiple: false,
      filters: [{ name: "TheIsle waypoints", extensions: ["json"] }],
    });
    if (typeof picked !== "string") return;
    try {
      const res = await importWaypoints(picked);
      await refreshWaypoints();
      await message(
        tNow("wp.import_done", { added: res.added, skipped: res.skipped }),
        { title: tNow("wp.title"), kind: "info" },
      );
    } catch (e) {
      await message(String(e), { title: tNow("wp.title"), kind: "error" });
    }
  }

  // --- ruler + cursor readout ---------------------------------------------
  function drawRuler() {
    if (!map || !rulerLayer) return;
    rulerLayer.clearLayers();
    const lls = rulerPointsPx.map(([px, py]) => toLatLng(px, py));
    if (lls.length >= 2) {
      L.polyline(lls, {
        color: COLORS.accent,
        weight: 2,
        dashArray: "5 4",
        interactive: false,
      }).addTo(rulerLayer);
    }
    for (const ll of lls) {
      L.circleMarker(ll, {
        radius: 3,
        color: COLORS.accent,
        weight: 2,
        fillColor: COLORS.bg,
        fillOpacity: 1,
        interactive: false,
      }).addTo(rulerLayer);
    }
  }

  function clearRuler() {
    rulerPointsPx = [];
    rulerInfo = null;
    rulerLayer?.clearLayers();
  }

  function toggleRuler() {
    rulerActive = !rulerActive;
    if (rulerActive) routeMode = false;
    else clearRuler();
  }

  // --- fog of war ------------------------------------------------------
  async function refreshExplored() {
    if (!map || !exploredLayer) return;
    exploredLayer.clearLayers();
    if (!settings?.layers?.explored) return;
    const r = await getExplored();
    for (const [l, t, rt, b] of r.cells) {
      L.rectangle(
        [
          [-b, l],
          [-t, rt],
        ],
        { stroke: false, fillColor: COLORS.accent, fillOpacity: 0.09, interactive: false },
      ).addTo(exploredLayer);
    }
  }

  async function toggleExplored(v: boolean) {
    settings = await patchSettings({ layers: { explored: v } });
    await refreshExplored();
  }

  async function onResetExplored() {
    const yes = await ask(tNow("explored.reset_confirm"), {
      title: tNow("layer.explored"),
      kind: "warning",
    });
    if (!yes) return;
    await resetExplored();
    await refreshExplored();
  }

  // --- saved routes -------------------------------------------------
  function drawRoute() {
    if (!map || !routeLayer) return;
    routeLayer.clearLayers();
    const lls = routePointsPx.map(([px, py]) => toLatLng(px, py));
    if (lls.length >= 2) {
      L.polyline(lls, { color: "#4fc3f7", weight: 3, opacity: 0.9, interactive: false }).addTo(
        routeLayer,
      );
    }
    lls.forEach((ll, i) => {
      L.marker(ll, {
        icon: L.divIcon({ className: "route-node", html: String(i + 1), iconSize: [16, 16] }),
        interactive: false,
        keyboard: false,
      }).addTo(routeLayer!);
    });
  }

  function clearRoute() {
    routePointsPx = [];
    routeInfo = null;
    loadedRouteId = null;
    routeLayer?.clearLayers();
  }

  function toggleRoute() {
    routeMode = !routeMode;
    if (routeMode) rulerActive = false;
  }

  function saveCurrentRoute() {
    if (routeInfo && routeInfo.pointsCm.length >= 2) routeNameOpen = true;
  }

  async function confirmRouteName(name: string) {
    routeNameOpen = false;
    if (!routeInfo || routeInfo.pointsCm.length < 2) return;
    await saveRoute(name || tNow("route.tool"), routeInfo.pointsCm);
    await refreshRoutes();
  }

  async function loadRoute(rt: Route) {
    routeMode = false;
    routePointsPx = await worldPointsToPx(rt.points);
    if (destroyed) return;
    loadedRouteId = rt.id;
    drawRoute();
    routeInfo = await measure(routePointsPx);
  }

  async function deleteRouteFn(id: string) {
    await deleteRoute(id);
    if (loadedRouteId === id) clearRoute();
    await refreshRoutes();
  }

  async function refreshRoutes() {
    routes = await listRoutes();
  }

  async function setCursorCoords(v: boolean) {
    settings = await patchSettings({ map: { show_cursor_coords: v } });
    if (!v) cursorCoords = null;
  }

  // --- Prime quest hints ----------------------------------------------
  async function refreshPinnedZone() {
    const q = questList.find((x) => x.index === pinnedQuest);
    if (!q?.target) {
      pinnedZone = null;
      return;
    }
    pinnedZone = await nearestZone(q.target.layerKey);
  }

  async function refreshQuests() {
    questList = await questTargets();
    // A pinned quest that vanished (logged out, swapped dino) unpins itself.
    if (pinnedQuest !== null && !questList.some((q) => q.index === pinnedQuest)) {
      pinnedQuest = null;
      pinnedZone = null;
    } else if (pinnedQuest !== null) {
      await refreshPinnedZone();
    }
  }

  async function pinQuest(index: number) {
    const q = questList.find((x) => x.index === index);
    if (!q?.target) return;
    pinnedQuest = index;
    // "Show me on the map" = force that POI layer on.
    settings = await patchSettings({ layers: { [q.target.layerKey]: true } });
    applyLayerVisibility(settings.layers, zoneLabelsOn(settings));
    await refreshPinnedZone();
    if (pinnedZone) locatePx(pinnedZone.px, pinnedZone.py);
  }

  function unpinQuest() {
    pinnedQuest = null;
    pinnedZone = null;
  }

  // --- party positions -----------------------------------------------
  function clearParty() {
    if (partyRaf) cancelAnimationFrame(partyRaf);
    partyRaf = 0;
    for (const e of partyMarkers.values()) e.marker.remove();
    partyMarkers.clear();
  }

  function stepParty() {
    partyRaf = 0;
    if (destroyed || !map) return;
    const t = Math.min(1, (performance.now() - partyTweenStart) / PARTY_TWEEN_MS);
    const k = glideK(t);
    for (const e of partyMarkers.values()) {
      e.marker.setLatLng([
        e.from[0] + (e.to[0] - e.from[0]) * k,
        e.from[1] + (e.to[1] - e.from[1]) * k,
      ]);
    }
    if (t < 1) partyRaf = requestAnimationFrame(stepParty);
  }

  // A5 — solo mode hides teammate clutter (party dots + contact pings) here too.
  const soloMode = $derived(Boolean((settings?.minimap as { solo_mode?: boolean })?.solo_mode));

  function drawParty(markers: PartyMarker[]) {
    if (!map || !partyLayer) return;
    if (soloMode) {
      clearParty();
      return;
    }
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.label);
      // G6 relay carries HP → green/amber/red like the dino panel; F7 markers
      // stay the neutral party colour.
      const fill =
        m.hp == null
          ? PARTY_COLOR
          : m.hp > 50
            ? "#72d653"
            : m.hp > 25
              ? "#e8a33d"
              : "#e2664a";
      const label = m.hp == null ? m.label : `${m.label} · ${Math.round(m.hp)}%`;
      const radius = m.hp != null && m.hp <= 25 ? 7 : 5;
      const target = toLatLng(m.px, m.py);
      const entry = partyMarkers.get(m.label);
      if (!entry) {
        const marker = L.circleMarker(target, {
          radius,
          color: "#fff",
          weight: 1.5,
          fillColor: fill,
          fillOpacity: 1,
        })
          .bindTooltip(label, {
            permanent: true,
            direction: "top",
            className: "party-label",
            opacity: 1,
          })
          .addTo(partyLayer);
        partyMarkers.set(m.label, { marker, from: target, to: target, xCm: m.xCm, yCm: m.yCm });
      } else {
        const jump = Math.hypot(m.xCm - entry.xCm, m.yCm - entry.yCm) > PARTY_SNAP_CM;
        const cur = entry.marker.getLatLng();
        entry.from = jump ? target : [cur.lat, cur.lng];
        entry.to = target;
        entry.xCm = m.xCm;
        entry.yCm = m.yCm;
        entry.marker.setRadius(radius);
        entry.marker.setStyle({ fillColor: fill });
        entry.marker.setTooltipContent(label);
      }
    }
    for (const [name, entry] of partyMarkers) {
      if (!seen.has(name)) {
        entry.marker.remove();
        partyMarkers.delete(name);
      }
    }
    partyTweenStart = performance.now();
    if (!partyRaf && partyMarkers.size) partyRaf = requestAnimationFrame(stepParty);
  }

  // --- past-session trails ----------------------------------------------
  async function togglePastTrail(name: string) {
    if (!map) return;
    if (shownPast.includes(name)) {
      pastTrailLayers[name]?.remove();
      delete pastTrailLayers[name];
      shownPast = shownPast.filter((n) => n !== name);
      return;
    }
    const payload = await getTrailFile(name);
    if (!map) return;
    const group = L.layerGroup();
    const color = PAST_COLORS[shownPast.length % PAST_COLORS.length];
    for (const seg of payload.segmentsPx) {
      if (seg.length < 2) continue;
      L.polyline(
        seg.map(([px, py]) => toLatLng(px, py)),
        { color, weight: 2, opacity: 0.55, dashArray: "3 5", interactive: false },
      ).addTo(group);
    }
    group.addTo(map);
    pastTrailLayers[name] = group;
    shownPast = [...shownPast, name];
  }

  /** Player marker outside the viewport -> an arrow at the viewport edge on
   * the centre->player ray; clicking it (or the recenter button) resumes
   * follow. Recomputed on map moves and position updates — no timers. */
  function updateEdgeArrow() {
    if (!map || !position) {
      edgeArrow = null;
      return;
    }
    const p = map.latLngToContainerPoint(toLatLng(position.px, position.py));
    const size = map.getSize();
    const m = 28;
    if (p.x >= m && p.x <= size.x - m && p.y >= m && p.y <= size.y - m) {
      edgeArrow = null;
      return;
    }
    const cx = size.x / 2;
    const cy = size.y / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const sx = dx !== 0 ? (size.x / 2 - m) / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? (size.y / 2 - m) / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy, 1);
    edgeArrow = {
      x: cx + dx * s,
      y: cy + dy * s,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }

  function recenter() {
    follow = true;
    if (map && position) map.panTo(toLatLng(position.px, position.py));
    edgeArrow = null;
  }

  /** One-shot locate pulse; the marker removes itself (no repaint loops). */
  function pulseAt(px: number, py: number) {
    if (!map) return;
    const marker = L.marker(toLatLng(px, py), {
      icon: L.divIcon({ className: "locate-pulse", iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      keyboard: false,
    }).addTo(map);
    setTimeout(() => marker.remove(), 2600);
  }

  function locatePx(px: number, py: number) {
    if (!map) return;
    follow = false;
    // Ground-anchored floor (~0.35 px/m) so "locate" lands at a readable
    // scale on every basemap without yanking an already-zoomed view.
    const floor = Math.log2(0.35 / pxPerMY);
    map.setView(toLatLng(px, py), Math.max(map.getZoom(), floor));
    pulseAt(px, py);
    updateEdgeArrow();
  }

  /** Manually pasted coordinate text from the search box. */
  async function onSearchCoords(text: string): Promise<boolean> {
    const r = await resolveCoordinates(text);
    if (!r) return false;
    locatePx(r.px, r.py);
    return true;
  }

  function applyPosition(p: PositionUpdate, animate = true) {
    position = p;
    if (!map) return;
    upsertPlayer(p);
    if (follow) map.panTo(toLatLng(p.px, p.py), { animate });
    updateEdgeArrow();
  }

  // Coming back from display:none. Leaflet measured a 0x0 container while
  // hidden — without invalidateSize the view paints blank or offset — then
  // whatever was parked meanwhile is applied once, without animating across
  // what may be a long jump.
  $effect(() => {
    if (!visible || !map) return;
    // untrack: the work below both writes and reads $state (position,
    // edgeArrow, nearest via applyPosition). Tracked, that made this effect
    // depend on `position` and re-run itself on the next sample after every
    // show. Its only real input is `visible`, read above.
    untrack(() => {
      map!.invalidateSize({ animate: false });
      if (fitPending && mapBounds) {
        fitPending = false;
        // No animation: it would tween from the meaningless hidden-container
        // zoom, and the user is arriving on a tab, not watching a transition.
        map!.fitBounds(mapBounds, { animate: false });
      }
      const trail = parkedTrail;
      parkedTrail = null;
      if (trail && currentTrail) drawTrail(currentTrail, trail, false);
      const p = parkedPosition;
      parkedPosition = null;
      if (p) {
        applyPosition(p, false);
        void getNearestWaypoint().then((n) => {
          if (!destroyed) nearest = n;
        });
      }
    });
  });

  onMount(() => {
    (async () => {
      settings = await getSettings();
      LC = layerColors(settings.color_profile as ColorProfile);
      const info = await getMapInfo();
      // Unmounted meanwhile: a Leaflet map built now would sit on a detached
      // element and never be removed (onDestroy already ran).
      if (destroyed) return;
      const W = info.imageWidthPx;
      const H = info.imageHeightPx;
      pxPerMY = info.pxPerMY;

      map = L.map(mapEl, {
        crs: L.CRS.Simple,
        minZoom: Math.log2(MIN_PX_PER_M / info.pxPerMY),
        maxZoom: Math.log2(MAX_PX_PER_M / info.pxPerMY),
        zoomSnap: 0,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 90,
        attributionControl: false,
        zoomControl: true,
      });
      const bounds: L.LatLngBoundsExpression = [
        [-H, 0],
        [0, W],
      ];
      const urls = await getBasemapUrls();
      if (destroyed || !map) return;
      L.imageOverlay(urls.fullmap, bounds).addTo(map);
      mapBounds = bounds;
      map.fitBounds(bounds);
      fitPending = !visible;
      map.setMaxBounds([
        [-H * 1.15, -W * 0.15],
        [H * 0.15, W * 1.15],
      ]);

      // Image overlays right after the basemap so their <img> sits under
      // every vector layer added later.
      for (const ov of info.overlays) addOverlay(ov);

      // Fog-of-war grid sits just above the basemap, under everything else.
      exploredLayer = L.layerGroup().addTo(map);
      previousTrail = L.layerGroup().addTo(map);
      currentTrail = L.layerGroup().addTo(map);
      waypointGroup = L.layerGroup().addTo(map);
      rulerLayer = L.layerGroup().addTo(map);
      routeLayer = L.layerGroup().addTo(map);
      partyLayer = L.layerGroup().addTo(map);

      try {
        buildPoiLayers(await getPoisRender());
      } catch {
        // POI data missing (partial first run): map works without dots.
      }
      // Server POIs load in the background — never block the map paint.
      void loadIslepilotPois();
      drawTrail(previousTrail, await getPreviousTrail(), true);
      drawTrail(currentTrail, await getCurrentTrail(), false);
      await refreshWaypoints();
      pastTrails = await listTrails();
      await refreshQuests();
      lastQuestFetch = Date.now();
      await refreshExplored();
      await refreshRoutes();
      // The helpers above all guard `map` themselves; the handlers below do
      // not, and this is the point the field crash resumed at.
      if (destroyed || !map) return;

      map.on("contextmenu", (e: L.LeafletMouseEvent) => {
        // A right-click clears the active drawing tool instead of dropping a
        // waypoint.
        if (rulerActive) {
          clearRuler();
          return;
        }
        if (routeMode) {
          clearRoute();
          return;
        }
        pendingPixel = { px: e.latlng.lng, py: -e.latlng.lat };
        promptOpen = true;
      });
      // Ruler / route: each left-click adds a point to the active tool.
      map.on("click", (e: L.LeafletMouseEvent) => {
        const pt: [number, number] = [e.latlng.lng, -e.latlng.lat];
        if (rulerActive) {
          rulerPointsPx = [...rulerPointsPx, pt];
          drawRuler();
          void measure(rulerPointsPx).then((r) => {
            if (!destroyed) rulerInfo = r;
          });
        } else if (routeMode) {
          routePointsPx = [...routePointsPx, pt];
          loadedRouteId = null;
          drawRoute();
          void measure(routePointsPx).then((r) => {
            if (!destroyed) routeInfo = r;
          });
        }
      });
      // Cursor readout: throttled, and free when the toggle is off.
      map.on("mousemove", (e: L.LeafletMouseEvent) => {
        if (!visible || !(settings?.map?.show_cursor_coords ?? false)) return;
        const now = Date.now();
        if (now - lastCursorAt < 80) return;
        lastCursorAt = now;
        void pixelToCoords(e.latlng.lng, -e.latlng.lat).then((c) => {
          if (!destroyed) cursorCoords = c;
        });
      });
      map.on("mouseout", () => (cursorCoords = null));
      // A manual drag pauses follow; the edge arrow / recenter button resume
      // it. Zoom alone does NOT pause (you zoom around your own position).
      map.on("dragstart", () => (follow = false));
      map.on("move", updateEdgeArrow);

      await bag.add(
        onPositionUpdate(async (p) => {
          if (!visible) {
            parkedPosition = p;
            return;
          }
          applyPosition(p);
          nearest = await getNearestWaypoint();
          if (pinnedQuest !== null) void refreshPinnedZone();
        }),
      );
      await bag.add(
        onDinoUpdate(() => {
          // The poll fires ~every 10 s; one quest reparse per 15 s is plenty.
          if (Date.now() - lastQuestFetch > 15_000) {
            lastQuestFetch = Date.now();
            void refreshQuests();
          }
        }),
      );
      await bag.add(onPartyUpdate((markers) => drawParty(markers)));
      await bag.add(onTeamStatus((s) => (teamActive = s.active)));
      await bag.add(
        onTeamMark((m) => {
          if (!map || !partyLayer || soloMode) return;
          // A5 — a "predator seen" alert: a translucent danger zone + a ring
          // + name, held ~3 min (dimmer for the last third, then gone).
          const at = toLatLng(m.px, m.py);
          const zone = L.circleMarker(at, {
            radius: 34,
            color: "#d9604a",
            weight: 1,
            fillColor: "#d9604a",
            fillOpacity: 0.13,
            opacity: 0.35,
            interactive: false,
          }).addTo(partyLayer);
          const ring = L.circleMarker(at, { radius: 10, color: "#ff5a5a", weight: 3, fill: false })
            .bindTooltip(`⚠ ${m.from}`, {
              permanent: true,
              direction: "top",
              className: "party-label",
              opacity: 1,
            })
            .addTo(partyLayer);
          const PREDATOR_ALERT_MS = 180_000;
          setTimeout(() => {
            zone.setStyle({ fillOpacity: 0.06, opacity: 0.18 });
            ring.setStyle({ opacity: 0.4 });
          }, PREDATOR_ALERT_MS * 0.66);
          setTimeout(() => {
            zone.remove();
            ring.remove();
          }, PREDATOR_ALERT_MS);
        }),
      );
      // The poll stops emitting party on logout / expiry — clear the stale pins.
      await bag.add(
        onDinoAuthExpired(() => {
          clearParty();
          partyLayer?.clearLayers();
        }),
      );
      await bag.add(onExploredChanged(() => void refreshExplored()));
      await bag.add(
        onTrailChanged((trail) => {
          if (!visible) {
            parkedTrail = trail;
            return;
          }
          if (currentTrail) drawTrail(currentTrail, trail, false);
        }),
      );
      await bag.add(
        onSettingsChanged((s) => {
          const groupsChanged =
            JSON.stringify(s.hidden_waypoint_groups) !==
            JSON.stringify(settings?.hidden_waypoint_groups);
          const exploredChanged =
            (s.layers?.explored ?? false) !== (settings?.layers?.explored ?? false);
          settings = s;
          applyLayerVisibility(s.layers, zoneLabelsOn(s));
          if (groupsChanged) void refreshWaypoints();
          if (exploredChanged) void refreshExplored();
        }),
      );
      // Hotkey "mark here" adds waypoints from Rust — refresh on its signal.
      await bag.add(onWaypointsChanged(() => void refreshWaypoints()));
      // A re-download or the silent top-up finished: new overlays/POI layers
      // (animal, fresh water) appear live without leaving the tab.
      await bag.add(
        onFetchFinished(async () => {
          const fresh = await getMapInfo();
          for (const ov of fresh.overlays) addOverlay(ov);
          refreshAvailable(poiKeysPresent);
          try {
            rebuildPoiLayers(await getPoisRender());
          } catch {
            // POI data still missing — overlays alone are fine.
          }
        }),
      );

      // Initial paint: position otherwise arrives only as an event, so after
      // an F5 the marker would wait for the player's next manual copy.
      const p = await getCurrentPosition();
      if (p && map) {
        position = p;
        upsertPlayer(p);
        map.panTo(toLatLng(p.px, p.py));
        nearest = await getNearestWaypoint();
      }
    })();

    // Esc clears an in-progress ruler measurement (a global key, since the
    // map div is not focused while you point at it).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (rulerActive) clearRuler();
      if (routeMode) clearRoute();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      bag.dispose();
      window.removeEventListener("keydown", onKey);
    };
  });

  onDestroy(() => {
    destroyed = true;
    if (partyRaf) cancelAnimationFrame(partyRaf);
    if (replayRaf) cancelAnimationFrame(replayRaf);
    try {
      if (map) {
        // Leaflet ends a zoom animation on a 250 ms timer (Map._animateZoom,
        // its transitionend workaround) that outlives remove(): remove()
        // deletes _mapPane but never clears _animatingZoom, so the timer's
        // _onZoomTransitionEnd goes on to _move() and dereferences the gone
        // pane. Field crash on 1.5.1: "Cannot read properties of undefined
        // (reading '_leaflet_pos')" — a wheel zoom followed by a tab switch
        // within 250 ms. Nothing public cancels a zoom animation; the
        // handler's own first line is this flag, so clear it.
        (map as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
        map.remove();
      }
    } catch {
      // A torn-down Leaflet must not poison the next mount of this tab.
    }
    map = undefined;
  });
</script>

<div class="flex h-full min-h-0">
  <div class="relative min-w-0 flex-1">
    <div class="absolute inset-0" bind:this={mapEl} style="background: var(--color-bg)"></div>
    {#if edgeArrow}
      <button
        class="edge-arrow"
        style="left: {edgeArrow.x}px; top: {edgeArrow.y}px; transform: translate(-50%, -50%) rotate({edgeArrow.angle}deg)"
        title={$t("map.recenter")}
        onclick={recenter}
      >
        ➤
      </button>
    {/if}
    {#if !follow && position}
      <button class="recenter-btn" title={$t("map.recenter")} onclick={recenter}>
        ◎ {$t("map.recenter")}
      </button>
    {/if}
    {#if (settings?.map?.show_cursor_coords ?? false) && cursorCoords}
      <div class="cursor-coords">
        {cursorCoords.xCm.toFixed(1)}, {cursorCoords.yCm.toFixed(1)}
      </div>
    {/if}
    {#if replay}
      <div class="replay-bar">
        {#if replayStatGeom}
          <div class="replay-stats">
            <svg class="rs-plot" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
              {#each [25, 50, 75] as g (g)}
                <line class="rs-grid" x1="0" x2="100" y1={30 - (g / 100) * 28} y2={30 - (g / 100) * 28} />
              {/each}
              {#if replayStatGeom.thirst}
                <polyline class="rs-line rs-thirst" points={replayStatGeom.thirst} />
              {/if}
              {#if replayStatGeom.hunger}
                <polyline class="rs-line rs-hunger" points={replayStatGeom.hunger} />
              {/if}
              {#if replayStatGeom.hp}
                <polyline class="rs-line rs-hp" points={replayStatGeom.hp} />
              {/if}
              <line class="rs-cursor" x1={replayStatCursorX} x2={replayStatCursorX} y1="0" y2="32" />
            </svg>
            <div class="rs-read">
              <span class="rs-tag rs-hp">{$t("dino.health")} {fmtPct(replayStatAtCursor?.healthPct)}</span>
              <span class="rs-tag rs-hunger">{$t("dino.hunger")} {fmtPct(replayStatAtCursor?.hungerPct)}</span>
              <span class="rs-tag rs-thirst">{$t("dino.thirst")} {fmtPct(replayStatAtCursor?.thirstPct)}</span>
            </div>
          </div>
        {/if}
        <div class="replay-controls">
          <button
            class="replay-btn replay-btn--primary"
            onclick={replayToggle}
            title={replayPlaying ? $t("replay.pause") : $t("replay.play")}
          >
            {replayPlaying ? "⏸" : "▶"}
          </button>
          <div class="replay-track">
            <input
              type="range"
              min="0"
              max={replay.durationMs}
              step="100"
              value={replayClockMs}
              oninput={(e) => replaySeek(+e.currentTarget.value)}
              aria-label={$t("replay.start")}
            />
            <div class="replay-meta">
              <span class="replay-time">{fmtClock(replayClockMs)} / {fmtClock(replay.durationMs)}</span>
              {#if replayCaption()}<span class="replay-cap">{replayCaption()}</span>{/if}
            </div>
          </div>
          <button class="replay-btn" onclick={replayCycleSpeed} title={$t("replay.speed", { n: replaySpeed })}>
            {replaySpeed}×
          </button>
          <button class="replay-btn" onclick={() => void exportReplay()} title={$t("replay.export")}>
            ⤓
          </button>
          <button class="replay-btn" onclick={stopReplay} title={$t("replay.close")}>✕</button>
        </div>
      </div>
    {/if}
  </div>
  <LayerPanel
    available={availableLayers}
    layers={settings?.layers ?? {}}
    zoneLabels={zoneLabelsOn(settings)}
    {position}
    {nearest}
    waypoints={waypointsPx}
    places={searchPlaces}
    {islepilotNote}
    showCursorCoords={settings?.map?.show_cursor_coords ?? false}
    {rulerActive}
    {rulerInfo}
    {pastTrails}
    {shownPast}
    {replayName}
    {questList}
    {pinnedQuest}
    {pinnedZone}
    hiddenGroups={settings?.hidden_waypoint_groups ?? []}
    lc={LC}
    {teamActive}
    onshare={(wp) => void teamShareWaypoint(wp.name, wp.x, wp.y)}
    ontoggle={onToggleLayer}
    ontogglezonelabels={onToggleZoneLabels}
    onrename={onRename}
    ondelete={onDelete}
    onfocus={focusWaypoint}
    oncleartrail={() => void onClearTrail()}
    onsetcolor={(wp, color) => void onSetColor(wp, color)}
    onsetgroup={(id, group) => void onSetGroup(id, group)}
    ontogglegroup={(name) => void onToggleGroup(name)}
    onexport={() => void onExportWaypoints()}
    onimport={() => void onImportWaypoints()}
    onlocate={locatePx}
    onsearchcoords={onSearchCoords}
    ontoggleruler={toggleRuler}
    onclearruler={clearRuler}
    ontogglecursorcoords={(v) => void setCursorCoords(v)}
    ontogglepast={(name) => void togglePastTrail(name)}
    onreplay={(name) => void startReplay(name)}
    onpinquest={(i) => void pinQuest(i)}
    onunpinquest={unpinQuest}
    showExplored={settings?.layers?.explored ?? false}
    ontoggleexplored={(v) => void toggleExplored(v)}
    onresetexplored={() => void onResetExplored()}
    {routeMode}
    {routeInfo}
    {routes}
    {loadedRouteId}
    ontoggleroute={toggleRoute}
    onclearroute={clearRoute}
    onsaveroute={saveCurrentRoute}
    onloadroute={(rt) => void loadRoute(rt)}
    ondeleteroute={(id) => void deleteRouteFn(id)}
  />
</div>

<NamePrompt
  open={promptOpen}
  title={tNow("wp.new")}
  label={tNow("wp.name_prompt")}
  presets={WAYPOINT_GLYPHS}
  onconfirm={confirmPrompt}
  oncancel={() => {
    promptOpen = false;
    pendingPixel = null;
  }}
/>

<NamePrompt
  open={routeNameOpen}
  title={tNow("route.save")}
  label={tNow("route.name_prompt")}
  presets={[]}
  onconfirm={(name) => void confirmRouteName(name)}
  oncancel={() => (routeNameOpen = false)}
/>

<style>
  :global(.leaflet-container) {
    background: var(--color-bg);
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  :global(.leaflet-tooltip) {
    background: var(--color-panel);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  :global(.leaflet-tooltip-top:before),
  :global(.leaflet-tooltip-bottom:before),
  :global(.leaflet-tooltip-left:before),
  :global(.leaflet-tooltip-right:before) {
    border-top-color: var(--color-border);
  }
  :global(.leaflet-bar a) {
    background: var(--color-panel);
    color: var(--color-text);
    border-bottom: 1px solid var(--color-border);
  }
  :global(.leaflet-bar a:hover) {
    background: var(--color-bg);
  }

  /* Text-label layers (region/landmark names). The dark 1px shadow makes
     text readable over bright terrain without any outline box — same trick
     as the minimap compass letters. */
  :global(.map-label) {
    width: max-content !important;
    height: auto !important;
    margin: 0 !important;
    transform: translate(-50%, -50%);
    white-space: nowrap;
    pointer-events: none;
    text-shadow:
      1px 1px 2px rgba(0, 0, 0, 0.9),
      -1px -1px 2px rgba(0, 0, 0, 0.7);
    font-family: "Segoe UI", system-ui, sans-serif;
  }
  :global(.map-label--region) {
    color: #eae6d6;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  :global(.map-label--landmark) {
    color: #cfc9b3;
    font-size: 11.5px;
    font-weight: 500;
  }
  :global(.map-label--landmark)::before {
    content: "";
    display: inline-block;
    width: 5px;
    height: 5px;
    margin-right: 4px;
    margin-bottom: 1px;
    border-radius: 50%;
    background: #cfc9b3;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.9);
  }

  /* Edge arrow + recenter: the way back to your position after panning away. */
  .edge-arrow {
    position: absolute;
    z-index: 1000;
    cursor: pointer;
    font-size: 22px;
    line-height: 1;
    color: var(--color-accent);
    text-shadow:
      0 0 3px rgba(0, 0, 0, 0.95),
      0 0 8px rgba(0, 0, 0, 0.6);
    background: none;
    border: none;
    padding: 4px;
  }
  .recenter-btn {
    position: absolute;
    left: 10px;
    bottom: 10px;
    z-index: 1000;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
    background: var(--color-panel);
    color: var(--color-text);
  }
  .recenter-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  /* Live game-coord readout under the cursor (F3). */
  .cursor-coords {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 1000;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-panel) 88%, transparent);
    color: var(--color-text);
    font-family: "Segoe UI Mono", ui-monospace, monospace;
    font-size: 11px;
    pointer-events: none;
  }

  /* Session replay scrubber (A6): a floating transport bar along the bottom
     of the map, only mounted while a replay is loaded. */
  .replay-bar {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    z-index: 1200;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: min(560px, calc(100% - 24px));
    padding: 7px 10px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-panel) 94%, transparent);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }
  .replay-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* A6 stat overlay: growth-era HP / hunger / thirst under the scrubber. */
  .replay-stats {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--color-border);
  }
  .rs-plot {
    width: 100%;
    height: 34px;
    display: block;
    overflow: visible;
  }
  .rs-grid {
    stroke: var(--color-border);
    stroke-width: 0.5;
    vector-effect: non-scaling-stroke;
  }
  .rs-line {
    fill: none;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .rs-hp {
    stroke: #d9604a;
    color: #d9604a;
  }
  .rs-hunger {
    stroke: #e3a63c;
    color: #e3a63c;
  }
  .rs-thirst {
    stroke: #5cd6bf;
    color: #5cd6bf;
  }
  .rs-cursor {
    stroke: var(--color-text);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.7;
  }
  .rs-read {
    display: flex;
    gap: 10px;
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }
  .rs-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .rs-tag::before {
    content: "";
    width: 8px;
    height: 2px;
    background: currentColor;
  }
  .replay-btn {
    flex: none;
    cursor: pointer;
    min-width: 30px;
    height: 26px;
    padding: 0 7px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 12px;
    line-height: 1;
  }
  .replay-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .replay-btn--primary {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .replay-track {
    flex: 1 1 auto;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .replay-track input[type="range"] {
    width: 100%;
    accent-color: var(--color-accent);
    cursor: pointer;
  }
  .replay-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    color: var(--color-muted);
  }
  .replay-time {
    font-family: "Segoe UI Mono", ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }
  .replay-cap {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* One-shot locate pulse (removed by timeout — nothing loops). */
  :global(.locate-pulse) {
    border: 2px solid var(--color-accent);
    border-radius: 50%;
    animation: locate-pulse 0.85s ease-out 3;
  }
  @keyframes locate-pulse {
    0% {
      transform: scale(0.5);
      opacity: 1;
    }
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  /* Per-species animal markers: an emoji glyph instead of a dot. The drop
     shadow separates it from bright terrain; no box, no border. */
  :global(.animal-glyph) {
    font-size: 14px;
    line-height: 18px;
    text-align: center;
    filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.8));
    background: none;
    border: none;
  }

  /* Waypoints named with a preset icon: the icon IS the marker — slightly
     larger than animal glyphs because it is the user's own pin. */
  :global(.wp-glyph) {
    font-size: 17px;
    line-height: 22px;
    text-align: center;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85));
    background: none;
    border: none;
  }

  /* Self-marker: the INNER element rotates (Leaflet owns the outer icon's
     transform for positioning); .no-heading swaps the dart for the disc. */
  :global(.player-arrow) {
    pointer-events: none;
  }
  :global(.player-arrow-inner) {
    width: 28px;
    height: 28px;
    transform-origin: 50% 50%;
  }
  :global(.player-arrow-inner .glyph-dot) {
    display: none;
  }
  :global(.player-arrow-inner.no-heading .glyph-arrow) {
    display: none;
  }
  :global(.player-arrow-inner.no-heading .glyph-dot) {
    display: block;
  }

  /* Numbered route nodes. */
  :global(.route-node) {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4fc3f7;
    color: #06263a;
    font: 600 10px/1 "Segoe UI", sans-serif;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
  }

  /* Party member name tags: small pink label, no bubble. */
  :global(.leaflet-tooltip.party-label) {
    background: transparent;
    border: none;
    box-shadow: none;
    color: #ff7bd0;
    font-size: 10.5px;
    font-weight: 600;
    text-shadow:
      1px 1px 2px rgba(0, 0, 0, 0.95),
      -1px -1px 2px rgba(0, 0, 0, 0.75);
    pointer-events: none;
  }
  :global(.leaflet-tooltip.party-label)::before {
    display: none;
  }

  /* Zone name labels: plain colour-matched text, no tooltip bubble. */
  :global(.leaflet-tooltip.zone-label) {
    background: transparent;
    border: none;
    box-shadow: none;
    font-size: 11.5px;
    font-weight: 600;
    text-shadow:
      1px 1px 2px rgba(0, 0, 0, 0.9),
      -1px -1px 2px rgba(0, 0, 0, 0.7);
    pointer-events: none;
  }
  :global(.leaflet-tooltip.zone-label)::before {
    display: none;
  }
</style>
