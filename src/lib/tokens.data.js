// SINGLE SOURCE OF TRUTH for the "Amber" design language.
//
// Consumed by:
//   src/lib/tokens.ts        — typed re-export + the glide easing helper
//   scripts/gen-tokens.mjs   — writes src/lib/tokens.gen.css (never hand-edit that)
//   scripts/gen-tokens.mjs --check — CI gate: fails if tokens.gen.css has drifted
//
// Change a colour / scale / timing HERE and nowhere else, then run
//   node scripts/gen-tokens.mjs
//
// Plan: "Bản thiết kế Amber", chapter 02. The overlay is a game HUD companion,
// so it ships dark; `light` is complete and ready for the v1.24 main-window
// redesign but inert until something sets [data-theme="light"].

export const tokens = {
  color: {
    dark: {
      ground: "#0c0f0a", // obsidian, olive-biased near-black — HUD / window ground
      panel: "#14180f",
      panel2: "#1b2012",
      edge: "#313a22",
      edgeSoft: "#262d19",
      ink: "#ece6d2", // bone — primary text on dark
      inkMid: "#b4ac8f",
      inkMute: "#7e805f",
      amber: "#e3a63c", // resin — the single accent: "you / now"
      amberLine: "#7b5c22",
      biolum: "#5cd6bf", // swamp-glow — "live / linked", used sparingly
      blood: "#d9604a", // danger / low / lost
      moss: "#8cb85f", // ok / growth / done
    },
    light: {
      ground: "#f3efe1", // bleached bone
      panel: "#fcfaf0",
      panel2: "#ece7d3",
      edge: "#d9d2b8",
      edgeSoft: "#e6e0c9",
      ink: "#22261a",
      inkMid: "#53573b",
      inkMute: "#777a58",
      amber: "#9a6712",
      amberLine: "#b7863a",
      biolum: "#196f61",
      blood: "#a23c26",
      moss: "#55802f",
    },
    // A9 skins — alternate dark grounds selectable in Settings (data-skin on
    // <html>). `dark` above is the default "Obsidian"; these two shift the
    // whole ground while keeping amber recognisable as the accent.
    bonefield: {
      ground: "#100e0a", // warm brown-olive near-black — sun-baked earth
      panel: "#1a160f",
      panel2: "#241e14",
      edge: "#40331f",
      edgeSoft: "#2f2617",
      ink: "#f2ead6", // warm ivory
      inkMid: "#c3ac82",
      inkMute: "#8c7a54",
      amber: "#e8a63a",
      amberLine: "#8c6420",
      biolum: "#74cf9a", // warm green rather than teal
      blood: "#dd6644",
      moss: "#a2c766",
    },
    biolum: {
      ground: "#070c0d", // blue-black — night swamp / cave
      panel: "#0d1618",
      panel2: "#142226",
      edge: "#23393d",
      edgeSoft: "#1a2b2e",
      ink: "#dbeeeb", // cool white
      inkMid: "#9dbcb7",
      inkMute: "#5e807b",
      amber: "#e6b658", // paler, cooler gold so the glow leads
      amberLine: "#6a5930",
      biolum: "#46e0cf", // bright saturated teal
      blood: "#e56a58",
      moss: "#7ec9a0",
    },
  },
  font: {
    display: '"Fraunces Variable", "Iowan Old Style", "Noto Serif", Georgia, serif',
    body: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, "Cascadia Code", Consolas, monospace',
  },
  // Status colour — "ok / warn / danger" — kept SEPARATE from the amber accent
  // (plan P4). Each profile is a full set so a stat bar reads at a glance for
  // every kind of vision. `deuteranopia` is Okabe–Ito based: the green-vs-red
  // pair the default set leans on is exactly what deuteranopia can't split, so
  // it swaps to teal / yellow / vermillion, which differ in lightness too.
  semantic: {
    default: { ok: "#8cb85f", warn: "#e3a63c", danger: "#d9604a" },
    deuteranopia: { ok: "#3fb6a8", warn: "#f0d048", danger: "#e0592e" },
  },
  motion: {
    /** milliseconds */
    dur: { micro: 120, toast: 160, panel: 180, map: 200, glide: 420 },
    ease: {
      out: "cubic-bezier(.2, .7, .2, 1)",
      inOut: "cubic-bezier(.4, 0, .2, 1)",
    },
  },
  /** px */
  radius: { xs: 4, sm: 6, md: 8, lg: 10, pill: 999 },
};
