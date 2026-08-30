# Third-party notices

This build of **TheIsle Overlay** (maintained by BumBum) is a derivative work
and bundles or reimplements code and data from the projects below. Each is
credited here as required by its license. This file must ship with the
software and with any redistribution.

---

## 1. "TheIsle Overlay" — the project this is forked from

- Source: <https://github.com/toantranct/theisle-overlay>
- Author: Trần Quốc Toản
- License: **MIT** (as stated by the upstream project)

Most of the application shell, the map/minimap rendering, the IslePilot
integration and the build tooling originate here. If the upstream repo
publishes a `LICENSE` file, copy its exact copyright line into `LICENSE`.

## 2. IsleLiveMap — realtime WebSocket client

- Ported into `src-tauri/src/islepilot/realtime.rs`
  (`IslePilotOverlayWebSocket`, `IslePilotReconnectBackoff`).
- License: **MIT**, Copyright (c) IsleLiveMap contributors.

## 3. "TheIsleVN-Gacha-HUD" overlay — skin pipeline & 3D asset registry

- Author: YannikAufDie1 (the IslePilot overlay).
- `src/lib/dino3d/skin.ts` is a clean-room reimplementation of that app's
  CPU skin-compositing algorithm (zone recolour → TMC mask → RAC cavity →
  detail-normal blend). Algorithms are not copyrightable; this is documented
  for attribution and provenance.
- `src/lib/dino3d/registry.json` lists per-species asset URLs that resolve to
  IslePilot's **public** CDN (`https://islepilot.eu/cdn/skinviewer/…`). The
  overlay does not host or redistribute those assets — it fetches them on
  demand to the end user's machine.
- The in-game skin code format (`<Species><P><V><T><RGBA×5>`) is The Isle:
  Evrima's own export format, decoded from a real in-game export.

## 4. Fonts

- **Fraunces** — SIL Open Font License 1.1.
- **IBM Plex Sans / IBM Plex Mono** — SIL Open Font License 1.1.

## 5. Map data (fetched on first run, never bundled)

- Basemap: VulnonaMAP (Coco.N) — stitched from in-game captures.
- IsleMaps basemap + animal spawn points: islemaps.com (Pont & Emeara).
- POIs: myislemap.com, VulnonaMAP, wiredredman's Steam guide.
- All in-game imagery is **© Afterthought LLC** (The Isle). This project is
  unaffiliated with Afterthought LLC.

## 6. Rust / npm dependencies

The `Cargo.toml` and `package.json` dependency trees are covered by their own
licenses (predominantly MIT / Apache-2.0). Run `cargo about` /
`npx license-checker` to regenerate a full manifest.

Notable runtime crates: `tauri` (MIT/Apache-2.0), `tauri-plugin-*`
(MIT/Apache-2.0), `reqwest`, `tungstenite`, `serde`, `chrono`, `image`,
`windows` (MIT/Apache-2.0), `koffi`-free (this project uses none of the
upstream Electron overlay's native FFI).
