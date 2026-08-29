import { mount } from "svelte";
import "../app.css";

// Amber typefaces, bundled (no CDN — offline app). Fraunces for display,
// IBM Plex Sans for body, IBM Plex Mono for data/labels. latin + latin-ext +
// vietnamese subsets only; the browser lazy-loads per unicode-range. The
// minimap overlay bundle deliberately does NOT pull these — its canvas text
// stays on Segoe UI until the HUD redesign (v1.23).
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
import App from "./App.svelte";

installGlobalErrorLog("main");

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
