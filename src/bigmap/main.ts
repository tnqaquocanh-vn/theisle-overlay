// In-game big map overlay entry (v1.25). A second Leaflet surface — the full
// map, reused from the main window — in its own always-on-top, non-activating
// overlay webview so a player can pull up the whole island without Alt-Tab and
// without the app EVER touching the game process. Toggled by Ctrl+Alt+G
// (RegisterHotKey in Rust); the window is anchored over the game's client area.
import { mount } from "svelte";
import "../app.css";

// Same bundled Amber typefaces as the main window (Vite dedupes the assets).
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
import BigMap from "./BigMap.svelte";

installGlobalErrorLog("bigmap");

const app = mount(BigMap, {
  target: document.getElementById("app")!,
});

export default app;
