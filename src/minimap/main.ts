// Minimap overlay entry. Deliberately tiny: no Skeleton, no Leaflet, no
// framework — this webview runs beside the game for hours. Rendering is
// event-driven only (zero idle CPU: no rAF loop, no animations, no timers).

import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { error } from "@tauri-apps/plugin-log";

// Amber HUD type: IBM Plex Sans/Mono for the canvas text (was Segoe UI). Same
// bundled woff2 the main window uses — Vite dedupes the assets, so this adds
// only the @font-face rules. No Fraunces: the HUD has no display type.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-ext-400.css";
import "@fontsource/ibm-plex-sans/vietnamese-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-ext-500.css";
import "@fontsource/ibm-plex-sans/vietnamese-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-ext-600.css";
import "@fontsource/ibm-plex-sans/vietnamese-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-sans/latin-ext-700.css";
import "@fontsource/ibm-plex-sans/vietnamese-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/vietnamese-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "@fontsource/ibm-plex-mono/vietnamese-500.css";
import { installGlobalErrorLog } from "../lib/errlog";
import { cue } from "./sound";
import { ANIMAL_GLYPHS, waypointGlyph } from "../lib/theme";
import { tokens, glideK } from "../lib/tokens";
import {
  isHudAnimating,
  PREDATOR_ALERT_MS,
  render,
  renderSafe,
  type DinoBars,
  type MinimapState,
  type PoiDot,
  type QuestRow,
  type TeamRow,
} from "./render";

installGlobalErrorLog("minimap");

// Local minimal types — this bundle stays free of the main window's modules.
interface PositionUpdate {
  xCm: number;
  yCm: number;
  px: number;
  py: number;
  headingDeg: number | null;
  compassKey: string | null;
}
interface PoiLayer {
  key: string;
  kind: string;
  items: { label: string; px: number; py: number; xCm: number; yCm: number }[];
}
type Settings = Record<string, any>;

const LAYER_COLORS: Record<string, string> = {
  water: "#4aa8d8",
  saltlick: "#d9a441",
  mudwallow: "#9c7b4f",
  sanctuary: "#a855f7",
  migration: "#72d653",
  food: "#e2664a",
  animal: "#d66ba0",
};

// Compass letters + strings per language (kept inline: no i18n bundle here).
const STRINGS = {
  vi: {
    letters: ["B", "Đ", "N", "T"] as [string, string, string, string],
    hint: "Trong game bấm Tab, rồi bấm “Asset Location” để chép tọa độ.",
    unknown: "Chưa rõ hướng",
    stale: "Mất tín hiệu vị trí",
    safe: "Chế độ an toàn",
    online: "ONLINE",
    offline: "NGOẠI TUYẾN",
    snapOk: "Đã chép bản đồ",
    snapErr: "Chép ảnh lỗi",
    nutri: {
      label: "DINH DƯỠNG",
      ok: "cân bằng",
      short: { carb: "CARB", protein: "ĐẠM", lipid: "BÉO" },
      herb: "ăn cây khác, đa dạng",
      hint: {
        carnCarb: "ăn phổi con mồi",
        carnProt: "ăn tim con mồi",
        carnLip: "ăn ruột con mồi",
        omniCarb: "cây đa dạng / phổi",
        omniProt: "thịt-tim / cây hạt",
        omniLip: "ruột / quả dầu",
      },
    },
    dirs: {
      "dir.N": "Bắc", "dir.NE": "Đông Bắc", "dir.E": "Đông", "dir.SE": "Đông Nam",
      "dir.S": "Nam", "dir.SW": "Tây Nam", "dir.W": "Tây", "dir.NW": "Tây Bắc",
    } as Record<string, string>,
  },
  en: {
    letters: ["N", "E", "S", "W"] as [string, string, string, string],
    hint: "In game press Tab, then click “Asset Location” to copy your coordinates.",
    unknown: "Heading unknown",
    stale: "Position signal lost",
    safe: "Safe mode",
    online: "ONLINE",
    offline: "OFFLINE",
    snapOk: "Map copied",
    snapErr: "Copy failed",
    nutri: {
      label: "NUTRITION",
      ok: "balanced",
      short: { carb: "CARB", protein: "PROT", lipid: "LIP" },
      herb: "vary your plants",
      hint: {
        carnCarb: "eat prey lungs",
        carnProt: "eat prey heart",
        carnLip: "eat prey intestines",
        omniCarb: "varied plants / lungs",
        omniProt: "meat-heart / seeds",
        omniLip: "intestines / oily fruit",
      },
    },
    dirs: {
      "dir.N": "N", "dir.NE": "NE", "dir.E": "E", "dir.SE": "SE",
      "dir.S": "S", "dir.SW": "SW", "dir.W": "W", "dir.NW": "NW",
    } as Record<string, string>,
  },
};

const canvas = document.getElementById("minimap") as HTMLCanvasElement;

let allPois: PoiDot[] = [];
let poiLayers: PoiLayer[] = [];
let settings: Settings = {};

const state: MinimapState = {
  position: null,
  headingDisplayDeg: null,
  rotateWithHeading: false,
  party: [],
  pings: [],
  explored: [],
  showExplored: false,
  trailPx: [],
  pois: [],
  waypoints: [],
  nearestWaypoint: null,
  basemap: null,
  freshwater: null,
  miniScale: 1,
  pxPerM: 0.7,
  sizePx: 260,
  radiusM: 600,
  opacity: 0.85,
  showTrail: true,
  showWaypoints: true,
  showFreshwater: true,
  panelH: 0,
  dino: null,
  questsH: 0,
  quests: [],
  teamH: 0,
  team: [],
  hudScale: 1,
  dinoEtaAdultMin: null,
  questLang: "vi",
  compassLetters: STRINGS.vi.letters,
  hintText: STRINGS.vi.hint,
  headingLabel: "",
  headingUnknown: STRINGS.vi.unknown,
  positionStale: false,
  staleLabel: STRINGS.vi.stale,
  snapshotToast: null,
  onlineLabel: STRINGS.vi.online,
  offlineLabel: STRINGS.vi.offline,
  nutri: STRINGS.vi.nutri,
  colorProfile: "default",
  skin: "obsidian",
  diagnostics: false,
  panelOrder: ["dino", "quests", "team"],
};

let lastHeadingKey: string | null = null;
let lastHeadingDeg: number | null = null;

function applySettings(s: Settings) {
  settings = s;
  const mm = s.minimap ?? {};
  state.sizePx = Number(mm.size_px ?? 260);
  state.hudScale = Math.min(1.75, Math.max(0.65, Number(mm.hud_scale ?? 1)));
  state.radiusM = Number(mm.radius_m ?? 600);
  state.opacity = Number(mm.opacity ?? 0.85);
  state.showTrail = Boolean(mm.show_trail ?? true);
  state.showWaypoints = Boolean(mm.show_waypoints ?? true);
  state.rotateWithHeading = Boolean(mm.rotate_with_heading ?? false);
  state.diagnostics = Boolean(mm.diagnostics ?? false);
  state.panelOrder = Array.isArray(mm.panel_order) ? mm.panel_order : ["dino", "quests", "team"];
  if (Boolean(mm.solo_mode ?? false)) {
    // Clear existing teammate clutter the moment solo mode turns on; it
    // repopulates on the next event when turned off.
    state.party = [];
    state.team = [];
    state.pings = [];
  }
  state.showFreshwater = Boolean((s.layers ?? {}).freshwater ?? true);
  state.showExplored = Boolean((s.layers ?? {}).explored ?? false);
  state.colorProfile = s.color_profile === "deuteranopia" ? "deuteranopia" : "default";
  state.skin = s.skin === "bonefield" || s.skin === "biolum" ? s.skin : "obsidian";
  const lang = (s.language === "en" ? "en" : "vi") as keyof typeof STRINGS;
  state.questLang = lang;
  state.compassLetters = STRINGS[lang].letters;
  state.hintText = STRINGS[lang].hint;
  state.headingUnknown = STRINGS[lang].unknown;
  state.staleLabel = STRINGS[lang].stale;
  state.onlineLabel = STRINGS[lang].online;
  state.offlineLabel = STRINGS[lang].offline;
  state.nutri = STRINGS[lang].nutri;
  refreshHeadingLabel(lang);
  refreshPoiFilter();
}

/** The three stacked-panel heights are owned by Rust (minimap.rs
 * `layout_from_settings`) — this webview fetches `minimap_layout` once and
 * follows the `minimap://layout` push. Keeps canvas size and the OS window in
 * lockstep no matter which side an edit lands on. */
function applyLayout(l: { panelH: number; questsH: number; teamH: number }) {
  state.panelH = l.panelH;
  state.questsH = l.questsH;
  state.teamH = l.teamH;
}

function refreshHeadingLabel(lang: keyof typeof STRINGS) {
  state.headingLabel =
    lastHeadingKey && lastHeadingDeg !== null
      ? `${STRINGS[lang].dirs[lastHeadingKey] ?? ""} ${Math.round(lastHeadingDeg)}°`
      : "";
}

function refreshPoiFilter() {
  const visible = settings.layers ?? {};
  state.pois = allPois.filter((p) => visible[(p as any).layerKey] ?? true);
}

function flattenPois() {
  allPois = [];
  for (const layer of poiLayers) {
    if (layer.kind !== "point") continue; // zones are full-map only
    const color = LAYER_COLORS[layer.key] ?? "#e8a33d";
    for (const item of layer.items) {
      allPois.push({
        xCm: item.xCm,
        yCm: item.yCm,
        px: item.px,
        py: item.py,
        color,
        // Animals draw as their species glyph instead of a dot.
        glyph: layer.key === "animal" ? ANIMAL_GLYPHS[item.label] : undefined,
        // carried for the visibility filter
        ...( { layerKey: layer.key } as object ),
      });
    }
  }
  refreshPoiFilter();
}

// Every listener calls draw() freely; paints are coalesced to one per frame
// so a 22 Hz position feed plus a ~10 Hz team roster still repaint at most
// once per vsync. A hidden/occluded window's rAF is throttled by the browser
// — exactly what we want (no wasted paints behind the game).
let drawPending = false;
// B4: once render() has thrown, don't keep calling it every frame — latch to
// the bare safe disc until the webview is reloaded (the reload_ui hotkey, or
// the supervisor recreating a dead window).
let safeMode = false;
const drawNow = () => {
  if (safeMode) {
    try {
      renderSafe(canvas, state, STRINGS[state.questLang].safe);
    } catch {
      /* nothing left to do */
    }
    return;
  }
  try {
    render(canvas, state);
  } catch (e) {
    safeMode = true;
    void error(`[minimap] render failed, entering safe mode: ${e}`).catch(() => {});
    drawNow();
  }
};
// Ease the dart heading toward the real one each frame. The ingest cadence is
// discrete (and gated), so without this a slow-to-medium turn stair-steps.
// Self-terminating: once settled it stops requesting frames.
const HEADING_EASE = 0.35;
function easeHeading(): boolean {
  const target = state.position?.headingDeg ?? null;
  if (target === null) {
    state.headingDisplayDeg = null;
    return false;
  }
  const cur = state.headingDisplayDeg;
  const delta = cur === null ? 0 : ((target - cur + 540) % 360) - 180;
  if (cur === null || Math.abs(delta) < 0.4) {
    state.headingDisplayDeg = target;
    return false;
  }
  state.headingDisplayDeg = (cur + delta * HEADING_EASE + 360) % 360;
  return true;
}

const draw = () => {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame(() => {
    drawPending = false;
    const stillEasing = easeHeading();
    drawNow();
    // Keep frames coming while the heading is easing or the HUD has a live
    // animation (the critical-HP pulse). Both settle on their own.
    if (stillEasing || isHudAnimating()) draw();
  });
};

// --- P1 for teammates: ease party dots between relay updates. Since v1.19 the
// sender only transmits on real movement (~1–2 Hz walking), so without this a
// teammate dot visibly steps. Same bounded ease as the self-marker; big gaps
// (respawn) snap instead of sliding across the map. Not an idle loop — the
// interval only runs during a ~420 ms glide and clears itself.
type PartyDot = {
  label: string;
  xCm: number;
  yCm: number;
  px: number;
  py: number;
  hp?: number | null;
};
const PARTY_TWEEN_MS = tokens.motion.dur.glide;
const PARTY_SNAP_CM = 8000;
let partyFrom = new Map<string, { px: number; py: number }>();
let partyTo = new Map<string, PartyDot>();
let partyTweenStart = 0;
let partyTween: ReturnType<typeof setInterval> | null = null;

function partyPosAt(label: string, now: number): { px: number; py: number } {
  const to = partyTo.get(label)!;
  const from = partyFrom.get(label) ?? to;
  const t = Math.min(1, (now - partyTweenStart) / PARTY_TWEEN_MS);
  const k = glideK(t);
  return { px: from.px + (to.px - from.px) * k, py: from.py + (to.py - from.py) * k };
}

function renderPartyFrame() {
  const now = performance.now();
  state.party = [...partyTo.values()].map((m) => ({ ...m, ...partyPosAt(m.label, now) }));
  draw();
  if (now - partyTweenStart >= PARTY_TWEEN_MS && partyTween) {
    clearInterval(partyTween);
    partyTween = null;
  }
}

/** A5 — "solo mode": keep the HUD free of teammate clutter without leaving the
 *  team. Gated at the data-entry points so the renderer needs no new state. */
function soloMode(): boolean {
  return Boolean((settings.minimap ?? {}).solo_mode ?? false);
}

/** A10 — opt-in HUD sound cues. */
function soundOn(): boolean {
  return Boolean((settings.sound ?? {}).enabled ?? false);
}

function onParty(markers: PartyDot[]) {
  if (soloMode()) {
    if (state.party.length) {
      state.party = [];
      draw();
    }
    return;
  }
  const now = performance.now();
  const nextFrom = new Map<string, { px: number; py: number }>();
  const nextTo = new Map<string, PartyDot>();
  for (const m of markers) {
    const prev = partyTo.get(m.label);
    const shown = prev ? partyPosAt(m.label, now) : null;
    const jump =
      !shown || !prev || Math.hypot(m.xCm - prev.xCm, m.yCm - prev.yCm) > PARTY_SNAP_CM;
    nextFrom.set(m.label, jump ? { px: m.px, py: m.py } : shown!);
    nextTo.set(m.label, m);
  }
  partyFrom = nextFrom;
  partyTo = nextTo;
  partyTweenStart = now;
  renderPartyFrame();
  if (!partyTween && markers.length) partyTween = setInterval(renderPartyFrame, 16);
}

let imageWidthPx = 7800;
// Which basemap imagery this webview currently renders — compared against
// settings broadcasts to reload only on a real switch.
let currentSource = "vulnona";
// Fresh-water overlay descriptor from get_map_info (bounds already in the
// ACTIVE calibration's px space); null when the file is not on disk yet.
let overlayInfo: { url: string; boundsPx: [number, number, number, number] } | null = null;

type MapInfoPayload = {
  imageWidthPx: number;
  pxPerMX: number;
  source: string;
  overlays?: { key: string; path: string; boundsPx: [number, number, number, number] }[];
};

function applyMapInfo(info: MapInfoPayload) {
  state.pxPerM = info.pxPerMX;
  imageWidthPx = info.imageWidthPx;
  currentSource = info.source;
  overlayInfo = null;
  for (const ov of info.overlays ?? []) {
    if (ov.key === "freshwater") {
      overlayInfo = { url: convertFileSrc(ov.path), boundsPx: ov.boundsPx };
    }
  }
}

/// (Re)load basemap + POIs. Called at init AND whenever the first-run /
/// re-download fetch finishes — the data may not exist yet when this webview
/// first starts, and it must pick it up without an app restart.
async function loadData() {
  try {
    poiLayers = await invoke<PoiLayer[]>("get_pois_render");
    flattenPois();
  } catch {
    // POI data missing (first run): map still works without dots.
  }
  try {
    const paths = await invoke<{ minimap: string; minimapDecodeWidth: number | null }>(
      "get_basemap_paths",
    );
    const resp = await fetch(convertFileSrc(paths.minimap));
    if (resp.ok) {
      // The islemaps PNGs decode to ~25 MB; the hint downscales them at
      // decode so the always-resident bitmap stays small. miniScale
      // normalises by bitmap width, so a downscaled decode needs no other
      // change anywhere.
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(
        blob,
        paths.minimapDecodeWidth
          ? { resizeWidth: paths.minimapDecodeWidth, resizeQuality: "high" }
          : {},
      );
      state.basemap?.close(); // release the old pixels promptly
      state.basemap = bitmap;
      state.miniScale = state.basemap.width / imageWidthPx;
    }
  } catch {
    // Missing basemap: the disc just stays unfilled until data arrives.
  }
  try {
    if (overlayInfo) {
      const resp = await fetch(overlayInfo.url);
      if (resp.ok) {
        // Same downscale reasoning as the islemaps basemap: ~6 MB resident
        // instead of ~25 MB; the draw stretches to px bounds so resolution
        // only affects sharpness.
        const bmp = await createImageBitmap(await resp.blob(), {
          resizeWidth: 1250,
          resizeQuality: "high",
        });
        const [left, top, right, bottom] = overlayInfo.boundsPx;
        state.freshwater?.bitmap.close();
        state.freshwater = { bitmap: bmp, x: left, y: top, w: right - left, h: bottom - top };
      }
    } else if (state.freshwater) {
      state.freshwater.bitmap.close();
      state.freshwater = null;
    }
  } catch {
    // Overlay missing: the layer is simply absent.
  }
  draw();
}

/// Waypoints for the disc + the nearest-waypoint rim arrow. Both piggyback
/// on events (waypoints://changed, position updates) — no polling.
interface WaypointPx {
  id: string;
  name: string;
  /** world cm (legacy field names) */
  x: number;
  y: number;
  px: number;
  py: number;
  color: string | null;
  group?: string | null;
}
let waypointsPx: WaypointPx[] = [];

async function refreshWaypoints() {
  try {
    waypointsPx = await invoke<WaypointPx[]>("list_waypoints_px");
  } catch {
    waypointsPx = [];
  }
  const hidden = new Set<string>(settings.hidden_waypoint_groups ?? []);
  state.waypoints = waypointsPx
    .filter((w) => !(w.group && hidden.has(w.group)))
    .map((w) => ({
      xCm: w.x,
      yCm: w.y,
      px: w.px,
      py: w.py,
      color: w.color,
      glyph: waypointGlyph(w.name),
    }));
  await refreshNearest();
  draw();
}

// The rim arrow re-aims via an IPC round-trip; at 22 Hz that is a lot of
// traffic for a hint that changes slowly. Cap it at ~5 Hz, trailing.
let nearestPending = false;
function scheduleNearest() {
  if (nearestPending) return;
  nearestPending = true;
  setTimeout(() => {
    nearestPending = false;
    void refreshNearest().then(draw);
  }, 200);
}

async function refreshNearest() {
  try {
    const near = await invoke<{
      id: string;
      bearingDeg: number;
      distanceM: number;
    } | null>("nearest_waypoint");
    const target = near ? waypointsPx.find((w) => w.id === near.id) : undefined;
    state.nearestWaypoint = near
      ? {
          bearingDeg: near.bearingDeg,
          distanceM: near.distanceM,
          color: target?.color ?? null,
          glyph: target ? waypointGlyph(target.name) : undefined,
        }
      : null;
  } catch {
    state.nearestWaypoint = null;
  }
}

/// Full reload after a basemap switch: new geometry, new bitmap, and a
/// defensive position/trail re-fetch (resync events also arrive; this closes
/// the one-stale-frame window in between).
async function reloadMapSource() {
  try {
    applyMapInfo(await invoke<MapInfoPayload>("get_map_info"));
  } catch {
    return; // keep rendering the old frame rather than a mismatched one
  }
  await loadData();
  try {
    const p = await invoke<PositionUpdate | null>("get_current_position");
    if (p) {
      state.position = { xCm: p.xCm, yCm: p.yCm, px: p.px, py: p.py, headingDeg: p.headingDeg };
    }
    const trail = await invoke<{ segmentsPx: [number, number][][] }>("get_current_trail");
    state.trailPx = trail.segmentsPx;
  } catch {
    // resync events will repaint us shortly anyway
  }
  // Waypoint px is calibration-dependent — refresh in the new frame.
  await refreshWaypoints();
  // Fog-of-war rects are px too.
  try {
    const r = await invoke<{ cells: [number, number, number, number][] }>("get_explored");
    state.explored = r.cells;
  } catch {
    // harmless
  }
  draw();
}

async function init() {
  settings = await invoke<Settings>("get_settings");
  applySettings(settings);

  applyMapInfo(await invoke<MapInfoPayload>("get_map_info"));

  // Panel heights: fetch the current set, then follow the push. Rust owns the
  // formula (minimap.rs) so the canvas and the OS window can never drift.
  try {
    applyLayout(
      await invoke<{ panelH: number; questsH: number; teamH: number }>("minimap_layout"),
    );
  } catch {
    // keep the zeros; the first minimap://layout push will fill them in
  }
  await listen<{ panelH: number; questsH: number; teamH: number }>("minimap://layout", (e) => {
    applyLayout(e.payload);
    draw();
  });

  // "Position signal lost" pill: the pipeline keepalive emits at least once a
  // second while any source is live, so no event for >5 s means it stopped
  // (game closed, socket dead, clipboard idle). One re-armed timeout, not a
  // poll — it only fires on actual signal loss.
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  const markFresh = () => {
    if (staleTimer) clearTimeout(staleTimer);
    if (state.positionStale) {
      state.positionStale = false;
      draw();
    }
    staleTimer = setTimeout(() => {
      state.positionStale = true;
      if (soundOn()) cue("lost");
      draw();
    }, 5500);
  };

  // P1: optional short glide between samples so the marker eases to the new
  // spot instead of teleporting. Bounded (~420 ms) per sample — not an idle
  // loop; only runs while `minimap.smooth_motion` is on.
  let tween: ReturnType<typeof setInterval> | null = null;
  const clearTween = () => {
    if (tween) {
      clearInterval(tween);
      tween = null;
    }
  };

  await listen<PositionUpdate>("position://update", (e) => {
    const p = e.payload;
    markFresh();
    lastHeadingKey = p.compassKey;
    lastHeadingDeg = p.headingDeg;
    refreshHeadingLabel(settings.language === "en" ? "en" : "vi");

    const smooth = Boolean((settings.minimap ?? {}).smooth_motion ?? false);
    const from = state.position;
    if (!smooth || !from) {
      clearTween();
      state.position = { xCm: p.xCm, yCm: p.yCm, px: p.px, py: p.py, headingDeg: p.headingDeg };
    } else {
      // cm / heading snap now (used only for distance filters); px eases.
      const sx = from.px;
      const sy = from.py;
      const start = performance.now();
      const DUR = tokens.motion.dur.glide;
      clearTween();
      state.position = { xCm: p.xCm, yCm: p.yCm, px: sx, py: sy, headingDeg: p.headingDeg };
      tween = setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / DUR);
        const k = glideK(t);
        state.position = {
          xCm: p.xCm,
          yCm: p.yCm,
          px: sx + (p.px - sx) * k,
          py: sy + (p.py - sy) * k,
          headingDeg: p.headingDeg,
        };
        draw();
        if (t >= 1) clearTween();
      }, 16);
    }
    draw();
    // The rim arrow re-aims from the new position; repaints once more when
    // the answer arrives (still purely event-driven, throttled to ~5 Hz).
    scheduleNearest();
  });
  await listen("waypoints://changed", () => void refreshWaypoints());
  await listen<PartyDot[]>("party://update", (e) => onParty(e.payload));
  // A5 — a team contact ping is a "predator seen" alert: held PREDATOR_ALERT_MS
  // as a fading danger zone. A slow interval nudges a redraw while any ping is
  // live so the fade animates without a full rAF loop.
  let pingFade: ReturnType<typeof setInterval> | null = null;
  const stopPingFade = () => {
    if (pingFade && state.pings.length === 0) {
      clearInterval(pingFade);
      pingFade = null;
    }
  };
  await listen<{ from: string; xCm: number; yCm: number; px: number; py: number }>(
    "team://mark",
    (e) => {
      if (soloMode()) return;
      if (soundOn()) cue("ping");
      const ping = { ...e.payload, atMs: Date.now() };
      state.pings = [...state.pings, ping];
      draw();
      if (!pingFade) pingFade = setInterval(draw, 3000);
      setTimeout(() => {
        state.pings = state.pings.filter((p) => p !== ping);
        stopPingFade();
        draw();
      }, PREDATOR_ALERT_MS);
    },
  );
  interface RosterMember extends TeamRow {
    isSelf: boolean;
  }
  const lastTeamHp = new Map<string, number | null>();
  await listen<{ roster?: RosterMember[] }>("team://status", (e) => {
    const roster = (e.payload.roster ?? []).filter((m) => !m.isSelf);
    // A10 — chirp once when a teammate drops below 25% HP (edge, not level).
    if (soundOn() && !soloMode()) {
      for (const m of roster) {
        const prev = lastTeamHp.get(m.name);
        if (m.hp !== null && m.hp < 25 && (prev == null || prev >= 25)) {
          cue("lowhp");
          break;
        }
      }
    }
    lastTeamHp.clear();
    for (const m of roster) lastTeamHp.set(m.name, m.hp);

    state.team = soloMode()
      ? []
      : roster.map(({ name, online, hp, hunger, thirst }) => ({ name, online, hp, hunger, thirst }));
    draw(); // teamH arrives separately on minimap://layout
  });
  const refreshExplored = async () => {
    try {
      const r = await invoke<{ cells: [number, number, number, number][] }>("get_explored");
      state.explored = r.cells;
      draw();
    } catch {
      // fog of war missing is harmless
    }
  };
  await listen("explored://changed", () => void refreshExplored());
  void refreshExplored();
  await listen<{ segmentsPx: [number, number][][] }>("trail://changed", (e) => {
    state.trailPx = e.payload.segmentsPx;
    draw();
  });

  // B5: the map-snapshot hotkey (Rust) emits this; read our own canvas and
  // hand the raw frame to Rust for the clipboard (the overlay window has no
  // focus, so navigator.clipboard.write throws here). A brief on-disc toast
  // confirms; it clears itself so the steady-state frame is unchanged.
  let snapshotToastTimer: ReturnType<typeof setTimeout> | null = null;
  const flashSnapshot = (msg: string) => {
    state.snapshotToast = msg;
    draw();
    if (snapshotToastTimer) clearTimeout(snapshotToastTimer);
    snapshotToastTimer = setTimeout(() => {
      state.snapshotToast = null;
      draw();
    }, 1600);
  };
  await listen("minimap://snapshot", () => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return;
    const lang = state.questLang;
    try {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      void invoke("copy_map_snapshot", {
        width: canvas.width,
        height: canvas.height,
        data: Array.from(frame.data),
      })
        .then(() => flashSnapshot(STRINGS[lang].snapOk))
        .catch((e) => {
          flashSnapshot(STRINGS[lang].snapErr);
          void error(`[minimap] snapshot copy failed: ${e}`).catch(() => {});
        });
    } catch (e) {
      flashSnapshot(STRINGS[lang].snapErr);
      void error(`[minimap] snapshot read failed: ${e}`).catch(() => {});
    }
  });
  await listen<Settings>("settings://changed", (e) => {
    const prevBasemapPx = (settings.minimap ?? {}).basemap_px;
    applySettings(e.payload);
    const src = (e.payload.map?.basemap as string) ?? "vulnona";
    if (src !== currentSource) {
      void reloadMapSource();
      return; // reloadMapSource draws when the new frame is ready
    }
    // Disc basemap decode resolution changed — re-fetch and re-decode the
    // bitmap at the new width (loadData re-reads get_basemap_paths).
    if ((e.payload.minimap ?? {}).basemap_px !== prevBasemapPx) {
      void loadData();
    }
    // Group visibility may have changed — re-filter the waypoint dots.
    void refreshWaypoints();
    draw();
  });

  // "Your dino" stats for the strip under the disc.
  interface DinoStatBar {
    current: number | null;
    max: number | null;
  }
  interface DinoUpdatePayload {
    player: {
      dinoName?: string | null;
      female?: boolean | null;
      online?: boolean | null;
      primeEligible?: boolean | null;
      growthPct: number | null;
      health: DinoStatBar | null;
      hunger: DinoStatBar | null;
      thirst: DinoStatBar | null;
      stamina?: DinoStatBar | null;
      nutrition?: { carb: number; protein: number; lipid: number } | null;
      primeQuests?: QuestRow[];
    } | null;
  }
  const toBars = (u: DinoUpdatePayload): DinoBars | null =>
    u.player
      ? {
          name: u.player.dinoName ?? null,
          female: u.player.female ?? null,
          online: u.player.online ?? null,
          primeEligible: u.player.primeEligible ?? null,
          hp: u.player.health ?? { current: null, max: null },
          hunger: u.player.hunger ?? { current: null, max: null },
          thirst: u.player.thirst ?? { current: null, max: null },
          stamina: u.player.stamina ?? null,
          growthPct: u.player.growthPct,
          nutrition: u.player.nutrition ?? null,
        }
      : null;
  // Error updates carry player: null — keep the last good quests/bars so a
  // network hiccup doesn't blank (or resize) the overlay.
  const applyDino = (u: DinoUpdatePayload) => {
    state.dino = toBars(u) ?? state.dino;
    if (u.player) {
      state.quests = u.player.primeQuests ?? [];
      // panelH / questsH arrive separately on minimap://layout (Rust owns them)
    }
  };
  await listen<DinoUpdatePayload>("dino://update", (e) => {
    applyDino(e.payload);
    draw();
  });
  try {
    const st = await invoke<{ lastUpdate: DinoUpdatePayload | null }>("islepilot_state");
    if (st.lastUpdate) applyDino(st.lastUpdate);
  } catch {
    // feature off — strip just shows "…" until data arrives
  }

  // First-run / re-download / silent top-up completed: pick up the new data
  // live — including overlays that did not exist at init (get_map_info again).
  await listen("fetch://finished", () => void reloadMapSource());

  // Initial state: position/trail otherwise arrive only as events, so a
  // fresh (re)loaded webview would sit on the hint disc until the player's
  // next manual copy.
  try {
    const p = await invoke<PositionUpdate | null>("get_current_position");
    if (p) {
      state.position = { xCm: p.xCm, yCm: p.yCm, px: p.px, py: p.py, headingDeg: p.headingDeg };
      lastHeadingKey = p.compassKey;
      lastHeadingDeg = p.headingDeg;
      refreshHeadingLabel(settings.language === "en" ? "en" : "vi");
    }
    const trail = await invoke<{ segmentsPx: [number, number][][] }>("get_current_trail");
    state.trailPx = trail.segmentsPx;
  } catch {
    // Stays on the hint disc until the first event.
  }

  // First paint before the window is shown (Rust shows it on this signal) —
  // synchronous so pixels are up when the window appears.
  drawNow();
  await emit("minimap://ready", {});

  // Data load can lag behind the first paint; draws again when ready.
  void loadData();
  void refreshWaypoints();

  // P9: growth ETA from the local stat history, refreshed slowly.
  const pollEta = async () => {
    try {
      const h = await invoke<{ etaAdultH: number | null }>("dino_history", { rangeHours: 2 });
      state.dinoEtaAdultMin =
        h.etaAdultH !== null && h.etaAdultH > 0 ? h.etaAdultH * 60 : null;
      draw();
    } catch {
      state.dinoEtaAdultMin = null;
    }
  };
  // Only while the dino strip is actually up — no idle IPC for clipboard /
  // G1-only users who never enable IslePilot.
  const etaPollDue = () => Boolean(settings.islepilot?.enabled) && state.dino !== null;
  if (etaPollDue()) void pollEta();
  setInterval(() => {
    if (etaPollDue()) void pollEta();
  }, 60_000);
}

void init().catch((e) => {
  void error(`[minimap] init failed: ${e}`).catch(() => {});
  // A blank-but-alive overlay beats an invisible one: Rust wires up the
  // supervisor on this signal (and has its own 5 s fallback besides).
  void emit("minimap://ready", {});
});
