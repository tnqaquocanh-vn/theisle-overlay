// Injected into the page before any app code: `page.addInitScript(tauriMockInit, overrides)`.
// Stubs the Tauri v2 IPC surface with canned, render-stable data so the Svelte
// shell mounts without a Tauri runtime. `overrides.settings` deep-ish merges
// onto the default settings; `overrides.canned` replaces whole command results.
//
// Keep this self-contained (Playwright serialises the function) — no imports,
// no outer-scope references.

export interface MockOverrides {
  settings?: Record<string, unknown>;
  canned?: Record<string, unknown>;
  /** Serve a generated 512×512 four-quadrant PNG for the minimap basemap
   *  (fetch of "__mockbasemap__.png"), so the disc's basemap + crop-cache
   *  path is exercised. Pair with canned.get_basemap_paths. */
  basemap?: boolean;
  /** Make the MAIN map actually render: App shows the map tab (data_status all
   *  true) and FullMap mounts a real Leaflet instance over a generated
   *  basemap ("__mockfullmap__.png"). Supplies complete get_map_info geometry
   *  and the FullMap onMount deps (quest_targets, islepilot_overlay_map, …).
   *  Specs can still override any of it via `canned` / `settings`. */
  fullmap?: boolean;
}

export const tauriMockInit = (overrides: MockOverrides = {}) => {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown> | undefined) => {
    if (!b) return a;
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] =
        v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object"
          ? merge(out[k] as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };

  const settings = merge(
    {
      language: "vi",
      onboarding_done: true, // returning user — the first-run wizard is done
      minimap: {
        visible: true,
        size_px: 260,
        opacity: 0.85,
        radius_m: 600,
        hud_scale: 1,
        corner: "top-left",
        show_team_panel: true,
        basemap_px: 2600,
      },
      layers: {},
      color_profile: "default",
      islepilot: { enabled: false, history_enabled: false, alerts: {} },
      map: { basemap: "vulnona" },
      hotkeys: {},
      team: { relay_base: "" },
      presets: [],
    },
    overrides.settings,
  );

  const cannedBase: Record<string, unknown> = {
    get_settings: settings,
    get_map_info: { imageWidthPx: 7800, pxPerMX: 0.7, source: "vulnona", overlays: [] },
    get_basemap_paths: { minimap: "", minimapDecodeWidth: null },
    minimap_layout: { panelH: 0, questsH: 0, teamH: 0 },
    get_current_position: null,
    get_current_trail: { segmentsPx: [] },
    get_previous_trail: { segmentsPx: [] },
    nearest_waypoint: null,
    get_explored: { cells: [] },
    get_pois_render: [],
    get_pois: [],
    list_waypoints: [],
    list_waypoints_px: [],
    list_routes: [],
    list_trails: [],
    quest_targets: [],
    islepilot_state: { loggedIn: false, lastUpdate: null },
    islepilot_overlay_map: null,
    dino_history: { etaAdultH: null },
    data_status: { basemapMinimap: false, basemapFullmap: false, ageDays: null },
    data_age_days: null,
    get_fullscreen_mode: 1,
    check_hotkey_available: true,
    team_status: { active: false, connected: false, code: "", name: "", members: 0, roster: [] },
  };

  if (overrides.fullmap) {
    Object.assign(cannedBase, {
      data_status: { basemapMinimap: true, basemapFullmap: true, pois: true, ageDays: 3 },
      data_age_days: 3,
      get_map_info: {
        imageWidthPx: 2000,
        imageHeightPx: 2000,
        pxPerMX: 0.7,
        pxPerMY: 0.7,
        source: "vulnona",
        overlays: [],
      },
      get_basemap_paths: {
        minimap: "__mockbasemap__.png",
        fullmap: "__mockfullmap__.png",
        minimapDecodeWidth: null,
      },
    });
  }

  const CANNED: Record<string, unknown> = merge(cannedBase, overrides.canned);

  const invoke = (cmd: string) => {
    if (cmd in CANNED) return Promise.resolve(CANNED[cmd]);
    if (cmd === "plugin:event|listen") return Promise.resolve(1);
    if (cmd.startsWith("plugin:event|")) return Promise.resolve(null);
    return Promise.resolve(null);
  };

  if (overrides.basemap || overrides.fullmap) {
    const realFetch = window.fetch.bind(window);
    const genPng = (size: number) => {
      const oc = new OffscreenCanvas(size, size);
      const g = oc.getContext("2d") as OffscreenCanvasRenderingContext2D;
      const h = size / 2;
      const q: [number, number, string][] = [
        [0, 0, "#4a5a2a"],
        [h, 0, "#2a4a5a"],
        [0, h, "#5a2a4a"],
        [h, h, "#5a4a2a"],
      ];
      for (const [x, y, fill] of q) {
        g.fillStyle = fill;
        g.fillRect(x, y, h, h);
      }
      g.strokeStyle = "rgba(255,255,255,0.35)";
      const step = size / 16;
      for (let i = step; i < size; i += step) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, size);
        g.moveTo(0, i);
        g.lineTo(size, i);
        g.stroke();
      }
      return oc.convertToBlob({ type: "image/png" });
    };
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
      if (url.includes("__mockbasemap__")) {
        return genPng(512).then((blob) => new Response(blob, { status: 200 }));
      }
      if (url.includes("__mockfullmap__")) {
        return genPng(1024).then((blob) => new Response(blob, { status: 200 }));
      }
      return realFetch(input, init);
    }) as typeof window.fetch;
  }

  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke,
    transformCallback: (cb: unknown) => cb,
    unregisterCallback: () => {},
    convertFileSrc: (p: string) => p,
    ipc: () => {},
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main" } },
  };
};
