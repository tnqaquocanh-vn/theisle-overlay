// The single typed IPC surface. Mirrors src-tauri/src/commands.rs and
// events.rs — if a shape changes there, it changes here.

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ---------------------------------------------------------------- events ---

/** Which basemap imagery is rendered. One key per calibration-frame x style. */
export type BasemapSource = "vulnona" | "islemaps_light" | "islemaps_dark";

export interface PositionUpdate {
  xCm: number;
  yCm: number;
  zCm: number;
  px: number;
  py: number;
  headingDeg: number | null;
  compassKey: string | null;
  inBounds: boolean;
}

export interface TrailPayload {
  segmentsCm: [number, number][][];
  segmentsPx: [number, number][][];
}

/** A locally-saved dino colour scheme (skin editor). `palette` holds the 10
 *  DinoPalette channels as `#rrggbb` — kept as an open map here so api.ts
 *  stays free of the dino3d module. */
export interface SkinPreset {
  id: string;
  name: string;
  species: string;
  palette: Record<string, string>;
  created: string;
}

export type Settings = Record<string, unknown> & {
  minimap: {
    visible: boolean;
    require_game: boolean;
    corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    size_px: number;
    margin_px: number;
    opacity: number;
    radius_m: number;
    /** G8: uniform HUD scale, 0.65–1.75. */
    hud_scale: number;
    /** Decode resolution (px) of the disc's basemap: 975 (tier 1) – 3900 (tier 3). */
    basemap_px: number;
    click_through: boolean;
    show_trail: boolean;
    show_waypoints: boolean;
    rotate_with_heading: boolean;
    /** G6: teammate HP/hunger/thirst strip on the in-game minimap. */
    show_team_panel: boolean;
    /** G7: Alt+wheel zoom / Alt+middle-click show-hide (opt-in). */
    mouse_gestures: boolean;
    /** P6: drop a "last seen" waypoint when the position signal drops. */
    last_seen_beacon: boolean;
    /** P1: ease the marker between samples instead of teleporting. */
    smooth_motion: boolean;
    /** A4: auto-apply the preset named after your species on a swap (supporter). */
    auto_preset?: boolean;
    /** v1.26: render-ms / repaint-rate readout on the disc (supporter). */
    diagnostics?: boolean;
  };
  /** G1: automatic own-position from passive UDP capture (opt-in, default off). */
  localpos: { enabled: boolean };
  /** G6: ad-hoc team relay — the user's own deployed worker base URL. */
  team: { relay_base: string };
  /** P5: named overlay-look snapshots. */
  presets: { name: string }[];
  hotkeys: Record<string, string>;
  layers: Record<string, boolean>;
  map: { zone_labels: boolean; basemap: BasemapSource; show_cursor_coords: boolean };
  trail: {
    enabled: boolean;
    break_after_minutes: number;
    break_after_metres: number;
    min_node_distance_m: number;
  };
  number_format: "auto" | "us" | "eu";
  language: "vi" | "en" | "pt";
  /** Map layer palette: "deuteranopia" swaps the green/red-confusable hues. */
  color_profile: "default" | "deuteranopia";
  /** Waypoint folders currently hidden on the maps. */
  hidden_waypoint_groups: string[];
  telemetry: { enabled: boolean };
  /** A10: opt-in HUD sound cues. */
  sound?: { enabled: boolean };
  /** In-app auto-update: check the release feed once on startup. */
  updates?: { auto_check: boolean };
  /** A7 second-monitor companion: remembered geometry + compact (map-less) mode. */
  companion?: { w: number; h: number; x: number | null; y: number | null; compact: boolean };
  /** Skin editor: locally-saved dino colour presets. */
  skin_presets?: SkinPreset[];
  islepilot: {
    enabled: boolean;
    /** "token" = one Steam login for every server; "legacy" = per-server cookie. */
    auth_mode: "token" | "legacy";
    domain: string;
    poll_interval_s: number;
    /** Token mode: also run the wss://islepilot.eu/ows realtime socket (G5). */
    realtime: boolean;
    use_map_position: boolean;
    map_pref_user_set: boolean;
    show_overlay_panel: boolean;
    show_quests_panel: boolean;
    /** Show other players' live-map positions (opt-in, cookie mode only). */
    show_party: boolean;
    /** Log stat samples for the Your Dino charts. */
    history_enabled: boolean;
    /** History retention window in days, pruned at startup. */
    history_days: number;
    /** A5: drop + share a 💀 waypoint at the last position when the dino dies. */
    death_marker?: boolean;
    /** Threshold desktop notifications (opt-in). A *_pct of 0 disables that rule. */
    alerts: {
      enabled: boolean;
      thirst_pct: number;
      hunger_pct: number;
      hp_pct: number;
      prime_ready: boolean;
      growth_milestones: boolean;
    };
  };
};

export const onPositionUpdate = (
  cb: (p: PositionUpdate) => void,
): Promise<UnlistenFn> => listen<PositionUpdate>("position://update", (e) => cb(e.payload));

export const onTrailChanged = (
  cb: (t: TrailPayload) => void,
): Promise<UnlistenFn> => listen<TrailPayload>("trail://changed", (e) => cb(e.payload));

export const onSettingsChanged = (
  cb: (s: Settings) => void,
): Promise<UnlistenFn> => listen<Settings>("settings://changed", (e) => cb(e.payload));

export const onWaypointsChanged = (cb: () => void): Promise<UnlistenFn> =>
  listen("waypoints://changed", () => cb());

/**
 * Await-safe listener collection. The old pattern — pushing awaited unlisten
 * fns into an array the cleanup closes over — leaked every listener whose
 * `listen()` resolved after the component unmounted (fast tab switching).
 */
export function listenerBag() {
  let disposed = false;
  const fns: UnlistenFn[] = [];
  return {
    async add(p: Promise<UnlistenFn>): Promise<void> {
      const unlisten = await p;
      if (disposed) unlisten();
      else fns.push(unlisten);
    },
    dispose(): void {
      disposed = true;
      for (const fn of fns) fn();
      fns.length = 0;
    },
  };
}

export interface FailedHotkey {
  action: string;
  spec: string;
}

export const onHotkeyFailed = (
  cb: (failed: FailedHotkey[]) => void,
): Promise<UnlistenFn> => listen<FailedHotkey[]>("hotkey://failed", (e) => cb(e.payload));

/** The full-map hotkey just SHOWED the window — switch to the map tab. */
export const onFullmapShow = (cb: () => void): Promise<UnlistenFn> =>
  listen("fullmap://show", () => cb());

// -------------------------------------------------------------- commands ---

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string | null;
  created: string | null;
  /** Folder/group name (absent = ungrouped). */
  group?: string | null;
}

export interface DataStatus {
  basemapMinimap: boolean;
  basemapFullmap: boolean;
  pois: boolean;
}

export const getSettings = () => invoke<Settings>("get_settings");
export const patchSettings = (patch: object) =>
  invoke<Settings>("patch_settings", { patch });

/** G1 (auto-position via packet capture): is Npcap installed and usable? */
export interface NpcapStatus {
  available: boolean;
  detail: string | null;
  downloadUrl: string;
}
export const getLocalposStatus = () => invoke<NpcapStatus>("localpos_status");

/** G6 ad-hoc team relay state. */
export interface TeamMember {
  name: string;
  online: boolean;
  isSelf: boolean;
  hp: number | null;
  hunger: number | null;
  thirst: number | null;
  species: string | null;
  server: string | null;
}
export interface TeamStatus {
  active: boolean;
  connected: boolean;
  code: string;
  name: string;
  members: number;
  error: string | null;
  roster: TeamMember[];
}
export const teamCreate = (name: string) => invoke<TeamStatus>("team_create", { name });
export const teamJoin = (code: string, name: string) =>
  invoke<TeamStatus>("team_join", { code, name });
export const teamLeave = () => invoke<void>("team_leave");
export const teamStatus = () => invoke<TeamStatus>("team_status");
/** P5 overlay-look presets. */
export const savePreset = (name: string) => invoke<Settings>("save_preset", { name });
export const applyPreset = (name: string) => invoke<Settings>("apply_preset", { name });
export const deletePreset = (name: string) => invoke<Settings>("delete_preset", { name });
/** P4: push a waypoint (world cm) to the whole team. */
export const teamShareWaypoint = (name: string, xCm: number, yCm: number) =>
  invoke<void>("team_share_waypoint", { name, xCm, yCm });
/** P4: a waypoint was shared (added locally already); `own` = you shared it. */
export interface TeamWaypointEvent {
  from: string;
  name: string;
  own: boolean;
}
export const onTeamWaypoint = (cb: (e: TeamWaypointEvent) => void): Promise<UnlistenFn> =>
  listen<TeamWaypointEvent>("team://waypoint", (e) => cb(e.payload));
export const onTeamStatus = (cb: (s: TeamStatus) => void): Promise<UnlistenFn> =>
  listen<TeamStatus>("team://status", (e) => cb(e.payload));

/** P3: a teammate (or you) dropped a contact ping. */
export interface TeamMark {
  from: string;
  xCm: number;
  yCm: number;
  px: number;
  py: number;
}
export const onTeamMark = (cb: (m: TeamMark) => void): Promise<UnlistenFn> =>
  listen<TeamMark>("team://mark", (e) => cb(e.payload));

/** Last known position (null before the first sample) — for initial paint. */
export const getCurrentPosition = () =>
  invoke<PositionUpdate | null>("get_current_position");

export type WaypointPx = Waypoint & { px: number; py: number };

export const listWaypoints = () => invoke<Waypoint[]>("list_waypoints");
export const listWaypointsPx = () => invoke<WaypointPx[]>("list_waypoints_px");
export const addWaypointAtPixel = (px: number, py: number, name: string) =>
  invoke<Waypoint>("add_waypoint_at_pixel", { px, py, name });
export const addWaypointHere = (name: string) =>
  invoke<Waypoint | null>("add_waypoint_here", { name });
export const renameWaypoint = (id: string, name: string) =>
  invoke<boolean>("rename_waypoint", { id, name });
export const setWaypointColor = (id: string, color: string | null) =>
  invoke<boolean>("set_waypoint_color", { id, color });
export const setWaypointGroup = (id: string, group: string | null) =>
  invoke<boolean>("set_waypoint_group", { id, group });

export interface ImportResult {
  added: number;
  skipped: number;
}

/** Write the selected waypoints (empty ids = all) to a shareable JSON file. */
export const exportWaypoints = (path: string, ids: string[]) =>
  invoke<number>("export_waypoints", { path, ids });
/** Merge a shared waypoint file; points within 1 m of an existing one are skipped. */
export const importWaypoints = (path: string) =>
  invoke<ImportResult>("import_waypoints", { path });
export const deleteWaypoint = (id: string) =>
  invoke<boolean>("delete_waypoint", { id });

export interface ResolvedCoords {
  xCm: number;
  yCm: number;
  px: number;
  py: number;
  inBounds: boolean;
}

/**
 * Parse a MANUALLY pasted coordinate string into world cm + active-basemap
 * px — same Rust parser and number format as the clipboard path.
 */
export const resolveCoordinates = (text: string) =>
  invoke<ResolvedCoords | null>("resolve_coordinates", { text });

export interface PixelCoords {
  xCm: number;
  yCm: number;
  inBounds: boolean;
}

/** Game coords under a full-map pixel — the cursor readout. */
export const pixelToCoords = (px: number, py: number) =>
  invoke<PixelCoords>("pixel_to_coords", { px, py });

export interface MeasureResult {
  legsM: number[];
  totalM: number;
  bearingDeg: number | null;
  compassKey: string | null;
  pointsCm: [number, number][];
}

/** Ruler: full-map pixels in, per-leg + total distance (m) and first→last bearing. */
export const measure = (pointsPx: [number, number][]) =>
  invoke<MeasureResult>("measure", { pointsPx });

// -- fog of war (F9) --

export interface ExploredRender {
  /** [left, top, right, bottom] in active-basemap px, one per visited cell. */
  cells: [number, number, number, number][];
}
export const getExplored = () => invoke<ExploredRender>("get_explored");
export const resetExplored = () => invoke<void>("reset_explored");
export const onExploredChanged = (cb: () => void): Promise<UnlistenFn> =>
  listen("explored://changed", () => cb());

// -- saved routes (F11) --

export interface Route {
  id: string;
  name: string;
  /** Ordered points, game cm. */
  points: [number, number][];
}
export const listRoutes = () => invoke<Route[]>("list_routes");
export const saveRoute = (name: string, points: [number, number][]) =>
  invoke<Route>("save_route", { name, points });
export const deleteRoute = (id: string) => invoke<boolean>("delete_route", { id });
/** Project game-cm points to active-basemap px (for drawing a loaded route). */
export const worldPointsToPx = (points: [number, number][]) =>
  invoke<[number, number][]>("world_points_to_px", { points });

export const getPreviousTrail = () => invoke<TrailPayload>("get_previous_trail");
export const getCurrentTrail = () => invoke<TrailPayload>("get_current_trail");

export interface TrailFile {
  /** Bare file name — the key passed back to getTrailFile. */
  name: string;
  /** "2026-08-27 22:56" from the filename stamp. */
  label: string;
  points: number;
}

/** Past-session trail files, newest first. */
export const listTrails = () => invoke<TrailFile[]>("list_trails");
/** One named past-session trail, projected to the active basemap. */
export const getTrailFile = (name: string) =>
  invoke<TrailPayload>("get_trail_file", { name });

/** One replay point: basemap px + a compressed playback-clock offset (ms). */
export interface ReplayPoint {
  px: number;
  py: number;
  clockMs: number;
  /** Wall-clock epoch ms of this sample — aligns playback with the stats history. */
  realMs: number;
}

/** One stats-history sample under a past session (A6 replay overlay). */
export interface TrailStatPoint {
  /** unix seconds */
  t: number;
  growthPct: number | null;
  healthPct: number | null;
  hungerPct: number | null;
  thirstPct: number | null;
  staminaPct: number | null;
  primeDone: number | null;
  primeTotal: number | null;
}

/** A past session ready for the replay scrubber (A6). */
export interface TrailReplay {
  points: ReplayPoint[];
  /** Indices in `points` the marker teleports to (a break or a squeezed idle). */
  gaps: number[];
  /** Total playback length in ms. */
  durationMs: number;
  /** ISO stamp of the first sample, for a caption (null on an unparseable file). */
  startedIso: string | null;
}

/** A past session projected + time-stamped for replay. */
export const getTrailReplay = (name: string) =>
  invoke<TrailReplay>("get_trail_replay", { name });

/** Stats-history samples inside a past session's wall-clock span (A6 overlay).
 *  Empty when history tracking is off or the session predates it. */
export const getTrailStats = (startMs: number, endMs: number) =>
  invoke<TrailStatPoint[]>("get_trail_stats", { startMs, endMs });

/** Write a past session to `path` as GeoJSON (migration path). Returns points written. */
export const exportTrailGeojson = (path: string, name: string) =>
  invoke<number>("export_trail_geojson", { path, name });

/**
 * Declutter: reset the in-memory trail (both windows repaint via
 * trail://changed) and hide the previous session's dimmed trail. Files on
 * disk keep the full history.
 */
export const clearTrail = () => invoke("clear_trail");

export const getDataStatus = () => invoke<DataStatus>("data_status");

/** Days since the map data was last downloaded (null = never). */
export const getDataAgeDays = () => invoke<number | null>("data_age_days");

/** Kick off the (re-)download; watch fetch:// events for progress/result. */
export const startFetchData = (force: boolean) => invoke("fetch_data", { force });

export interface FetchProgress {
  file: string;
  index: number;
  total: number;
  status: "downloading" | "done" | "skipped" | "error";
  error: string | null;
}

export interface FetchFinished {
  ok: boolean;
  basemapOk: boolean;
  poisOk: boolean;
  error: string | null;
}

export const onFetchProgress = (
  cb: (p: FetchProgress) => void,
): Promise<UnlistenFn> => listen<FetchProgress>("fetch://progress", (e) => cb(e.payload));

export const onFetchFinished = (
  cb: (f: FetchFinished) => void,
): Promise<UnlistenFn> => listen<FetchFinished>("fetch://finished", (e) => cb(e.payload));
export const getFullscreenMode = () => invoke<number | null>("get_fullscreen_mode");

/** POI layer data, shape produced by fetch_data (px precomputed at fetch). */
export const getPois = () => invoke<unknown>("get_pois");

export interface PoiItem {
  label: string;
  px: number;
  py: number;
  xCm: number;
  yCm: number;
  radiusPx?: number;
  pointsPx?: [number, number][];
  /** Zones: name-label anchor (polygon centroid / circle centre). */
  labelPx?: number;
  labelPy?: number;
}

export interface PoiLayer {
  key: string;
  kind: "point" | "zone" | "label";
  items: PoiItem[];
}

/** POI layers with all coordinates precomputed to basemap pixels by Rust. */
export const getPoisRender = () => invoke<PoiLayer[]>("get_pois_render");

export interface NearestWaypoint {
  id: string;
  name: string;
  bearingDeg: number;
  compassKey: string;
  distanceM: number;
}

export const getNearestWaypoint = () =>
  invoke<NearestWaypoint | null>("nearest_waypoint");

// -- Prime quest <-> map (F4) --

export interface QuestTarget {
  /** pois_gateway.json layer key. */
  layerKey: string;
  count: number;
}

export interface QuestTargetOut {
  index: number;
  text: string;
  textVi?: string | null;
  completed: boolean;
  /** The POI layer this quest points at, if any. */
  target?: QuestTarget | null;
}

/** Prime quests of the latest IslePilot update, tagged with their POI layer. */
export const questTargets = () => invoke<QuestTargetOut[]>("quest_targets");

export interface NearestZone {
  name: string;
  bearingDeg: number;
  compassKey: string;
  distanceM: number;
  px: number;
  py: number;
}

/** Closest item of a POI layer to the current position. */
export const nearestZone = (layerKey: string) =>
  invoke<NearestZone | null>("nearest_zone", { layerKey });

/** True when the spec parses AND the combination is currently free. */
export const checkHotkeyAvailable = (spec: string) =>
  invoke<boolean>("check_hotkey_available", { spec });

/** Re-register all hotkeys from the current settings (after a rebind). */
export const applyHotkeys = () => invoke("apply_hotkeys");

export interface BasemapUrls {
  minimap: string;
  fullmap: string;
  source: BasemapSource;
  /** Decode-time downscale hint for the minimap (set for islemaps PNGs). */
  minimapDecodeWidth: number | null;
}

export async function getBasemapUrls(): Promise<BasemapUrls> {
  const paths = await invoke<BasemapUrls>("get_basemap_paths");
  return {
    ...paths,
    minimap: convertFileSrc(paths.minimap),
    fullmap: convertFileSrc(paths.fullmap),
  };
}

export interface OverlayRender {
  /** Doubles as the layers.* visibility key. */
  key: string;
  /** Ready-to-use asset URL (already through convertFileSrc). */
  url: string;
  /** [left, top, right, bottom] in ACTIVE-calibration basemap px. */
  boundsPx: [number, number, number, number];
}

export interface MapInfo {
  imageWidthPx: number;
  imageHeightPx: number;
  /** Basemap pixels per real-world metre, horizontal / vertical. */
  pxPerMX: number;
  pxPerMY: number;
  source: BasemapSource;
  /** Image overlays present on disk, re-projected to the active basemap. */
  overlays: OverlayRender[];
}

/** Geometry of the ACTIVE basemap — the frontend holds no transform of its own. */
export async function getMapInfo(): Promise<MapInfo> {
  const info = await invoke<Omit<MapInfo, "overlays"> & {
    overlays: { key: string; path: string; boundsPx: [number, number, number, number] }[];
  }>("get_map_info");
  return {
    ...info,
    overlays: info.overlays.map((o) => ({
      key: o.key,
      url: convertFileSrc(o.path),
      boundsPx: o.boundsPx,
    })),
  };
}

/**
 * Switch basemap imagery. Downloads the islemaps PNG on first selection
 * (rejects offline, settings untouched); on success settings are patched
 * (broadcast to every window) and position/trail are resynced.
 */
export const setBasemapSource = (source: BasemapSource) =>
  invoke("set_basemap_source", { source });

// ----------------------------------------------------- "your dino" (IslePilot) ---

export interface DinoStatBar {
  raw: string;
  current: number | null;
  max: number | null;
}

export interface DinoQuest {
  text: string;
  /** Vietnamese translation from the backend; absent when untranslated. */
  textVi?: string | null;
  completed: boolean;
}

export interface DinoNutrition {
  carb: number;
  protein: number;
  lipid: number;
}

export interface DinoPlayer {
  dinoName: string | null;
  online: boolean | null;
  growth: string | null;
  growthPct: number | null;
  health: DinoStatBar | null;
  hunger: DinoStatBar | null;
  thirst: DinoStatBar | null;
  primeQuests: DinoQuest[];
  // Extras only the token-mode JSON API provides (absent in cookie mode).
  stamina?: DinoStatBar | null;
  nutrition?: DinoNutrition | null;
  server?: string | null;
  female?: boolean | null;
  /** Prime eligibility — token mode only; absent in cookie mode. */
  primeEligible?: boolean | null;
}

export interface DinoMap {
  mapDisabled: boolean;
  x: number | null;
  y: number | null;
  headingDeg: number | null;
  viewBox: [number, number, number, number] | null;
  pctX: number | null;
  pctY: number | null;
}

export interface DinoUpdate {
  domain: string;
  fetchedAtMs: number;
  player: DinoPlayer | null;
  map: DinoMap | null;
  layoutChanged: boolean;
  /** Whether the server runs a live map at all; null until probed. */
  liveMapAvailable: boolean | null;
  error: string | null;
}

export interface IslepilotState {
  loggedIn: boolean;
  authMode: "token" | "legacy";
  tokenPresent: boolean;
  lastUpdate: DinoUpdate | null;
}

export const islepilotLogin = (domain: string) =>
  invoke("islepilot_login", { domain });
/** Manual fallback: validate + store a pasted Cookie header. */
export const islepilotSetCookie = (domain: string, cookie: string) =>
  invoke("islepilot_set_cookie", { domain, cookie });
/** Token mode: one Steam login, works on every IslePilot server. */
export const islepilotTokenLogin = () => invoke("islepilot_token_login");
/** Manual fallback for token mode: paste the overlay token (or redirect URL). */
export const islepilotSetToken = (token: string) =>
  invoke("islepilot_set_token", { token });
export const islepilotCancelLogin = () => invoke("islepilot_cancel_login");

// -- token-mode extras: overlay-map POIs + garage (gacha) --

export interface IslepilotPoiCategory {
  id: string;
  name: string;
  color: string | null;
}

export interface IslepilotPoi {
  id: string;
  name: string | null;
  categoryId: string | null;
  color: string | null;
  shape: string | null;
  /** Render pixels on the ACTIVE basemap, one per source point. */
  pointsPx: [number, number][];
}

export interface IslepilotOverlayMap {
  available: boolean;
  /** "not-logged-in" | "disabled" | "discord" | "empty" when unavailable. */
  reason: string | null;
  categories: IslepilotPoiCategory[];
  pois: IslepilotPoi[];
}

/** IslePilot POIs for the full map (token mode; Rust caches ~15 s). */
export const islepilotOverlayMap = () =>
  invoke<IslepilotOverlayMap>("islepilot_overlay_map");

/**
 * Download-and-cache a skinviewer CDN asset (3D model / texture) via Rust
 * (the CDN sends no CORS headers); resolves to a local path for
 * convertFileSrc.
 */
export const islepilotCdnAsset = (url: string, force = false) =>
  invoke<string>("islepilot_cdn_asset", { url, force });

export interface CdnProgress {
  url: string;
  received: number;
  /** 0 when the server sent no Content-Length. */
  total: number;
}

/** Download progress of skinviewer CDN assets (only fires for cache misses). */
export const onCdnProgress = (
  cb: (p: CdnProgress) => void,
): Promise<UnlistenFn> => listen<CdnProgress>("cdn://progress", (e) => cb(e.payload));

/** Fetch a cached CDN asset as raw bytes (through the asset protocol).
 *  `force` re-downloads past a cache hit — pass it on a decode-failure retry. */
export async function fetchCdnAsset(url: string, force = false): Promise<ArrayBuffer> {
  const path = await islepilotCdnAsset(url, force);
  const resp = await fetch(convertFileSrc(path));
  if (!resp.ok) throw new Error(`asset fetch failed: ${resp.status}`);
  return resp.arrayBuffer();
}

/** Parked-dino record — backend shape, read defensively in the UI. */
export type GarageDino = Record<string, unknown> & { id?: string };

export interface GarageState {
  dinos: GarageDino[];
  sellingEnabled: boolean;
  liveSwap: boolean;
  /** Server allows the "Slay" (kill your current dino) action. */
  selfSlayEnabled: boolean;
  currencyName: string | null;
}

export const islepilotGarage = () => invoke<GarageState>("islepilot_garage");
/** Park the CURRENT dino (blocks through the server's async command, ~60 s max). */
export const islepilotGaragePark = () => invoke("islepilot_garage_park");
export const islepilotGarageRestore = (id: string) =>
  invoke("islepilot_garage_restore", { id });
export const islepilotGarageSell = (id: string) =>
  invoke("islepilot_garage_sell", { id });
export const islepilotGarageRename = (id: string, name: string) =>
  invoke("islepilot_garage_rename", { id, name });
/** Slay (kill) the current in-game dino. Server-gated by selfSlayEnabled. */
export const islepilotGarageSlay = () => invoke("islepilot_garage_slay");
export const islepilotLogout = () => invoke("islepilot_logout");
export const islepilotApply = () => invoke("islepilot_apply");
export const islepilotState = () => invoke<IslepilotState>("islepilot_state");

// -- skin editor: IslePilot "apply live on your dino" (opt-in) --

/** A skin preset stored on IslePilot — `state` is an `{skin_body_r: 0.4, …}` RGB-float map. */
export interface ServerSkinPreset {
  id: string;
  name: string;
  state: Record<string, number>;
}
export const islepilotSkin = () =>
  invoke<{ presets?: ServerSkinPreset[]; enabled?: boolean }>("islepilot_skin");
export const islepilotSkinPreset = (body: object) =>
  invoke<{ id?: string; error?: string }>("islepilot_skin_preset", { body });
/** Broadcast a live skin state on the realtime socket. */
export const sendLiveSkin = (state: Record<string, number>) =>
  invoke("islepilot_send_liveskin", { state });
/** The account's live skin changed (2-way sync — usually from another client). */
export const onDinoSkin = (cb: (skin: Record<string, number>) => void): Promise<UnlistenFn> =>
  listen<Record<string, number>>("dino://skin", (e) => cb(e.payload));

// -- local stat history (Your Dino charts) --

export interface DinoHistPoint {
  /** unix seconds */
  t: number;
  growthPct: number | null;
  healthPct: number | null;
  hungerPct: number | null;
  thirstPct: number | null;
  staminaPct: number | null;
  primeDone: number | null;
  primeTotal: number | null;
}

export interface DinoHistory {
  points: DinoHistPoint[];
  /** Growth %-points per hour (least-squares over the current life). */
  growthRatePerH: number | null;
  /** Hours until growth reaches 100 at the current rate. */
  etaAdultH: number | null;
  /** Hunger / thirst %-points lost per hour (positive = draining). */
  hungerDrainPerH: number | null;
  thirstDrainPerH: number | null;
  hungerEmptyH: number | null;
  thirstEmptyH: number | null;
  /** Wall-clock span the shown segment covers, in hours. */
  spanH: number;
  /** Records in the whole file. */
  totalRecords: number;
}

/** Stat time-series for the current dino/life. `rangeHours <= 0` = everything. */
export const dinoHistory = (rangeHours: number) =>
  invoke<DinoHistory>("dino_history", { rangeHours });

/** Wipe the local stat-history file. */
export const dinoHistoryClear = () => invoke<void>("dino_history_clear");

/** Fire a sample notification (the "Send test" button in alert settings). */
export const alertsTest = () => invoke<void>("alerts_test");

// ------------------------------------------------------- supporter license ---

/** Local supporter status. `tier` is "free" | "supporter"; `grace` is true
 *  while running on a stale-but-not-yet-expired cache. */
export interface LicenseStatus {
  tier: "free" | "supporter";
  grace: boolean;
  /** unix seconds of the last successful server validation (0 = never). */
  checkedAt: number;
  keyMasked: string | null;
  /** Set when the last activate/refresh attempt failed. */
  error: string | null;
}

/** Cached status only — no network. */
export const licenseStatus = () => invoke<LicenseStatus>("license_status");
/** Validate a pasted key against the server and, on success, store it. */
export const licenseActivate = (key: string) =>
  invoke<LicenseStatus>("license_activate", { key });
/** Re-check the stored key against the server. */
export const licenseRefresh = () => invoke<LicenseStatus>("license_refresh");
/** Forget the stored key (drops to free immediately). */
export const licenseClear = () => invoke<LicenseStatus>("license_clear");

/** An in-app purchase order — the app shows the QR and polls until paid. */
export interface LicenseOrder {
  code: string;
  amount: number;
  addInfo: string;
  ttlMin: number;
  bank: { bin: string; account: string; name: string };
  qrUrl: string;
  /** Set instead of the above when the server has no bank configured yet. */
  error?: "not_configured" | "rate" | "server" | string;
}
export interface LicenseOrderStatus {
  status: "pending" | "paid" | "expired" | "unknown";
  key: string | null;
}
/** Open a purchase order (VietQR + memo code). */
export const licenseOrderNew = () => invoke<LicenseOrder>("license_order_new");
/** Poll one order; on `"paid"` the caller activates `key`. */
export const licenseOrderPoll = (code: string) =>
  invoke<LicenseOrderStatus>("license_order_poll", { code });

/** Rust rejected a supporter-gated action; `feature` is a short slug. */
export const onSupporterRequired = (
  cb: (feature: string) => void,
): Promise<UnlistenFn> => listen<string>("license://required", (e) => cb(e.payload));

export interface PartyMarker {
  label: string;
  xCm: number;
  yCm: number;
  px: number;
  py: number;
  /** 0..100, or null (F7 server markers / stat missing). G6 relay fills these. */
  hp: number | null;
  hunger: number | null;
  thirst: number | null;
  heading: number | null;
}

/** Other players' live-map positions (empty list clears the pins). */
export const onPartyUpdate = (
  cb: (markers: PartyMarker[]) => void,
): Promise<UnlistenFn> => listen<PartyMarker[]>("party://update", (e) => cb(e.payload));

export const onDinoUpdate = (cb: (u: DinoUpdate) => void): Promise<UnlistenFn> =>
  listen<DinoUpdate>("dino://update", (e) => cb(e.payload));
export const onDinoAuthExpired = (cb: () => void): Promise<UnlistenFn> =>
  listen("dino://auth-expired", () => cb());
export const onDinoLoginOk = (cb: () => void): Promise<UnlistenFn> =>
  listen("dino://login-ok", () => cb());
export const onDinoLoginFailed = (
  cb: (reason: string) => void,
): Promise<UnlistenFn> => listen<string>("dino://login-failed", (e) => cb(e.payload));

/** Dev builds only. */
export const simulatePosition = (x: number, y: number, z: number) =>
  invoke("simulate_position", { x, y, z });

// ------------------------------------------------------------- telemetry ---

/**
 * Feature names the backend knows about. Mirrors `FEATURE_SLOTS` in
 * `src-tauri/src/telemetry/counters.rs` and `worker/src/features.ts`; a Rust
 * test fails if those two drift, and this union makes a typo here a compile
 * error rather than a silently uncounted feature.
 */
export type Feature =
  | "fullmap_open"
  | "minimap_toggle"
  | "waypoint_add"
  | "waypoint_delete"
  | "trail_view"
  | "layer_toggle"
  | "basemap_change"
  | "islepilot_login"
  | "islepilot_garage"
  | "dino_tab_open"
  | "guide_open"
  | "settings_open"
  | "hotkey_used"
  | "quests_open"
  | "coord_resolve"
  | "data_fetch"
  // Retired with the Donate tab. Slot kept (append-only) so later indices
  // and historical telemetry stay stable.
  | "donate_open"
  | "language_switch";

/**
 * Count one use of a feature. Cheap and fire-and-forget: Rust increments an
 * atomic and the total rides along on the next launch's single ping, so this
 * is safe to call from a click handler in a hot path.
 */
export const trackFeature = (name: Feature): void => {
  void invoke("track_feature", { name }).catch(() => {});
};

export type FeedbackCategory = "bug" | "idea" | "other";

/** Rejects with "unavailable" | "send_failed". */
export const submitFeedback = (
  category: FeedbackCategory,
  body: string,
  contact?: string,
) => invoke<void>("submit_feedback", { category, body, contact: contact || null });

/** Report a frontend error. Windows account names are stripped in Rust. */
export const submitCrash = (message: string, stack?: string): void => {
  void invoke("submit_crash", { message, stack: stack ?? null }).catch(() => {});
};
