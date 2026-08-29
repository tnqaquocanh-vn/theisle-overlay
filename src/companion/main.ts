// A7 — second-monitor companion entry (v1.27). A full dashboard (the shared
// <FullMap> + compact dino stats + team roster + Prime quests) in its own
// ordinary window, meant to live on a second screen while the in-game HUD
// stays minimal. Every value comes through the existing IPC + events — this
// webview adds no backend surface and never touches the game.
import { mount } from "svelte";
import "../app.css";

// Same bundled Amber typefaces as the other windows (Vite dedupes the assets).
import "@fontsource-variable/fraunces/opsz.css";
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
import Companion from "./Companion.svelte";

installGlobalErrorLog("companion");

const app = mount(Companion, {
  target: document.getElementById("app")!,
});

export default app;
