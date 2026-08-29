// Typed entry point for the Amber design tokens. The values live in
// tokens.data.js (plain ESM so a Node script can read them too — see
// scripts/gen-tokens.mjs); this file adds types and the one behaviour token
// the canvas renderers share.

import { tokens } from "./tokens.data.js";

export { tokens };

export type AmberColorKey = keyof typeof tokens.color.dark;

/** A9 — selectable dark grounds. "obsidian" is `tokens.color.dark`. */
export const SKINS = ["obsidian", "bonefield", "biolum"] as const;
export type SkinKey = (typeof SKINS)[number];

/** The 13-role colour set for a skin — for the canvas renderers, which can't
 *  read CSS custom properties. `<html data-skin>` drives the DOM side. */
export function skinColors(skin: SkinKey | string | undefined): typeof tokens.color.dark {
  if (skin === "bonefield") return tokens.color.bonefield;
  if (skin === "biolum") return tokens.color.biolum;
  return tokens.color.dark;
}

/**
 * The ease-out curve the position tweens apply by hand (minimap self-marker,
 * party dots on both maps): `1 − (1 − t)²` for `t` in `[0, 1]`.
 */
export const glideK = (t: number): number => 1 - (1 - t) * (1 - t);
