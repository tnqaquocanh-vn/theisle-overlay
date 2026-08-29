// Circular minimap renderer — full port of MinimapWindow.paintEvent.
//
// The map NEVER rotates: north is always up, so the compass letters stay
// put. The player's heading is shown by the arrow and the readout pill.
// Drawn with one drawImage cropping the region around the player out of the
// preloaded bitmap (vulnona 975 px tier, or a downscaled islemaps decode).
// No repaint timers: draw only on new data.
//
// Amber HUD (v1.23): chrome colours come from the token contract, status
// colours honour the accessibility profile, text is IBM Plex, and the disc
// carries a rim vignette + a trail that fades toward its tail.

import { skinColors, type SkinKey } from "../lib/tokens";
import { semanticColors, type ColorProfile } from "../lib/theme";
import { dietEntry } from "../lib/dino-diets.data";

export interface PoiDot {
  xCm: number;
  yCm: number;
  px: number; // px in the ACTIVE calibration's basemap space
  py: number;
  color: string;
  /** When set (animal species), drawn as this emoji instead of a dot. */
  glyph?: string;
}

export interface DinoBars {
  /** Dino / species name from IslePilot — the panel's identity line. */
  name: string | null;
  female: boolean | null;
  /** IslePilot's live-tracking flag for your dino — drives the ONLINE chip.
   *  null when the source can't report it (older cookie-mode payloads). */
  online: boolean | null;
  /** Prime is unlockable now — the chip goes biolum with a ✦. null = unknown
   *  (HTML parser); the quest done/total still shows either way. */
  primeEligible: boolean | null;
  hp: { current: number | null; max: number | null };
  hunger: { current: number | null; max: number | null };
  thirst: { current: number | null; max: number | null };
  /** Only the token-mode JSON API provides this; null in cookie mode. */
  stamina: { current: number | null; max: number | null } | null;
  growthPct: number | null;
  /** Carb/Protein/Lipid %, token mode only — drives the "eat next" hint. */
  nutrition: { carb: number; protein: number; lipid: number } | null;
}

// The three stacked-panel *heights* are owned by src-tauri/src/minimap.rs
// (`layout_from_settings`) and arrive via `minimap_layout` / `minimap://layout`
// as `state.panelH / questsH / teamH`. The constants below only set row pitch
// *inside* a card — they never decide a card's total height, so a change here
// can never clip the canvas or leave a gap.
const QUEST_HEADER_H = 18;
const QUEST_ROW_H = 14;
/** Max quest rows shown in-game (unfinished first). Mirror: QUEST_MAX_ROWS in
 *  src-tauri/src/minimap.rs, which caps the panel height to match. */
const QUEST_MAX_ROWS = 10;
const TEAM_HEADER_H = 16;
const TEAM_ROW_H = 20;

export interface TeamRow {
  name: string;
  online: boolean;
  hp: number | null;
  hunger: number | null;
  thirst: number | null;
}

export interface QuestRow {
  text: string;
  /** Vietnamese translation from the backend; absent when untranslated. */
  textVi?: string | null;
  completed: boolean;
}

export interface MinimapState {
  /** Player position (cm + basemap px) and heading, or null before first sample. */
  position: { xCm: number; yCm: number; px: number; py: number; headingDeg: number | null } | null;
  /** Eased heading for the dart / heading-up rotation (main.ts glides this
   *  toward position.headingDeg each frame). null before the first heading. */
  headingDisplayDeg: number | null;
  /** Rotate the disc so the heading points up (compass letters + player counter-rotate). */
  rotateWithHeading: boolean;
  /** Trail segments in basemap px. */
  trailPx: [number, number][][];
  /** Point POIs already filtered by layer visibility (not by distance). */
  pois: PoiDot[];
  /** Saved waypoints (cm + basemap px + user colour; glyph = icon pins). */
  waypoints: {
    xCm: number;
    yCm: number;
    px: number;
    py: number;
    color: string | null;
    glyph?: string;
  }[];
  /** Other players — F7 server map or G6 team relay; empty when off. `hp` is
   *  0..100 from the relay, null otherwise. */
  party: {
    xCm: number;
    yCm: number;
    px: number;
    py: number;
    label: string;
    hp?: number | null;
  }[];
  /** Live contact pings (P3): kept for ~12 s after arrival. */
  /** Contact "predator seen" pings from the team. `atMs` (wall clock) drives
   *  the fade over PREDATOR_ALERT_MS; main.ts drops each after that. */
  pings: { px: number; py: number; xCm: number; yCm: number; from: string; atMs: number }[];
  /** Visited grid cells as [left, top, right, bottom] px (F9). */
  explored: [number, number, number, number][];
  showExplored: boolean;
  /** Rim arrow target: the closest saved waypoint, or null. */
  nearestWaypoint: {
    bearingDeg: number;
    distanceM: number;
    color: string | null;
    glyph?: string;
  } | null;
  basemap: ImageBitmap | null;
  /** Fresh-water overlay; x/y/w/h in ACTIVE-calibration basemap px. */
  freshwater: { bitmap: ImageBitmap; x: number; y: number; w: number; h: number } | null;
  /** bitmap scale: bitmapWidth / active calibration's image_width_px. */
  miniScale: number;
  /** Basemap px per real metre (horizontal). */
  pxPerM: number;
  sizePx: number;
  radiusM: number;
  opacity: number;
  /** Trail lines on the disc — settings.minimap.show_trail (declutter). */
  showTrail: boolean;
  /** Waypoint dots + rim arrow — settings.minimap.show_waypoints. */
  showWaypoints: boolean;
  /** Fresh-water overlay visibility — settings.layers.freshwater. */
  showFreshwater: boolean;
  /** Extra height for the dino-stats strip; 0 = strip off. */
  panelH: number;
  dino: DinoBars | null;
  /** Extra height for the Prime-quests panel; 0 = panel off or no quests. */
  questsH: number;
  quests: QuestRow[];
  /** Extra height for the teammate-stats panel (G6); 0 = off or solo. */
  teamH: number;
  team: TeamRow[];
  /** G8: uniform HUD scale (0.65–1.75). Everything is drawn in logical units
   *  and this multiplies the render transform. */
  hudScale: number;
  /** P9: minutes to adult at the current growth rate (from stat history);
   *  null when unknown or already grown. Shown on the growth line. */
  dinoEtaAdultMin: number | null;
  /** Quest text language: "vi" shows textVi (fallback English). */
  questLang: "vi" | "en";
  /** Localised strings: compass letters clockwise from north, hint, unknown. */
  compassLetters: [string, string, string, string];
  hintText: string;
  headingLabel: string; // "" when unknown -> shows headingUnknown
  headingUnknown: string;
  /** No position event for >5 s — the active source went quiet. */
  positionStale: boolean;
  staleLabel: string;
  /** B5: transient "map copied" / "copy failed" toast on the disc; null when
   *  idle (main.ts clears it ~1.6 s after the snapshot hotkey). */
  snapshotToast: string | null;
  /** HUD chip labels for the dino identity block (localised in main.ts). */
  onlineLabel: string;
  offlineLabel: string;
  /** "Eat next" nutrition row strings (localised in main.ts). */
  nutri: {
    label: string;
    ok: string;
    short: { carb: string; protein: string; lipid: string };
    /** One line for any low nutrient on a herbivore ("vary your plants"). */
    herb: string;
    /** Carnivore / omnivore: the organ (or food) that fills each bar. */
    hint: {
      carnCarb: string;
      carnProt: string;
      carnLip: string;
      omniCarb: string;
      omniProt: string;
      omniLip: string;
    };
  };
  /** Accessibility profile for the status colours (A8). */
  colorProfile: ColorProfile;
  /** A9 ground palette — obsidian | bonefield | biolum. */
  skin: SkinKey;
  /** v1.26: show a tiny render-ms / repaint-rate readout on the disc. */
  diagnostics: boolean;
  /** A2: stacking order of the dino / quests / team panels under the disc. */
  panelOrder: string[];
}

const LABEL_MARGIN = 15;
const POI_MARGIN = 1.6; // filter wider than the view so dots don't pop in at the rim

/** A2 — the reorderable stacked panels under the disc. */
export type PanelKey = "dino" | "quests" | "team";
const PANEL_KEYS: PanelKey[] = ["dino", "quests", "team"];
/** Sanitise `settings.minimap.panel_order` into a full valid permutation:
 *  keep the recognised keys in the given order, then append any missing ones
 *  in the default order. */
export function panelStack(order: string[] | undefined | null): PanelKey[] {
  const given = (order ?? []).filter((k): k is PanelKey =>
    (PANEL_KEYS as string[]).includes(k),
  );
  const seen = new Set(given);
  return [...given, ...PANEL_KEYS.filter((k) => !seen.has(k))];
}

/** Chrome colours for the active skin (A9). The ground roles come from the
 *  token set; the self-marker / trail / waypoint / party hues stay literal so
 *  they never collide with terrain whatever the ground. `render()` rebuilds
 *  this each frame from `state.skin`, the same way `SEM` tracks the profile. */
function buildColors(skin: SkinKey | string | undefined) {
  const t = skinColors(skin);
  return {
    bg: t.ground,
    edge: t.edge,
    text: t.ink,
    textMuted: t.inkMid,
    accent: t.amber,
    biolum: t.biolum, // "live / linked" — the ONLINE chip + a ready Prime
    blood: t.blood, // offline / lost / a low nutrient
    moss: t.moss, // ok / balanced
    // Electric yellow + double outline (dark under, white over): the
    // self-marker must never be confused with POI dots or the softer trail.
    playerArrow: "#ffe600",
    playerArrowOutline: "#0b0d08",
    playerHalo: "rgba(92, 214, 191, 0.22)", // biolum — "you're live"
    trail: "#ffcc55",
    waypoint: "#4fc3f7", // matches theme.ts COLORS.waypoint
    party: "#ff7bd0", // F7 markers with no HP
  };
}
let COLORS = buildColors("obsidian");

const FONT_SANS = "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const FONT_EMOJI = "'Segoe UI Emoji', 'IBM Plex Sans', sans-serif";

// Status palette for the active accessibility profile, set once per render().
let SEM = semanticColors("default");

// Set true by a draw when something is mid-animation (a critical-HP pulse):
// main.ts re-requests a frame while this holds, then it settles.
let hudAnimating = false;
export function isHudAnimating(): boolean {
  return hudAnimating;
}
/** ok / warn / danger by fraction (null -> ok). */
function hpBand(frac: number | null): string {
  return frac === null || frac > 0.5 ? SEM.ok : frac > 0.25 ? SEM.warn : SEM.danger;
}
/** `#rrggbb` + alpha -> `rgba(...)`. */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * B4 — last-resort paint when `render` throws mid-session. A frozen or black
 * overlay is the worst failure mode this window has; a bare disc with the
 * player dart still tells you where you are while the log/telemetry carries
 * the real error. Kept deliberately tiny and dependency-free.
 */
export function renderSafe(canvas: HTMLCanvasElement, state: MinimapState, label: string): void {
  const size = state.sizePx || 260;
  const dpr = window.devicePixelRatio || 1;
  const s = dpr * (state.hudScale || 1);
  canvas.width = Math.round(size * s);
  canvas.height = Math.round(size * s);
  canvas.style.width = `${Math.round(size * (state.hudScale || 1))}px`;
  canvas.style.height = `${Math.round(size * (state.hudScale || 1))}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  COLORS = buildColors(state.skin);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const c = size / 2;

  ctx.beginPath();
  ctx.arc(c, c, size / 2 - LABEL_MARGIN, 0, Math.PI * 2);
  ctx.fillStyle = alpha(COLORS.bg, 0.92);
  ctx.fill();

  if (state.position) {
    ctx.beginPath();
    ctx.arc(c, c, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.playerArrow;
    ctx.strokeStyle = COLORS.playerArrowOutline;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
  }

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `11px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, c, c + size / 2 - LABEL_MARGIN - 14);
}

// v1.26 diagnostics — measured around renderInner(), shown by drawDiag() when
// settings.minimap.diagnostics is on. `diagFrames` holds repaint timestamps
// from the last second, so the "fps" reading is the ACTUAL redraw rate (this
// window is event-driven — idle is 0, a heading ease burst is ~60).
const diagFrames: number[] = [];
let diagLastMs = 0;

// Basemap crop cache. Cropping the (large) basemap around the player is the
// priciest op per frame, and it only changes when the player MOVES or the
// zoom / HUD scale changes — NOT when the heading eases or the HP pulses. So
// blit a cached crop and re-crop only on a real change; a heading-ease burst
// then costs one cheap 1:1 blit per frame instead of a full resample.
let bgCache: { key: string; bmp: ImageBitmap; canvas: HTMLCanvasElement } | null = null;
let bgRecrops = 0; // shown in the diagnostics readout — should tick on move, not on animation

/** Test-only (tests/perf/minimap-bench.html): cumulative basemap re-crops, so
 *  a spec can assert a heading-ease burst does zero of them. */
export function _bgRecrops(): number {
  return bgRecrops;
}

function diagRecord(ms: number): void {
  diagLastMs = ms;
  const now = performance.now();
  diagFrames.push(now);
  while (diagFrames.length && now - diagFrames[0] > 1000) diagFrames.shift();
}
function drawDiag(ctx: CanvasRenderingContext2D, state: MinimapState): void {
  const s = (window.devicePixelRatio || 1) * (state.hudScale || 1);
  ctx.save();
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const txt = `${diagLastMs.toFixed(1)}ms · ${diagFrames.length}fps · re${bgRecrops}`;
  ctx.font = `600 9px ${FONT_MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const w = ctx.measureText(txt).width + 10;
  ctx.beginPath();
  ctx.roundRect(4, 4, w, 14, 3);
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fill();
  ctx.fillStyle = diagLastMs > 6 ? COLORS.blood : COLORS.moss;
  ctx.fillText(txt, 9, 8.5);
  ctx.restore();
}

export function render(canvas: HTMLCanvasElement, state: MinimapState): void {
  const t0 = performance.now();
  renderInner(canvas, state);
  diagRecord(performance.now() - t0);
  if (state.diagnostics) {
    const ctx = canvas.getContext("2d");
    if (ctx) drawDiag(ctx, state);
  }
}

function renderInner(canvas: HTMLCanvasElement, state: MinimapState): void {
  const size = state.sizePx;
  const totalH = size + state.panelH + state.questsH + state.teamH;
  const dpr = window.devicePixelRatio || 1;
  // G8: everything below is drawn in logical units; `s` blows the whole HUD
  // up or down uniformly, and the window (sized by minimap.rs) matches.
  const s = dpr * (state.hudScale || 1);
  const physW = Math.round(size * s);
  const physH = Math.round(totalH * s);
  if (canvas.width !== physW || canvas.height !== physH) {
    canvas.width = physW;
    canvas.height = physH;
    canvas.style.width = `${Math.round(size * (state.hudScale || 1))}px`;
    canvas.style.height = `${Math.round(totalH * (state.hudScale || 1))}px`;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  SEM = semanticColors(state.colorProfile);
  COLORS = buildColors(state.skin);
  hudAnimating = false;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.clearRect(0, 0, size, totalH);

  // A2 — the three stacked panels can be reordered (settings.minimap.panel_order).
  // The window height (Rust) is the same either way — the sum doesn't move — so
  // only the draw offsets here change. Each panel's `top` is walked from the
  // order; a card with 0 height takes no space.
  const heights: Record<PanelKey, number> = {
    dino: state.panelH,
    quests: state.questsH,
    team: state.teamH,
  };
  let stackY = size + 2;
  const draw: Record<PanelKey, (t: number) => void> = {
    dino: (t) => drawDinoPanel(ctx, state, size, t),
    quests: (t) => drawQuestPanel(ctx, state, size, t),
    team: (t) => drawTeamPanel(ctx, state, size, t),
  };
  for (const key of panelStack(state.panelOrder)) {
    if (heights[key] > 0) {
      draw[key](stackY);
      stackY += heights[key];
    }
  }

  const c = size / 2;
  const radius = size / 2 - LABEL_MARGIN;

  if (!state.position) {
    // No position yet: a dim disc so the hint text is readable.
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fillStyle = alpha(COLORS.bg, 0.9);
    ctx.fill();
    ctx.strokeStyle = alpha(COLORS.edge, 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
    drawHint(ctx, c, radius, state.hintText);
    return;
  }

  // The dart (and heading-up rotation) follow `headingDisplayDeg`, an eased
  // copy of the real heading (main.ts) — the ingest cadence is discrete, so
  // easing is what makes a turn look continuous rather than stepped.
  const hdg = state.headingDisplayDeg ?? state.position.headingDeg;

  // Heading-up mode: rotate the map inside the disc by -heading, then
  // counter-rotate the compass letters and the player dart so they read
  // correctly. Zero when the toggle is off or the heading is unknown.
  const headingRad =
    state.rotateWithHeading && hdg !== null ? (hdg * Math.PI) / 180 : 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.clip();
  if (headingRad) {
    ctx.translate(c, c);
    ctx.rotate(-headingRad);
    ctx.translate(-c, -c);
  }
  drawMap(ctx, state, c, radius);
  ctx.restore();

  // Rim vignette — gathers the eye to the centre and lets the compass letters
  // sit over darker terrain. Drawn after the (possibly rotated) map, in the
  // disc's own space so it never rotates.
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.clip();
  const vig = ctx.createRadialGradient(c, c, radius * 0.62, c, c, radius);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(c - radius, c - radius, radius * 2, radius * 2);
  ctx.restore();

  // A hairline rim + 8 short ticks (every 45°) — a tactical bezel that keeps
  // the disc edge defined over busy terrain. The 4 inter-cardinals are longer.
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.strokeStyle = alpha(COLORS.edge, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = alpha(COLORS.text, 0.4);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - headingRad;
    const len = k % 2 === 0 ? 4 : 2.5;
    const co = Math.cos(a);
    const si = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(c + (radius - len) * co, c + (radius - len) * si);
    ctx.lineTo(c + radius * co, c + radius * si);
    ctx.stroke();
  }

  drawCompass(ctx, state, c, radius, headingRad);
  drawWaypointArrow(ctx, state, c, radius, headingRad);
  drawHeadingPill(ctx, state, c, radius);
  drawStaleTag(ctx, state, c, radius);
  // Player marker LAST and always fully opaque: however faded the map is,
  // you must still see where you are or the whole map is pointless.
  drawPlayer(ctx, c, headingRad, hdg);
  drawSnapshotToast(ctx, state, c, radius);
}

/** B5 — a brief biolum pill high on the disc after the map-snapshot hotkey.
 *  Purely transient (main.ts nulls `snapshotToast` on a timer), so it never
 *  affects the steady-state frame or the visual baseline. */
function drawSnapshotToast(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
): void {
  if (!state.snapshotToast) return;
  const text = `⧉ ${state.snapshotToast}`;
  ctx.font = `600 11px ${FONT_SANS}`;
  const w = ctx.measureText(text).width + 24;
  const h = 20;
  const x = c - w / 2;
  const y = c - radius * 0.5 - h / 2;
  ctx.globalAlpha = state.opacity;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fill();
  ctx.strokeStyle = alpha(COLORS.biolum, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = COLORS.biolum;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c, y + h / 2 + 0.5);
  ctx.globalAlpha = 1;
}

/** A muted pill under the heading readout when the position feed has gone
 * quiet — the marker is frozen at the last spot, say so rather than let the
 * player trust a stale dot. Amber, not red: "stale", not "broken". */
function drawStaleTag(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
): void {
  if (!state.positionStale) return;
  const text = state.staleLabel;
  ctx.font = `600 10px ${FONT_MONO}`;
  const w = ctx.measureText(text).width + 24;
  const h = 16;
  const x = c - w / 2;
  const y = c + radius * 0.52 + 23;
  ctx.globalAlpha = state.opacity;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 10, y + h / 2, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 17, y + h / 2 + 0.5);
  ctx.globalAlpha = 1;
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
): void {
  const pos = state.position!;
  const sceneR = state.radiusM * state.pxPerM; // view radius in basemap px
  const side = radius * 2;
  const ox = c - radius;
  const oy = c - radius;

  // Disc ground — only when there's no basemap yet: a late/failed load then
  // still reads as a HUD, not a hole in the overlay. When the basemap is
  // present it covers this anyway, so skip the extra fill.
  if (!state.basemap) {
    ctx.fillStyle = alpha(COLORS.bg, Math.max(state.opacity, 0.55));
    ctx.fillRect(ox, oy, side, side);
  }

  if (state.basemap) {
    const ms = state.miniScale;
    // Physical-pixel crop canvas so the blit stays 1:1 on HiDPI.
    const scale = (window.devicePixelRatio || 1) * (state.hudScale || 1);
    const bw = Math.max(1, Math.round(side * scale));
    // Re-crop only when the source region or output size actually changed —
    // a heading ease / HP pulse leaves pos.px|py and the zoom untouched.
    const key = `${Math.round(pos.px)}|${Math.round(pos.py)}|${state.radiusM}|${state.pxPerM}|${ms}|${bw}`;
    if (!bgCache || bgCache.bmp !== state.basemap || bgCache.key !== key || bgCache.canvas.width !== bw) {
      const cv = bgCache?.canvas ?? document.createElement("canvas");
      cv.width = bw;
      cv.height = bw;
      const bx = cv.getContext("2d");
      if (bx) {
        bx.imageSmoothingEnabled = true;
        bx.imageSmoothingQuality = "high";
        bx.clearRect(0, 0, bw, bw);
        bx.drawImage(
          state.basemap,
          (pos.px - sceneR) * ms,
          (pos.py - sceneR) * ms,
          sceneR * 2 * ms,
          sceneR * 2 * ms,
          0,
          0,
          bw,
          bw,
        );
        bgCache = { key, bmp: state.basemap, canvas: cv };
        bgRecrops++;
      }
    }
    if (bgCache) {
      ctx.globalAlpha = state.opacity;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bgCache.canvas, ox, oy, side, side);
      ctx.globalAlpha = 1;
    }
  }

  const toWidget = (sx: number, sy: number): [number, number] => [
    ox + ((sx - (pos.px - sceneR)) / (sceneR * 2)) * side,
    oy + ((sy - (pos.py - sceneR)) / (sceneR * 2)) * side,
  ];

  // Fog-of-war: faint tint on visited cells, over the basemap, under
  // everything else.
  if (state.showExplored) {
    ctx.fillStyle = "rgba(232, 163, 61, 0.10)";
    for (const [l, t, r, b] of state.explored) {
      const [x1, y1] = toWidget(l, t);
      const [x2, y2] = toWidget(r, b);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
  }

  // Fresh-water overlay: stretched over its px bounds, over the basemap and
  // under the trail/POIs. The disc clip is already active.
  if (state.showFreshwater && state.freshwater) {
    const fw = state.freshwater;
    const [dx1, dy1] = toWidget(fw.x, fw.y);
    const [dx2, dy2] = toWidget(fw.x + fw.w, fw.y + fw.h);
    ctx.globalAlpha = state.opacity;
    ctx.drawImage(fw.bitmap, dx1, dy1, dx2 - dx1, dy2 - dy1);
    ctx.globalAlpha = 1;
  }

  // Trail — the stretch nearer the player is bright; the older half fades
  // back. Two strokes per segment keeps it cheap (the user runs this beside
  // the game for hours).
  if (state.showTrail) {
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const seg of state.trailPx) {
      if (seg.length < 2) continue;
      const mid = Math.max(1, Math.floor(seg.length / 2));
      for (const [from, to, alpha] of [
        [0, mid, 0.28],
        [mid - 1, seg.length - 1, 0.82],
      ] as const) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        const [sx, sy] = toWidget(seg[from][0], seg[from][1]);
        ctx.moveTo(sx, sy);
        for (let i = from + 1; i <= to; i++) {
          const [x, y] = toWidget(seg[i][0], seg[i][1]);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // POI dots, distance-filtered (in metres, straight from cm).
  const limitM = state.radiusM * POI_MARGIN;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.59)";
  ctx.lineWidth = 1;
  for (const poi of state.pois) {
    const distM = Math.hypot(poi.xCm - pos.xCm, poi.yCm - pos.yCm) / 100;
    if (distM > limitM) continue;
    const [x, y] = toWidget(poi.px, poi.py);
    if (poi.glyph) {
      // Species "logo" — colour emoji ignores fillStyle.
      ctx.font = `13px ${FONT_EMOJI}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(poi.glyph, x, y);
      continue;
    }
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = poi.color;
    ctx.fill();
    ctx.stroke();
  }

  // Waypoints: user colour + WHITE ring, so they never read as POI dots
  // (those carry a dark ring).
  if (state.showWaypoints) {
    for (const wp of state.waypoints) {
      const distM = Math.hypot(wp.xCm - pos.xCm, wp.yCm - pos.yCm) / 100;
      if (distM > limitM) continue;
      const [x, y] = toWidget(wp.px, wp.py);
      if (wp.glyph) {
        // Icon pins (💀 🏠 💧 …) draw as the icon itself.
        ctx.font = `14px ${FONT_EMOJI}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(wp.glyph, x, y);
        continue;
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = wp.color ?? COLORS.waypoint;
      ctx.fill();
      ctx.stroke();
    }
  }

  // Party members: a diamond + a short name tag, so they read as neither a
  // POI dot nor a waypoint. The G6 relay carries HP — the diamond takes the
  // same green/amber/red bands as the dino panel, and a low-HP member gets a
  // pulsing ring so "someone is in trouble" reads at a glance. F7 markers
  // have no HP and stay the neutral pink.
  for (const p of state.party) {
    const distM = Math.hypot(p.xCm - pos.xCm, p.yCm - pos.yCm) / 100;
    if (distM > limitM) continue;
    const [x, y] = toWidget(p.px, p.py);
    const hp = p.hp ?? null;
    const color = hp === null ? COLORS.party : hpBand(hp / 100);

    if (hp !== null && hp <= 25) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(SEM.danger, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(x, y - 4.5);
    ctx.lineTo(x + 4.5, y);
    ctx.lineTo(x, y + 4.5);
    ctx.lineTo(x - 4.5, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    const short = p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label;
    ctx.font = `9px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillText(short, x + 1, y - 5);
    ctx.fillStyle = color;
    ctx.fillText(short, x, y - 6);
  }

  // A5 — "predator seen" pings from the team: a translucent danger halo + a
  // double ring + name, held ~3 min and fading with age. Drawn even off the
  // disc edge so a ping just outside the view still registers.
  const nowMs = Date.now();
  for (const ping of state.pings) {
    const k = Math.max(0, 1 - (nowMs - ping.atMs) / PREDATOR_ALERT_MS); // 1 -> 0 over the window
    const [x, y] = toWidget(ping.px, ping.py);
    const halo = Math.min(radius * 0.85, 52);
    ctx.beginPath();
    ctx.arc(x, y, halo, 0, Math.PI * 2);
    ctx.fillStyle = alpha(SEM.danger, 0.13 * k);
    ctx.fill();
    ctx.strokeStyle = alpha(SEM.danger, 0.35 * k);
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const r of [10, 6]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = alpha("#ff5a5a", (r === 10 ? 0.55 : 1) * Math.max(k, 0.35));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = `700 10px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.globalAlpha = Math.max(k, 0.4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillText(`⚠ ${ping.from}`, x + 1, y - halo + 1);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillText(`⚠ ${ping.from}`, x, y - halo);
    ctx.globalAlpha = 1;
  }
}

/** A5 — how long a team contact ping stays on the maps as a "danger zone".
 *  Mirror in src/minimap/main.ts and src/main/fullmap/FullMap.svelte. */
export const PREDATOR_ALERT_MS = 180_000;

/** Rim arrow + distance toward the closest waypoint OUTSIDE the view radius
 * (inside it, its dot is already visible). North is always up, so the screen
 * angle IS the compass bearing. */
export function drawWaypointArrow(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
  headingRad = 0,
): void {
  const wp = state.nearestWaypoint;
  if (!state.showWaypoints || !wp || !state.position) return;
  if (wp.distanceM <= state.radiusM) return;
  const color = wp.color ?? COLORS.waypoint;
  const rad = ((wp.bearingDeg - 90) * Math.PI) / 180 - headingRad;
  const ax = c + (radius - 9) * Math.cos(rad);
  const ay = c + (radius - 9) * Math.sin(rad);

  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.translate(ax, ay);
  ctx.rotate(rad + Math.PI / 2); // triangle drawn tip-up, rotate onto bearing
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Distance label just inside the arrow, with the compass-letter shadow
  // trick. Icon pins prefix their icon: "💧 850 m" says what you're chasing.
  const distText =
    wp.distanceM >= 1000 ? `${(wp.distanceM / 1000).toFixed(1)} km` : `${Math.round(wp.distanceM)} m`;
  const dist = wp.glyph ? `${wp.glyph} ${distText}` : distText;
  const tx = c + (radius - 24) * Math.cos(rad);
  const ty = c + (radius - 24) * Math.sin(rad);
  ctx.font = `700 10px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = state.opacity;
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillText(dist, tx + 1, ty + 1);
  ctx.fillStyle = color;
  ctx.fillText(dist, tx, ty);
  ctx.globalAlpha = 1;
}

function drawCompass(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
  headingRad = 0,
): void {
  // Four letters around the disc. No ring, no ticks: each letter gets a
  // 1 px offset shadow instead — enough to separate it from bright terrain
  // without drawing any outline.
  ctx.font = `700 13px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelR = radius + LABEL_MARGIN / 2 + 2;
  ctx.globalAlpha = state.opacity;
  const angles = [0, 90, 180, 270];
  for (let i = 0; i < 4; i++) {
    const rad = ((angles[i] - 90) * Math.PI) / 180 - headingRad;
    const x = c + labelR * Math.cos(rad);
    const y = c + labelR * Math.sin(rad);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillText(state.compassLetters[i], x + 1, y + 1);
    // North in the accent colour so a glance finds it.
    ctx.fillStyle = angles[i] === 0 ? COLORS.accent : COLORS.text;
    ctx.fillText(state.compassLetters[i], x, y);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  c: number,
  headingRad: number,
  hdg: number | null,
): void {
  // Heading-up mode already rotated the map to face travel: the dart then
  // points straight up (0°). Otherwise it points along the (eased) heading.
  const heading = headingRad ? 0 : hdg;

  ctx.beginPath();
  ctx.arc(c, c, 13, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerHalo;
  ctx.fill();

  if (heading !== null) {
    // Compass bearing 0 = north = up; canvas rotate() is clockwise in
    // y-down coordinates, so the bearing maps 1:1. Dart shape (tip ahead,
    // notched tail) centred on the player.
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(9, 11);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 11);
    ctx.closePath();
    ctx.lineJoin = "round";
    ctx.strokeStyle = COLORS.playerArrowOutline;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.playerArrow;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  } else {
    // Heading unknown: a plain disc implies no direction (the pill below
    // says why); same yellow + double outline keeps it unmistakably "you".
    ctx.beginPath();
    ctx.arc(c, c, 7, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.playerArrowOutline;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.playerArrow;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawHeadingPill(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  c: number,
  radius: number,
): void {
  const known = state.headingLabel !== "";
  const text = known ? state.headingLabel : state.headingUnknown;
  ctx.font = `600 12px ${FONT_MONO}`;
  const w = ctx.measureText(text).width + 16;
  const h = 20;
  const x = c - w / 2;
  const y = c + radius * 0.52;

  ctx.globalAlpha = state.opacity;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.67)";
  ctx.fill();
  ctx.fillStyle = known ? COLORS.accent : COLORS.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, c, y + h / 2 + 0.5);
  ctx.globalAlpha = 1;
}

/** A vital bar: darker track, quarter ticks, fill with a top-lit vertical
 *  gradient and a 1 px highlight lip. Reads as a gauge, not a flat rectangle.
 *  `pulse` (0..1) fades the fill for the critical-HP heartbeat. */
function drawStatBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  cur: number | null,
  max: number | null,
  color: string,
  pulse = 1,
): void {
  const bh = 8;
  const r = bh / 2;
  ctx.beginPath();
  ctx.roundRect(x, y - r, w, bh, r);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  // Quarter ticks on the track.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
  ctx.lineWidth = 1;
  for (let q = 1; q <= 3; q++) {
    const tx = x + (w * q) / 4;
    ctx.beginPath();
    ctx.moveTo(tx, y - r + 1.5);
    ctx.lineTo(tx, y + r - 1.5);
    ctx.stroke();
  }
  if (cur === null || !max) return;
  const frac = Math.max(0, Math.min(1, cur / max));
  if (frac <= 0) return;
  const fw = Math.max(w * frac, bh);
  ctx.save();
  ctx.globalAlpha *= pulse;
  const g = ctx.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, color);
  g.addColorStop(1, alpha(color, 0.7));
  ctx.beginPath();
  ctx.roundRect(x, y - r, fw, bh, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + 1, y - r + 0.6, fw - 2, 1.4, 0.7);
  ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
  ctx.fill();
  ctx.restore();
}

/** Tiny filled HUD glyphs, replacing the mixed emoji. `cx,cy` centre; `r` ~ 6. */
function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: "heart" | "leaf" | "drop" | "bolt",
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  if (kind === "heart") {
    ctx.moveTo(0, r * 0.82);
    ctx.bezierCurveTo(-r * 1.3, -r * 0.15, -r * 0.5, -r * 1.05, 0, -r * 0.32);
    ctx.bezierCurveTo(r * 0.5, -r * 1.05, r * 1.3, -r * 0.15, 0, r * 0.82);
  } else if (kind === "drop") {
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r, -r * 0.05, r * 0.78, r, 0, r);
    ctx.bezierCurveTo(-r * 0.78, r, -r, -r * 0.05, 0, -r);
  } else if (kind === "leaf") {
    ctx.moveTo(-r * 0.85, r * 0.85);
    ctx.quadraticCurveTo(-r * 1.05, -r * 1.05, r * 0.85, -r * 0.85);
    ctx.quadraticCurveTo(r * 1.05, r * 1.05, -r * 0.85, r * 0.85);
  } else {
    ctx.moveTo(r * 0.2, -r);
    ctx.lineTo(-r * 0.7, r * 0.12);
    ctx.lineTo(-r * 0.05, r * 0.12);
    ctx.lineTo(-r * 0.2, r);
    ctx.lineTo(r * 0.7, -r * 0.12);
    ctx.lineTo(r * 0.05, -r * 0.12);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** A compact HUD chip — tinted rounded fill, hairline border, optional leading
 *  dot, mono-caps label. The in-game echo of the app's Pill atom. `x` is the
 *  left edge, `cy` the vertical centre; returns the x just past the chip. */
function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  label: string,
  color: string,
  dot?: string,
): number {
  ctx.font = `700 8.5px ${FONT_MONO}`;
  ctx.textBaseline = "middle";
  const padX = 5;
  const dotGap = dot ? 8 : 0;
  const w = padX * 2 + dotGap + ctx.measureText(label).width;
  const chH = 14;
  ctx.beginPath();
  ctx.roundRect(x, cy - chH / 2, w, chH, 4);
  ctx.fillStyle = alpha(color, 0.14);
  ctx.fill();
  ctx.strokeStyle = alpha(color, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  let tx = x + padX;
  if (dot) {
    ctx.beginPath();
    ctx.arc(x + padX + 2, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
    tx += dotGap;
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillText(label, tx + 0.6, cy + 1);
  ctx.fillStyle = color;
  ctx.fillText(label, tx, cy);
  return x + w;
}

/** Prime chip, right-aligned to `rightEdge`: "PRIME 4/19" in amber while in
 *  progress; "PRIME ✦" in biolum once eligible (or every quest done) — the
 *  same signal the app's "Prime progress ✦" pill carries. */
function drawPrimeChip(
  ctx: CanvasRenderingContext2D,
  rightEdge: number,
  cy: number,
  done: number,
  total: number,
  eligible: boolean,
): void {
  const ready = eligible || (total > 0 && done >= total);
  const accent = ready ? COLORS.biolum : COLORS.accent;
  const label = "PRIME";
  const value = ready ? "✦" : `${done}/${total}`;
  ctx.font = `700 8.5px ${FONT_MONO}`;
  ctx.textBaseline = "middle";
  const padX = 5;
  const gap = 4;
  const lw = ctx.measureText(label).width;
  const vw = ctx.measureText(value).width;
  const w = padX * 2 + lw + gap + vw;
  const chH = 14;
  const x = rightEdge - w;
  ctx.beginPath();
  ctx.roundRect(x, cy - chH / 2, w, chH, 4);
  ctx.fillStyle = alpha(accent, ready ? 0.16 : 0.12);
  ctx.fill();
  ctx.strokeStyle = alpha(accent, 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillText(label, x + padX + 0.6, cy + 1);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(label, x + padX, cy);
  const vx = x + padX + lw + gap;
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillText(value, vx + 0.6, cy + 1);
  ctx.fillStyle = accent;
  ctx.fillText(value, vx, cy);
}

/// "Your dino" strip: an accent-striped obsidian card. An identity line (name
/// · sex), a chip row (live status · Prime), then one row per vital (glyph ·
/// gauge · bold readout), then growth as its own gauge under a hairline, then
/// (token mode) a one-line "eat next" nutrition hint.
function drawDinoPanel(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  size: number,
  top: number,
): void {
  const h = state.panelH - 4;
  const cardX = 4;
  const cardW = size - 8;
  const padL = 13;
  const rightX = cardX + cardW - 8;
  ctx.save();
  ctx.globalAlpha = Math.max(state.opacity, 0.6);

  drawCard(ctx, cardX, top, cardW, h);
  ctx.beginPath();
  ctx.roundRect(cardX + 2, top + 5, 2.5, h - 10, 1.5);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();

  ctx.textBaseline = "middle";
  const dino = state.dino;
  if (!dino) {
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.textAlign = "center";
    shadowText(ctx, "…", size / 2, top + h / 2, COLORS.textMuted);
    ctx.restore();
    return;
  }

  // Identity line: name + a tinted ♀/♂ so sex reads without decoding text.
  const idY = top + 12;
  ctx.textAlign = "left";
  ctx.font = `600 11px ${FONT_SANS}`;
  const name = dino.name && dino.name.trim() ? dino.name.trim() : "KHỦNG LONG";
  shadowText(ctx, truncate(ctx, name, cardW - 46), padL, idY, COLORS.text);
  if (dino.female !== null) {
    ctx.textAlign = "right";
    ctx.font = `700 12px ${FONT_MONO}`;
    shadowText(ctx, dino.female ? "♀" : "♂", rightX, idY, dino.female ? "#e491bd" : "#7fb0e0");
  }

  // Chip row — the two things you'd otherwise Alt-Tab to the app for: your
  // live-tracking status (left) and Prime progress / readiness (right).
  const chipY = idY + 15;
  if (dino.online !== null) {
    const col = dino.online ? COLORS.biolum : COLORS.blood;
    drawChip(ctx, padL, chipY, dino.online ? state.onlineLabel : state.offlineLabel, col, col);
  }
  const primeTotal = state.quests.length;
  if (primeTotal > 0 || dino.primeEligible === true) {
    const primeDone = state.quests.filter((q) => q.completed).length;
    drawPrimeChip(ctx, rightX, chipY, primeDone, primeTotal, dino.primeEligible === true);
  }

  ctx.strokeStyle = alpha(COLORS.edge, 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, chipY + 9);
  ctx.lineTo(rightX, chipY + 9);
  ctx.stroke();

  const frac = (b: { current: number | null; max: number | null }) =>
    b.current !== null && b.max ? b.current / b.max : null;
  const rows: {
    glyph: "heart" | "leaf" | "drop" | "bolt";
    cur: number | null;
    max: number | null;
    color: string;
    hp?: boolean;
  }[] = [
    { glyph: "heart", cur: dino.hp.current, max: dino.hp.max, color: hpBand(frac(dino.hp)), hp: true },
    { glyph: "leaf", cur: dino.hunger.current, max: dino.hunger.max, color: "#e8a33d" },
    { glyph: "drop", cur: dino.thirst.current, max: dino.thirst.max, color: "#4aa8d8" },
    ...(dino.stamina
      ? [
          {
            glyph: "bolt" as const,
            cur: dino.stamina.current,
            max: dino.stamina.max,
            color: "#a78bfa",
          },
        ]
      : []),
  ];

  const barX = padL + 15;
  const barW = rightX - barX - 46;
  const rowH = 16;
  const vitalsTop = chipY + 13;

  const hpFrac = frac(dino.hp);
  const critical = hpFrac !== null && hpFrac < 0.15;
  const pulse = critical ? 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 260)) : 1;
  if (critical) hudAnimating = true;

  rows.forEach((row, i) => {
    const y = vitalsTop + i * rowH + rowH / 2;
    drawGlyph(ctx, row.glyph, padL + 6, y, 6, row.hp ? row.color : alpha(row.color, 0.9));
    drawStatBar(ctx, barX, y, barW, row.cur, row.max, row.color, row.hp ? pulse : 1);
    ctx.textAlign = "right";
    ctx.font = `700 11px ${FONT_MONO}`;
    shadowText(
      ctx,
      row.cur !== null && row.max !== null ? `${Math.round(row.cur)}/${Math.round(row.max)}` : "—",
      rightX,
      y,
      row.hp && critical ? SEM.danger : COLORS.text,
    );
  });

  // Growth as its own gauge under a hairline.
  const gy = vitalsTop + rows.length * rowH + 8;
  ctx.strokeStyle = alpha(COLORS.edge, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, gy - 9);
  ctx.lineTo(rightX, gy - 9);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.font = `700 9px ${FONT_MONO}`;
  shadowText(ctx, "GROWTH", padL, gy, COLORS.textMuted);
  drawStatBar(ctx, padL + 52, gy, rightX - (padL + 52) - 74, dino.growthPct, 100, COLORS.accent);
  ctx.textAlign = "right";
  ctx.font = `700 11px ${FONT_MONO}`;
  const gp = dino.growthPct !== null ? `${Math.round(dino.growthPct)}%` : "—";
  let etaSuffix = "";
  if (
    state.dinoEtaAdultMin !== null &&
    state.dinoEtaAdultMin > 0 &&
    (dino.growthPct === null || dino.growthPct < 100)
  ) {
    const m = state.dinoEtaAdultMin;
    etaSuffix = m >= 90 ? `  →${(m / 60).toFixed(1)}h` : `  →${Math.round(m)}m`;
  }
  shadowText(ctx, gp, rightX, gy, COLORS.accent);
  if (etaSuffix) {
    const gw = ctx.measureText(gp).width;
    ctx.font = `9px ${FONT_MONO}`;
    shadowText(ctx, etaSuffix.trim(), rightX - gw - 4, gy + 0.5, COLORS.textMuted);
  }

  // "Eat next" — the lowest of Carb/Protein/Lipid, with a diet-aware hint.
  // Rust sizes the card for this row (last_has_nutrition), so it is safe to
  // draw whenever the payload carries nutrition.
  if (dino.nutrition) {
    const N = state.nutri;
    const ny = gy + 15;
    ctx.strokeStyle = alpha(COLORS.edge, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, ny - 9);
    ctx.lineTo(rightX, ny - 9);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = `700 9px ${FONT_MONO}`;
    shadowText(ctx, N.label, padL, ny, COLORS.textMuted);

    const items = [
      { k: "carb" as const, v: dino.nutrition.carb },
      { k: "protein" as const, v: dino.nutrition.protein },
      { k: "lipid" as const, v: dino.nutrition.lipid },
    ];
    const low = [...items].sort((a, b) => a.v - b.v)[0];
    ctx.textAlign = "right";
    if (low.v >= 20) {
      ctx.font = `700 9px ${FONT_MONO}`;
      shadowText(ctx, N.ok, rightX, ny, COLORS.moss);
    } else {
      const entry = dietEntry(dino.name);
      let hint: string;
      if (entry.diet === "herb") {
        hint = entry.plants?.length ? entry.plants.join(", ") : N.herb;
      } else if (entry.diet === "carn") {
        hint = low.k === "carb" ? N.hint.carnCarb : low.k === "protein" ? N.hint.carnProt : N.hint.carnLip;
      } else {
        hint = low.k === "carb" ? N.hint.omniCarb : low.k === "protein" ? N.hint.omniProt : N.hint.omniLip;
      }
      ctx.font = `10px ${FONT_SANS}`;
      const text = truncate(ctx, `${N.short[low.k]} ${Math.round(low.v)}% · ${hint}`, rightX - padL - 46);
      shadowText(ctx, text, rightX, ny, COLORS.blood);
    }
  }
  ctx.restore();
}

/// Prime-quests card under the stats strip (or directly under the disc when
/// the strip is off). Same backing-card language as drawDinoPanel; one line
/// per quest, ellipsised — 10 rows must stay glanceable, not a wall of text.
function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  size: number,
  top: number,
): void {
  const h = state.questsH - 4;
  const cardX = 4;
  const cardW = size - 8;
  ctx.save();
  ctx.globalAlpha = Math.max(state.opacity, 0.6);

  drawCard(ctx, cardX, top, cardW, h);
  ctx.beginPath();
  ctx.roundRect(cardX + 2, top + 5, 2.5, h - 10, 1.5);
  ctx.fillStyle = COLORS.accent;
  ctx.fill();

  const total = state.quests.length;
  const done = state.quests.filter((q) => q.completed).length;
  const padL = 13;
  const rightX = cardX + cardW - 8;
  ctx.textBaseline = "middle";

  // Header: "PRIME" caps + count + a thin progress bar spanning the card.
  const hy = top + 3 + QUEST_HEADER_H / 2;
  ctx.textAlign = "left";
  ctx.font = `700 9px ${FONT_MONO}`;
  shadowText(ctx, "PRIME", padL, hy - 3, COLORS.textMuted);
  ctx.textAlign = "right";
  ctx.font = `700 10px ${FONT_MONO}`;
  shadowText(ctx, `${done}/${total}`, rightX, hy - 3, COLORS.accent);
  const pbY = hy + 6;
  ctx.beginPath();
  ctx.roundRect(padL, pbY, rightX - padL, 3, 1.5);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  if (total > 0 && done > 0) {
    ctx.beginPath();
    ctx.roundRect(padL, pbY, (rightX - padL) * (done / total), 3, 1.5);
    ctx.fillStyle = COLORS.accent;
    ctx.fill();
  }

  // Unfinished first, capped at QUEST_MAX_ROWS — a 19-quest list is a wall of
  // tiny text; the done ones only need the header count. minimap.rs caps the
  // panel height to match.
  const shown = [...state.quests]
    .sort((a, b) => Number(a.completed) - Number(b.completed))
    .slice(0, QUEST_MAX_ROWS);
  const maxW = rightX - (padL + 14);
  ctx.font = `10px ${FONT_SANS}`;
  shown.forEach((quest, i) => {
    const y = top + 4 + QUEST_HEADER_H + i * QUEST_ROW_H + QUEST_ROW_H / 2;
    ctx.textAlign = "left";
    shadowText(
      ctx,
      quest.completed ? "✓" : "○",
      padL,
      y,
      quest.completed ? SEM.ok : COLORS.textMuted,
    );
    const text = state.questLang === "vi" ? (quest.textVi ?? quest.text) : quest.text;
    shadowText(
      ctx,
      truncate(ctx, text, maxW),
      padL + 14,
      y,
      quest.completed ? alpha(SEM.ok, 0.85) : COLORS.text,
    );
  });
  ctx.restore();
}

/// Teammate-stats strip (G6): one row per teammate — name + thin HP / hunger
/// / thirst bars — under the quest card. Same backing-card language. Kept
/// compact so a full 10-person team still reads at a glance in combat.
function drawTeamPanel(
  ctx: CanvasRenderingContext2D,
  state: MinimapState,
  size: number,
  top: number,
): void {
  const h = state.teamH - 4;
  ctx.save();
  ctx.globalAlpha = Math.max(state.opacity, 0.6);

  const cardX = 4;
  const cardW = size - 8;
  const padL = 13;
  drawCard(ctx, cardX, top, cardW, h);
  ctx.beginPath();
  ctx.roundRect(cardX + 2, top + 5, 2.5, h - 10, 1.5);
  ctx.fillStyle = COLORS.party;
  ctx.fill();

  ctx.font = `700 9px ${FONT_MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  shadowText(ctx, "ĐỘI", padL, top + 4 + TEAM_HEADER_H / 2, COLORS.textMuted);
  ctx.textAlign = "right";
  ctx.font = `700 10px ${FONT_MONO}`;
  shadowText(ctx, `${state.team.length}`, cardX + cardW - 8, top + 4 + TEAM_HEADER_H / 2, COLORS.party);

  const nameW = 58;
  const barX = padL + nameW + 4;
  const barW = cardX + cardW - 8 - barX;
  const segW = (barW - 8) / 3;

  state.team.forEach((m, i) => {
    const rowTop = top + 4 + TEAM_HEADER_H + i * TEAM_ROW_H;
    const midY = rowTop + TEAM_ROW_H / 2;

    ctx.globalAlpha = m.online ? Math.max(state.opacity, 0.6) : 0.32;
    ctx.textAlign = "left";
    ctx.font = `10px ${FONT_SANS}`;
    shadowText(ctx, truncate(ctx, m.name, nameW), padL, midY, COLORS.text);

    const bars: [number | null, string][] = [
      [m.hp, SEM.ok],
      [m.hunger, "#e8a33d"],
      [m.thirst, "#4aa8d8"],
    ];
    bars.forEach(([val, col], b) => {
      const bx = barX + b * (segW + 4);
      const frac = val !== null ? Math.max(0, Math.min(1, val / 100)) : null;
      drawStatBar(
        ctx,
        bx,
        midY,
        segW,
        frac,
        frac === null ? null : 1,
        b === 0 && frac !== null ? hpBand(frac) : col,
      );
    });
  });
  ctx.restore();
}

/** The Amber "obsidian panel": token ground + a hairline edge. Shared by the
 *  dino / quest / team strips so they read as one material. Near-opaque so the
 *  small text survives a bright sunlit scene behind it. */
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fillStyle = alpha(COLORS.bg, 0.92);
  ctx.fill();
  ctx.strokeStyle = alpha(COLORS.edge, 0.95);
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** fillText with a 1 px dark drop — HUD text has to read over jungle canopy,
 *  snow and open water alike. Cheaper + sharper than canvas shadowBlur. */
function shadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fillText(text, x + 0.7, y + 1);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Single-line ellipsis via measureText — canvas has no text-overflow. */
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) {
    t = t.slice(0, -1);
  }
  return `${t.trimEnd()}…`;
}

function drawHint(
  ctx: CanvasRenderingContext2D,
  c: number,
  radius: number,
  hint: string,
): void {
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `12px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Simple greedy word wrap inside the disc.
  const maxWidth = radius * 2 - 44;
  const words = hint.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  const lineH = 16;
  const y0 = c - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, c, y0 + i * lineH));
}
