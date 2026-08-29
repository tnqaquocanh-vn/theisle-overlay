// Canvas / Leaflet colours. The ground/panel/text/accent roles come from the
// Amber token contract (src/lib/tokens.data.js) so the maps and the CSS never
// drift; the marker-specific hues below stay literal until the HUD redesign
// (v1.23) folds a full marker palette into the tokens.
import { tokens } from "./tokens";

const c = tokens.color.dark;

export const COLORS = {
  bg: c.ground,
  panel: c.panel,
  panelBorder: c.edge,
  text: c.ink,
  textMuted: c.inkMid,
  accent: c.amber,
  player: "#ff3b8b", // pink: collides with no terrain colour
  // Electric yellow + double outline: the self-marker must outrank every
  // waypoint/POI dot and never be mistaken for the (softer yellow) trail.
  playerArrow: "#ffe600",
  playerArrowOutline: "#10130c",
  trail: "#ffcc55",
  waypoint: "#4fc3f7",
} as const;

// Keys match pois_gateway.json layer keys (+ image-overlay layer keys).
export const LAYER_COLORS: Record<string, string> = {
  freshwater: "#149af2", // islemaps.com's own fresh-water blue
  water: "#4aa8d8",
  saltlick: "#d9a441",
  mudwallow: "#9c7b4f",
  sanctuary: "#a855f7",
  migration: "#72d653",
  food: "#e2664a",
  patrol: "#ef6f6c", // myislemap's original patrol colour
  animal: "#d66ba0", // islemaps.com AI spawn sightings
  region: "#eae6d6",
  landmark: "#cfc9b3",
  islepilot: "#34d399", // live server POIs from the IslePilot overlay API
};

// Deuteranopia-safe layer palette (Okabe–Ito based). The load-bearing fix is
// migration / patrol / food — green vs two reds in the default set, the exact
// hues deuteranopia can't tell apart. Here: bluish-green / yellow / vermillion.
const LAYER_COLORS_DEUT: Record<string, string> = {
  freshwater: "#56b4e9",
  water: "#0072b2",
  saltlick: "#e69f00",
  mudwallow: "#997950",
  sanctuary: "#cc79a7",
  migration: "#009e73",
  food: "#d55e00",
  patrol: "#f0e442",
  animal: "#9e6fb8",
  region: "#eae6d6",
  landmark: "#cfc9b3",
  islepilot: "#3fb6a8",
};

export type ColorProfile = "default" | "deuteranopia";

/** Layer colours for the active accessibility profile. */
export function layerColors(profile: ColorProfile | undefined): Record<string, string> {
  return profile === "deuteranopia" ? LAYER_COLORS_DEUT : LAYER_COLORS;
}

/**
 * Status colours (ok / warn / danger) for the active accessibility profile —
 * the canvas equivalent of the `--sem-*` CSS vars (A8). CSS surfaces read the
 * vars directly; the maps take hex from here.
 */
export function semanticColors(
  profile: ColorProfile | undefined,
): { ok: string; warn: string; danger: string } {
  return profile === "deuteranopia"
    ? tokens.semantic.deuteranopia
    : tokens.semantic.default;
}

// Draw order: image overlays lowest, big zones next, small dots after, text
// labels on top.
export const LAYER_ORDER = [
  "freshwater",
  "islepilot",
  "patrol",
  "migration",
  "sanctuary",
  "food",
  "water",
  "mudwallow",
  "saltlick",
  "animal",
  "landmark",
  "region",
];

// Waypoint icon presets (offered in the naming prompt). A waypoint whose
// name STARTS with one of these renders as that glyph on both maps instead
// of a colour dot — the name itself is the single source of truth, so the
// on-disk waypoint format stays byte-compatible.
export const WAYPOINT_GLYPHS = ["💀", "🏠", "💧", "⚠️", "🍖", "🥚"];

/** The glyph a waypoint renders as, or undefined for the plain colour dot. */
export function waypointGlyph(name: string): string | undefined {
  return WAYPOINT_GLYPHS.find((g) => name.startsWith(g));
}

// One recognisable glyph per animal species (labels from the islemaps
// sighting data). Rendered as text: Segoe UI Emoji covers all of these on
// Windows. Species without a glyph fall back to the layer-colour dot.
export const ANIMAL_GLYPHS: Record<string, string> = {
  Boar: "🐗",
  Bunny: "🐰",
  Chicken: "🐔",
  Crab: "🦀",
  Deer: "🦌",
  Frog: "🐸",
  Goat: "🐐",
  Teno: "🦕",
  Turtle: "🐢",
};

export const ZONE_FILL_OPACITY = 60 / 255;
export const ZONE_STROKE_OPACITY = 190 / 255;

export const POI_DOT_RADIUS = 5;
export const PLAYER_DOT_RADIUS = 7;
export const WAYPOINT_RADIUS = 6;

// Basemap geometry deliberately lives in Rust (get_map_info) — it varies with
// the selected basemap source, so no pixel constants belong here.
