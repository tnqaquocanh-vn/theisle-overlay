# TheIsle Overlay

[Tiếng Việt](README.md) · **English**

Map overlay for **The Isle: Evrima** (Gateway map) — **built by BumBum**. A
comprehensive rewrite: a lean Rust + Tauri core (~4 MB installer), near-zero CPU
while playing, and a number of features not in the original.

- **Circular minimap** pinned to the game window, click-through so it never blocks play.
- **Full map** with POIs, place names, waypoints, travel trails, and **session replay** with a scrubber.
- **Your Dino** (growth, health/hunger/thirst/stamina, nutrition, Prime) + **Garage** with 3D preview + a **skin editor** that exports codes you paste straight into the game — via IslePilot, one Steam login **for every server**.
- **Companion window** for a second monitor · bilingual VI/EN interface · one-click install with auto-update.

![Minimap and dino stats over the running game](docs/screenshot-ingame.jpg)

## Contents

- [Features](#features)
- [Install](#install)
- [Connecting "Your Dino" (IslePilot)](#connecting-your-dino-islepilot)
- [Automatic position & Npcap](#automatic-position--npcap)
- [PRO / PRO VIP](#pro--pro-vip)
- [Anti-cheat safety](#anti-cheat-safety)
- [Things to know & troubleshooting](#things-to-know--troubleshooting)
- [How light is it?](#how-light-is-it)
- [Credits & licence](#credits--licence)
- [Contact & support](#contact--support)

## Features

![Full map with place names, player labels and POI layers](docs/screenshot-fullmap.png)

**Map**

- **Circular minimap** pinned to a corner of the game window, click-through, shown
  only while you're in the game. North stays up (rotate-with-heading is optional),
  an arrow shows your direction of travel, and a rim arrow points to the nearest
  waypoint.
- **Full map**: smooth zoom/pan, ~12 toggleable layers (fresh water, water, salt
  licks, mud wallows, sanctuaries, migration zones, AI patrols, food zones,
  animals with per-species icons 🐗🦌🐢, region names, landmarks, and a live
  **server POI** layer from IslePilot). Place names drawn directly on the map; a
  collapsible layer list and a clear-trail button to declutter mid-session.
- **3 basemap styles**: Vulnona captures (default) or the hand-drawn
  [IsleMaps](https://www.islemaps.com/) light/dark art (**PRO**) — applies to both
  maps. The IsleMaps art tracks a newer game build and shows the SE archipelago
  (Hell's Mouth).
- **Waypoints**: right-click to drop, rename/recolour, delete, quick icons
  (💀 death spot, 🏠 nest…). Import/export supported.
- **Search & navigation**: search places/waypoints by name, paste coordinates to
  jump there, follow mode with an edge arrow leading back to your position.
- **Travel trail & session replay**: recorded per session; scrub position + stats
  over time; restore the previous session's path; export to `.geojson`.

**Your Dino (IslePilot)**

- Growth, health, hunger, thirst, stamina, Carb/Protein/Lipid nutrition and Prime
  progress (with Vietnamese translation). Compact stats strip + Prime quest card
  under the minimap.
- **One Steam login works on every IslePilot server** — switch servers in game
  and the data follows.
- **Real-time updates (WebSocket)**, a stat history (growth/hunger/thirst charts
  with drain-time estimates), a hard-swap timer, and a **survival group** (share
  a 6-character code to see each other on the map on any server).
- **Garage (Gacha) with 3D preview**: each parked dino is a card with an orbitable
  3D model in its own skin colours, plus growth and Park/Restore/Rename/Sell/Slay.
  Models cache, opening instantly and offline afterwards.
- **Skin editor**: 10 colour channels + patterns, real-time preview on the 3D
  model, saved presets, a **skin code you paste straight into the game**, and
  (**PRO**) live-apply onto the dino you're playing.

**Utilities**

- **Companion window** (**PRO**): a separate dashboard for a second monitor —
  stats, map, team, quests; remembers its geometry, has a compact mode.
- **Settings** split into tabs, with a search box. **Global hotkeys** rebindable
  in-app. Bilingual VI/EN. Automatic updates.
- **Light mode** for weak-CPU machines (caps the frame rate, drops some effects).

## Install

1. Download `TheIsle Overlay_x.x.x_x64-setup.exe` from
   [Releases](https://github.com/tnqaquocanh-vn/theisle-overlay/releases) and run it.
2. On first launch the app downloads the map data (~3 MB) and runs a short setup wizard.
3. Run the game in **Windowed** or **Borderless Fullscreen** (no overlay can draw
   over exclusive Fullscreen).

Requires **Windows 10/11 64-bit**, WebView2 (present on most Windows 11 installs;
the installer fetches it if missing).

> Windows may show a **SmartScreen** warning on first install because the
> installer isn't code-signed. Click **More info → Run anyway**. Later
> auto-updates aren't prompted.

## Connecting "Your Dino" (IslePilot)

The **Dino** tab reads your own dino's stats from the
[IslePilot](https://islepilot.eu) system. Two ways to connect:

### Method 1 — Steam login via IslePilot (recommended)

Open the **Dino** tab → click **Steam login** → sign in in the islepilot.eu
window that opens; it closes itself when done.

Do this **once** — no server link needed, it works on **every IslePilot server**,
and switching servers in game follows automatically. This login also unlocks the
**Garage** tab and the **server POI** map layer. If the window fails to catch the
token, open *"Or paste the token manually"* and paste the token (or the whole
`theisle-overlay://…` link).

### Method 2 — Legacy: server link + cookie (only when method 1 breaks)

The cookie is stored per server — switching servers means doing it again. Open the
**"Legacy: server URL + cookie"** section of the login card, enter the server link
and click Steam login there. If that still fails, paste the cookie manually:

1. Open the server page in your browser and sign in with Steam there. Press
   **F12** (or right-click → **Inspect**) → **Application** tab (Chrome) /
   **Storage** (Firefox).

   ![Open DevTools and pick the Application tab](docs/guide-dino-1-devtools.png)

2. Pick **Cookies** → the server's domain → click the **`islepilot_player`**
   cookie → copy the whole **Value**.

   ![Copy the islepilot_player cookie value](docs/guide-dino-2-copy-cookie.jpg)

3. In the app: paste it into the cookie box → click **Verify & save cookie**.

   ![Enter the server link, paste the cookie and save](docs/guide-dino-3-paste-app.jpg)

**Some servers using IslePilot** (examples — any IslePilot-powered server works):

- https://mixi.islepilot.eu
- https://hoho.islepilot.eu
- https://sdvn.islepilot.eu
- https://sdvn2.islepilot.eu
- https://khunglong.islepilot.eu
- https://islepilot.eu/p/sbtcisland

> **Note:** method 1 reads a stable JSON API. The legacy path parses the server's
> web page HTML, so it **can break whenever IslePilot changes its UI** — the app
> flags it. Either way, the map features are **unaffected**.

## Automatic position & Npcap

On a server with a **live map**, the app gets your position automatically via
IslePilot — no "Asset Location" clicking. It detects and enables this itself; the
option locks off when the server has the live map disabled, and a manual choice
you make is always respected.

The separate **local packet-capture** mode (Settings › Automatic position) needs
**Npcap** — the Nmap project's packet library (~1 MB). Enable it without Npcap
installed and the app asks *"Install now?"*, then does it for you: it tries
`winget` first, else downloads the signed installer from npcap.com, checks its
SHA-256 and Authenticode signature, and runs it — you just click Next. The app
**does not bundle** `npcap.exe`; Nmap's own installer (UAC + signature) is the
trust boundary.

## PRO / PRO VIP

**The map core is always free** — minimap, full map, POIs, waypoints, search,
session replay, dino stats. The tiers only add extras.

| Feature | Free | PRO | PRO VIP |
|---|:---:|:---:|:---:|
| Minimap + full map + manual GPS | ✓ | ✓ | ✓ |
| IsleMaps light/dark basemaps | — | ✓ | ✓ |
| Skin editor · apply-live · cloud presets · sound cues · companion window | — | ✓ | ✓ |
| Minimap diagnostics · advanced presets | — | ✓ | ✓ |
| Species + weight labels on markers | — | — | ✓ |
| Relationship colour dots (carnivore / herbivore / same species) | — | — | ✓ |
| Upcoming advanced map features | — | — | ✓ |

See the full comparison and buy a key right in **Settings › Account**: bank
transfer (**VietQR**, auto-activates) or **Ko-fi**. A 3-day trial code is available.

## Anti-cheat safety

The game runs kernel-level Easy Anti-Cheat. This app is safe because it
**never touches the game process**:

- Position comes only from the **clipboard**, when you press Tab → "Asset
  Location" yourself — the app reads back what the game hands over.
- Hotkeys use `RegisterHotKey` (Windows' cooperative API), **not** a keyboard hook.
- Dino stats / Garage / 3D models come over **HTTPS from the IslePilot system** —
  nothing to do with the game process.
- The optional packet-capture mode only listens to your own machine's network
  traffic via Npcap.
- **Never**: reading game memory, DLL injection, DirectX hooks, synthetic input,
  auto-copying coordinates on a timer, or sharing positions between players.

The build has an automated step that **fails on any forbidden API call site**;
the allowed Windows-API list is documented and enforced in the source.

> **Ask your server admins** before using it routinely — some servers have their
> own rules about third-party tools.

## Things to know & troubleshooting

- **No overlay in game**: you're in exclusive Fullscreen. Switch to Windowed or
  Borderless Fullscreen. The app reads your game config and warns you.
- **Position doesn't move**: press Tab → "Asset Location" each time you want an
  update (unless the server has a live map). This is *deliberate* — see anti-cheat.
- **Wrong heading**: needs two coordinate copies at least 20 m apart; a sample
  older than 10 minutes expires.
- **Only one instance can run** — global hotkeys are system-exclusive.
- **Low-RAM machines**: hide the full map with `Ctrl+Alt+F` while playing — the
  app trims the hidden window's memory. Clicking X parks the app in the **system
  tray** (Steam/Discord-style): left-click to restore, right-click → Quit to exit.
- **Hotkeys taken by another app** are reported at startup; rebind them in Settings.
- **Your login token/cookie** is encrypted with Windows DPAPI and can only be
  decrypted by your Windows account on that machine.

## How light is it?

Indicative measurements (Intel Core i5-14400F, 32 GB RAM, RTX 3060 Ti, Windows 11
Pro). The app barely grows between versions.

| Item | Size |
|---|---|
| Installer | **~4.3 MB** |
| Installed executable | ~17.8 MB |
| Map data downloaded on first run | ~2.9 MB (2.6 MB basemap + 0.3 MB point data) |
| **Total disk footprint** | **~21 MB** |

| At runtime | RAM (working set) | Idle CPU |
|---|---|---|
| Full map **and** minimap open | ~522 MB (8 processes) | ~0.18% |
| Full map hidden with `Ctrl+Alt+F` (the while-playing scenario) | ~448 MB | ~0.08% |

**CPU is essentially zero** because the app has no repaint loop — it draws only
when new data arrives.

## Credits & licence

Map data is **fetched on first run, never bundled** — it is a personal copy on
your machine, not a redistribution.

- Basemap: [VulnonaMAP](https://vulnona.com/game/map/) (Coco.N) — stitched from
  in-game captures. Imagery copyright Afterthought LLC (The Isle).
- IsleMaps basemap (optional) and animal spawn points:
  [islemaps.com](https://www.islemaps.com/) (Pont & Emeara).
- POIs: [myislemap.com](https://myislemap.com/), VulnonaMAP, wiredredman's Steam guide.

Unaffiliated with Afterthought LLC.

Licensed **MIT** — see [`LICENSE`](LICENSE). This app is a derivative work; the
full list of open-source components and copyright notices is in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## Contact & support

Developed by **BumBum**.

- 🐛 Bugs / suggestions: [GitHub Issues](https://github.com/tnqaquocanh-vn/theisle-overlay/issues),
  or use the **Send feedback** button in Settings › Advanced.
- ❤️ Support: buy **PRO / PRO VIP** in Settings › Account (VietQR / Ko-fi). The
  map core is always free — the tiers add extras and keep the project going.
