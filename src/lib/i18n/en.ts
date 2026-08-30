// English translations. Typed as Record<MsgKey, string>: a missing key is a
// COMPILE error, so the two languages cannot drift apart.

import type { MsgKey } from "./vi";

export const en: Record<MsgKey, string> = {
  "app.title": "The Isle Map",
  "app.minimap_title": "Minimap",
  "app.fullmap_title": "Gateway Map",

  "tab.map": "Map",
  "tab.dino": "Your Dino",
  "tab.settings": "Settings",
  "tab.garage": "Garage",
  "tab.skin": "Skin",
  "tab.guide": "Guide",

  "skin.title": "Skin editor",
  "skin.subtitle": "Recolour a dino's 10 skin channels, previewed live in 3D. Local only — nothing is sent anywhere.",
  "skin.species": "Species",
  "skin.channels": "10 colour channels",
  "skin.ch_body": "Body",
  "skin.ch_flank": "Flank",
  "skin.ch_underbelly": "Belly",
  "skin.ch_markings": "Markings",
  "skin.ch_display": "Display",
  "skin.ch_detail": "Detail",
  "skin.ch_eyes": "Eyes",
  "skin.ch_teeth": "Teeth",
  "skin.ch_mouth": "Mouth",
  "skin.ch_claws": "Claws",
  "skin.randomize": "Randomize",
  "skin.reset": "Reset",
  "skin.copy_game": "Copy game code",
  "skin.copy_app": "App code",
  "skin.paste": "Paste code",
  "skin.copied_game": "Game code copied — hit Import in-game to paste it",
  "skin.copied_app": "App code copied (share between overlay users)",
  "skin.paste_bad": "No valid skin code in the clipboard",
  "skin.pattern": "Pattern",
  "skin.pattern_nopreview": "No preview image for this pattern (only {n}) — the game code still exports the right number.",
  "skin.hex_bad": "Not a valid hex colour",
  "skin.your_skins": "Your skins",
  "skin.preset_name": "Skin name",
  "skin.save": "Save",
  "skin.no_presets": "No saved skins yet. Recolour, then Save.",
  "skin.delete": "Delete this skin",
  "skin.no_model": "No 3D model for this species yet — you can still edit and save colours.",
  "skin.live_apply": "Apply live on your dino (IslePilot)",
  "skin.live_hint": "Streams the colours to IslePilot in real time as you edit. Needs the Steam login on the Your Dino tab.",
  "skin.save_cloud": "Save to IslePilot",
  "skin.cloud_presets": "IslePilot presets",
  "skin.cloud_saved": "Saved to IslePilot",
  "skin.cloud_err": "IslePilot error: {err}",
  "skin.preset_cap": "The free build stores up to {n} skins. Become a supporter for unlimited.",
  "skin.preset_cap_hint":
    "Reached the free build's {n}-skin limit — delete one, or unlock unlimited in the Supporters section (Settings).",

  "pos.none": "No position yet",
  "pos.hint":
    "In game press Tab, then click “Asset Location” in the top-right corner to copy your coordinates.",
  "pos.off_map": "Off the map",

  "dir.N": "North",
  "dir.NE": "North-East",
  "dir.E": "East",
  "dir.SE": "South-East",
  "dir.S": "South",
  "dir.SW": "South-West",
  "dir.W": "West",
  "dir.NW": "North-West",
  "heading.unknown": "Heading unknown",
  "heading.hint": "Copy your coordinates again after moving to reveal your heading.",

  "layer.freshwater": "Fresh water",
  "layer.water": "Water",
  "layer.sanctuary": "Sanctuaries",
  "layer.migration": "Migration zones",
  "layer.saltlick": "Salt licks",
  "layer.mudwallow": "Mud wallows",
  "layer.food": "Food zones",
  "layer.patrol": "AI patrol zones",
  "layer.region": "Region names",
  "layer.landmark": "Landmarks",
  "layer.animal": "Animals",
  "layer.explored": "Explored areas",
  "explored.reset": "Reset explored",
  "explored.reset_confirm": "Clear the whole explored-areas history?",
  "route.tool": "Route",
  "route.total": "Total: {dist}",
  "route.save": "Save route",
  "route.name_prompt": "Route name:",
  "route.clear": "Clear",
  "route.list": "Saved routes",
  "route.empty": "No routes saved yet.",
  "layers.title": "Map layers",
  "layers.zone_labels": "Zone name labels",
  "layers.collapse": "Collapse",
  "layers.expand": "Expand",

  "wp.title": "Waypoints",
  "wp.new": "New waypoint",
  "wp.add": "Add waypoint",
  "wp.remove": "Delete",
  "wp.rename": "Rename",
  "wp.name_prompt": "Waypoint name:",
  "wp.empty": "No waypoints yet. Right-click the map to add one.",
  "wp.distance": "{dir} · {dist}",
  "wp.here": "My position",
  "wp.confirm_delete": "Delete waypoint “{name}”?",
  "wp.color": "Change color",
  "wp.group": "Group",
  "wp.groups": "Groups",
  "wp.group_edit": "Change group (empty = ungroup)",
  "wp.ungrouped": "Ungrouped",
  "wp.export": "Export",
  "wp.import": "Import",
  "wp.share": "Share with team",
  "wp.import_done": "Imported {added} waypoints, skipped {skipped} duplicates.",
  "wp.export_done": "Exported {n} waypoints.",

  "search.placeholder": "Search places or paste coords…",
  "search.goto_coords": "Go to these coordinates",
  "search.no_results": "No matches",
  "search.coords_failed": "Could not parse the coordinates — check the pasted text",
  "map.recenter": "Back to my position",

  "trail.title": "Travelled path",
  "trail.previous": "Previous session path",
  "trail.clear": "Clear trail",
  "trail.clear_hint":
    "Clears the lines on both maps to declutter; the history files on disk are kept.",
  "trail.history": "Past sessions",
  "trail.history_empty": "No sessions saved yet.",
  "trail.points": "{n} points",

  "replay.start": "Replay this session",
  "replay.play": "Play",
  "replay.pause": "Pause",
  "replay.restart": "Back to start",
  "replay.close": "Exit replay",
  "replay.speed": "Speed {n}×",
  "replay.export": "Export migration path (.geojson)",
  "replay.exported": "Exported {n} points to GeoJSON.",
  "replay.export_failed": "Export failed: {err}",
  "replay.empty": "This session has too few points to replay.",
  "replay.caption": "Session of {when}",

  "quest.section": "Prime quests",
  "quest.hint": "Click a quest that has a place to show its POI layer on the map.",
  "quest.nearest": "Nearest: {name}",
  "quest.unpin": "Unpin",

  "measure.section": "Measure & coords",
  "ruler.tool": "Ruler",
  "ruler.hint": "Click points on the map. Right-click or Esc to clear.",
  "ruler.clear": "Clear",
  "coord.show": "Show coordinates under the cursor",

  "btn.close": "Close",
  "btn.ok": "OK",
  "btn.cancel": "Cancel",
  "btn.save": "Save",

  "warn.exclusive_fullscreen":
    "The game is running in exclusive Fullscreen mode. The minimap cannot draw on top of it. " +
    "In the game go to Settings › Video and switch to “Windowed” or “Borderless Fullscreen”.",
  "warn.hotkey_failed":
    "The following hotkeys could not be registered because another app holds them:",
  "warn.no_data": "No map data on this machine yet. It needs to be downloaded once before use.",

  "hotkey.toggle_minimap": "Show/hide minimap",
  "hotkey.toggle_fullmap": "Open/close full map",
  "hotkey.toggle_click_through": "Toggle click-through",
  "hotkey.mark_here": "Mark current position",
  "hotkey.opacity_up": "Minimap more opaque",
  "hotkey.opacity_down": "Minimap more transparent",
  "hotkey.zoom_in": "Zoom view in",
  "hotkey.reload_ui": "Reload the UI (if it freezes)",
  "hotkey.team_ping": "Drop a contact ping for the team",
  "hotkey.cycle_preset": "Switch to the next overlay preset",
  "hotkey.zoom_out": "Zoom view out",
  "hotkey.toggle_quests": "Show/hide the Prime quests panel",
  "hotkey.map_snapshot": "Copy the minimap frame to the clipboard",
  "hotkey.toggle_bigmap": "Open/close the in-game big map",
  "hotkey.toggle_companion": "Open/close the 2nd-monitor companion",
  "bigmap.title": "Full map",
  "bigmap.hint": "Ctrl+Alt+G or ✕ to close · you can still move in-game",
  "bigmap.pin": "Pin",
  "bigmap.pinned": "Pinned",
  "bigmap.unpin": "Unpin (hand control back to the game)",
  "settings.bigmap": "In-game big map",
  "settings.bigmap_opacity": "Backdrop opacity",
  "settings.bigmap_hint": "Press Ctrl+Alt+G in-game to open/close the full-screen map. It hides itself when you Alt-Tab away from the game.",

  "companion.title": "Companion",
  "companion.hint": "Second screen · Esc or ✕ to hide",
  "companion.open": "Open companion (2nd screen)",
  "companion.open_hint": "A separate dashboard window (full map + stats + team + quests) for a second monitor. Hotkey Ctrl+Alt+D.",
  "companion.no_team": "Not in a survival team.",
  "companion.no_quests": "No Prime quests yet.",
  "companion.hide_map": "Hide the map (stats only)",
  "companion.show_map": "Show the map again",

  "settings.group_interface": "Interface",
  "settings.group_hud": "In-game HUD",
  "settings.group_map": "Map & data",
  "settings.group_autopos": "Automatic position",
  "settings.group_hotkeys": "Hotkeys",
  "settings.group_advanced": "Advanced",
  "settings.setup_title": "First-run setup",
  "settings.setup_rerun": "Run setup again",
  "settings.setup_hint": "Reopen the 5-step first-run walkthrough (map data, IslePilot, hotkeys).",
  "settings.language": "Ngôn ngữ · Language",
  "settings.minimap": "Minimap",
  "settings.visible": "Show minimap",
  "settings.require_game": "Only show while you are in the game (hides on Alt-Tab)",
  "settings.click_through": "Click-through (never blocks gameplay)",
  "settings.show_trail": "Show the trail on the minimap",
  "settings.show_waypoints": "Show waypoints on the minimap",
  "settings.rotate_minimap": "Rotate the minimap so travel points up",
  "settings.show_team_panel": "Show teammate stats under the minimap (when in a team)",
  "settings.last_seen_beacon": "Drop a “Last seen” waypoint when the position signal is lost",
  "settings.smooth_motion": "Ease the position marker between updates (instead of jumping)",
  "settings.solo_mode": "Solo mode — hide teammates, party dots and pings from the HUD",
  "settings.auto_preset": "Auto-apply the preset named after your species on a swap",
  "settings.panel_order": "Panel order under the disc",
  "settings.panel_dino": "Dino stats panel",
  "settings.panel_quests": "Prime quests panel",
  "settings.panel_team": "Teammates panel",
  "settings.minimap_diag": "Show a diagnostics readout on the disc (render time · repaints/sec)",
  "settings.sound_cues": "In-game sound cues",
  "settings.sound_cues_hint": "Short beep when: a teammate drops a contact ping · a teammate falls below 25% HP · the position signal is lost. Off by default.",
  "settings.mouse_gestures": "Mouse gestures: Alt+wheel to zoom, Alt+middle-click to show/hide the minimap",
  "settings.mouse_gestures_hint":
    "Uses Raw Input (the same API games read the mouse with) — NOT a hook, injects nothing. " +
    "Only acts while Alt is held; normal scroll / click is untouched. Off by default.",
  "settings.color_profile": "Colour palette (vision)",
  "color.default": "Default",
  "color.deuteranopia": "Red–green colour-blind friendly",
  "settings.skin": "Skin",
  "settings.skin_hint": "Shifts the ground palette across the whole app and the minimap. Amber stays the accent.",
  "skin.obsidian": "Obsidian",
  "skin.bonefield": "Bonefield",
  "skin.biolum": "Bioluminescent",
  "settings.data_age": "Map data downloaded {n} days ago — hit “Re-download” if the game or community data changed recently.",
  "settings.corner": "Anchor corner on the game window",
  "corner.top-left": "Top left",
  "corner.top-right": "Top right",
  "corner.bottom-left": "Bottom left",
  "corner.bottom-right": "Bottom right",
  "settings.size": "Size",
  "settings.margin": "Margin",
  "settings.opacity": "Opacity",
  "settings.radius": "View radius",
  "settings.presets": "Quick presets",
  "settings.presets_hint":
    "Save the current overlay look (map layers, minimap size/opacity/radius, corner, panels) " +
    "as a named preset — click its name to re-apply.",
  "settings.preset_name_ph": "Preset name (e.g. group hunt)",
  "settings.preset_save": "Save",
  "settings.hud_scale": "Overall overlay size",
  "settings.hud_scale_hint": "Scales the whole overlay — minimap and stat panels — by the same factor.",
  "settings.map_sharpness": "Map sharpness",
  "settings.map_sharpness_hint":
    "Basemap resolution used for the in-game minimap disc. Higher is sharper but uses more RAM.",

  "settings.localpos": "Automatic position (experimental)",
  "settings.localpos_enable": "Read position + heading from the game's network packets",
  "settings.localpos_disclaimer":
    "When on, the app captures the UDP packets your machine sends (via Npcap) to read your " +
    "coordinates + heading — no more copying “Asset Location” by hand. It does NOT read " +
    "game memory, does NOT inject code, and never touches the game process; it only asks the OS " +
    "which UDP ports the game owns and filters to that stream. EAC does not forbid this passive " +
    "capture, but the final risk is yours. Off by default.",
  "settings.localpos_npcap_missing":
    "Npcap is not installed — it is required for this feature. Restart the app after installing.",
  "settings.localpos_npcap_ok": "Npcap is ready.",
  "settings.localpos_get_npcap": "Get Npcap (npcap.com)",
  "settings.hotkeys": "Hotkeys",
  "settings.hotkeys_hint":
    "Click a key field, then press the new combination. At least one modifier (Ctrl/Alt/Shift/Win) is required.",
  "settings.press_keys": "Press keys… (Esc to cancel)",
  "settings.hotkey_in_use": "This combination is held by another application",
  "settings.hotkey_duplicate": "Duplicates another hotkey in this app",
  "settings.hotkey_invalid": "Invalid combination — at least one modifier required",
  "settings.number_format": "Coordinate number format",
  "format.auto": "Auto-detect",
  "format.us": "US style — 1,234.5",
  "format.eu": "EU style — 1.234,5",
  "settings.data": "Data",
  "settings.open_trails": "Open trails folder",
  "settings.redownload": "Re-download map data",
  "settings.basemap": "Basemap style",
  "basemap.vulnona": "Vulnona (default)",
  "basemap.islemaps_light": "IsleMaps — light",
  "basemap.islemaps_dark": "IsleMaps — dark",
  "basemap.hint":
    "Applies to both the full map and the minimap. The first selection downloads " +
    "the imagery (~5–7 MB) — offline afterwards. The IsleMaps art tracks a newer " +
    "game build and shows the SE archipelago (Hell's Mouth).",
  "basemap.downloading": "Downloading imagery…",
  "basemap.failed":
    "Imagery download failed — check your connection and retry. The current basemap stays.",

  "firstrun.title": "Download map data",
  "firstrun.explain":
    "The app needs to download the basemap (~3 MB) and point data to your machine once. " +
    "Data is fetched straight from its sources instead of being bundled — it is a personal " +
    "copy on your machine, not a redistribution.",
  "firstrun.start": "Start download",
  "firstrun.downloading": "Downloading…",
  "firstrun.done": "Done! Opening the map…",
  "firstrun.partial":
    "The basemap downloaded but the point data failed. The map still works; " +
    "retry the data download from Settings later.",
  "firstrun.failed": "Download failed. Check your connection and try again.",
  "firstrun.retry": "Retry",
  "firstrun.continue": "Continue with the map",

  // --- first-run wizard (A1) ---
  "welcome.back": "Back",
  "welcome.next": "Continue",
  "welcome.skip": "Skip this step",
  "welcome.start": "Get started",
  "welcome.s1_title": "Welcome to the The Isle map overlay",
  "welcome.s1_body":
    "A north-up minimap in-game, a full map with waypoints and trails in the app, and live " +
    "dinosaur stats if you link IslePilot.",
  "welcome.s1_anticheat":
    "The overlay is read-only: it reads the coordinates you copy in-game (or network packets " +
    "if you opt in), never the game's memory, and never touches the game process.",
  "welcome.s2_title": "Download map data",
  "welcome.s2_body":
    "The basemap imagery and points are downloaded to your machine (for licensing reasons), " +
    "not bundled. This is a one-time step.",
  "welcome.s2_download": "Download",
  "welcome.s2_have": "Map data is already in place.",
  "welcome.s2_downloading": "Downloading…",
  "welcome.s2_partial":
    "The basemap downloaded but the point data failed — the map still works; retry from Settings later.",
  "welcome.s2_failed": "Download failed. Check your connection and retry.",
  "welcome.s2_retry": "Retry",
  "welcome.s3_title": "Live dinosaur stats",
  "welcome.s3_opt": "Optional",
  "welcome.s3_body":
    "Link IslePilot to see health / hunger / thirst / growth / Prime on the HUD and the Dino " +
    "tab. Sign in from the Dino tab — you can do this later.",
  "welcome.s3_linked": "IslePilot connected.",
  "welcome.s3_notlinked": "Not connected — that's fine, you can link it later on the Dino tab.",
  "welcome.s4_title": "Hotkeys",
  "welcome.s4_body": "The main hotkeys (rebind them in Settings → Hotkeys):",
  "welcome.s5_title": "You're all set",
  "welcome.s5_body":
    "Launch the game and toggle the minimap with its hotkey, or browse the full map right here.",

  "dino.title": "Your dino",
  "dino.explain":
    "Reads your OWN dino's info from the server's IslePilot panel (growth, health, hunger, " +
    "thirst, Prime progress). It is just an HTTPS connection to the server's website — " +
    "nothing touches the game, anti-cheat safe.",
  "dino.server": "Server",
  "dino.login": "Sign in with Steam",
  "dino.login_wait": "Waiting for you to sign in in the window that just opened…",
  "dino.login_failed": "Sign-in did not complete. Try again.",
  "dino.logged_in": "Signed in",
  "dino.logout": "Sign out",
  "dino.auth_expired": "Your session expired — please sign in again.",
  "dino.supported_servers":
    "Works with any IslePilot-powered server — xxx.islepilot.eu or islepilot.eu/p/server-name. " +
    "See the Guide tab for examples and a step-by-step walkthrough.",
  "dino.manual_cookie": "Paste your session cookie",
  "dino.manual_cookie_hint":
    "Open the server page in your browser and sign in with Steam. Press F12 → " +
    "Application tab (Chrome) or Storage (Firefox) → Cookies → pick the server domain → " +
    "find the cookie named islepilot_player and paste its Value here.",
  "dino.cancel_login": "Cancel sign-in",
  "dino.manual_cookie_save": "Verify & save cookie",
  "dino.manual_cookie_checking": "Checking cookie…",
  "dino.manual_cookie_bad":
    "Cookie invalid or session not signed in — double-check the pasted string.",
  "dino.server_settings": "Server settings",
  "dino.token_login": "Steam login (once, works on every server)",
  "dino.token_login_hint":
    "Sign in through islepilot.eu ONCE — the token works on EVERY IslePilot server " +
    "(mixi, hoho, sdvn…), no server URL or cookie copying needed. Switch servers in game " +
    "and the data follows automatically.",
  "dino.token_paste": "Or paste the token manually",
  "dino.token_paste_hint":
    "If the login window fails to catch the token: paste the overlay token (or the whole " +
    "theisle-overlay://… / isle-overlay://… link) here.",
  "dino.token_save": "Verify & save token",
  "dino.token_checking": "Checking token…",
  "dino.token_bad": "Token invalid — double-check the pasted string.",
  "dino.legacy_section": "Legacy: server URL + cookie (fallback)",
  "dino.legacy_hint":
    "Only needed when the new login does not work with your server. Cookies are stored " +
    "per server.",
  "dino.live_map_yes": "This server has a live map — your position updates automatically",
  "dino.live_map_checking": "Checking whether this server has a live map…",
  "dino.enabled": "Track dino info",
  "dino.interval": "Update frequency",
  "dino.hardswap_timer": "Hard-swap timer:",
  "dino.hardswap_start": "Start 30:00",
  "dino.realtime": "Realtime updates (WebSocket)",
  "dino.realtime_hint":
    "Uses the wss://islepilot.eu socket for sub-second position + stats. " +
    "The REST poll stays as a fallback when the socket drops.",
  "dino.overlay_panel": "Show stats strip under the minimap",
  "dino.quests_panel": "Show Prime quests under the minimap",
  "dino.show_party": "Show teammates on the map",
  "dino.party_via_livemap": "Showing teammates — straight from this server's live map. Nothing else to set up.",
  "dino.party_needs_relay":
    "This server has no live map. To show teammates you need a private team via the relay — open “Survival team” below.",
  "party.rules_ack":
    "Enable to show teammate positions on the map (from the server's live map). Some servers have their " +
    "own rules about third-party tools — ask an admin first. Enable?",
  "dino.use_map_position":
    "Auto position from the server's live map (instead of manual coordinate copying)",
  "dino.rules_note":
    "⚠ Ask the server admins before using this routinely — some servers have their own " +
    "rules about third-party tools. Everything shown is your own data, served by the " +
    "server's own panel.",
  "dino.growth": "Growth",
  "dino.health": "Health",
  "dino.hunger": "Hunger",
  "dino.thirst": "Thirst",
  "dino.stamina": "Stamina",
  "dino.nutrition": "Nutrition",
  "dino.nutrition_carb": "Carbs",
  "dino.nutrition_protein": "Protein",
  "dino.nutrition_lipid": "Lipids",
  "nutriadvice.title": "Eat next",
  "nutriadvice.balanced": "All three are healthy — all three are adding growth rate (up to +300%).",
  "nutriadvice.herb": "Vary your plants — each species has 3 preferred plants, one per nutrient. Don't camp one bush.",
  "nutriadvice.herb_plants": "{nutrient} low — this species' preferred foods: {foods}. Rotate through them; pick one you haven't had recently (each fills a different nutrient).",
  "nutriadvice.carn_carb": "Carbs low — eat the prey's LUNGS (2 per corpse; the organ that fills carbs).",
  "nutriadvice.carn_protein": "Protein low — eat the prey's HEART (the organ that fills protein).",
  "nutriadvice.carn_lipid": "Lipids low — eat the prey's INTESTINES (the organ that fills lipids).",
  "nutriadvice.omni_carb": "Carbs low — eat prey LUNGS, or browse varied plants.",
  "nutriadvice.omni_protein": "Protein low — eat the prey's HEART, or seeded plants.",
  "nutriadvice.omni_lipid": "Lipids low — eat prey INTESTINES, or oily fruit.",
  "dino.server_playing": "Server",
  "dino.sex_female": "Female",
  "dino.sex_male": "Male",
  "dino.prime": "Prime progress",
  "dino.online": "Online",
  "dino.offline": "Offline",
  "dino.updated": "Updated {time}",
  "dino.no_data": "No data yet — enable tracking and wait for the first update.",
  "dino.fetch_error": "Panel connection error:",
  "dino.layout_changed":
    "IslePilot just deployed a new version — if numbers look wrong, their markup may have " +
    "changed and the app needs an update.",
  "dino.map_disabled": "The live map is disabled on this server.",
  "dino.crashed":
    "The Your Dino section hit an error and was isolated — the map and other features are unaffected.",

  "dino.history_track": "Save stat history (growth chart, hunger/thirst rates)",
  "dino.death_marker": "Drop a death marker when the dino dies",
  "dino.death_marker_hint": "When IslePilot reports your dino dead, drop a 💀 waypoint at the last position (and share it with the team if you're in one) so you can walk back to the corpse. Deletable like any waypoint.",
  "dino.history_title": "Stat history",
  "dino.history_empty": "Not enough data yet. Enable “Track dino info” and wait a few minutes.",
  "dino.history_clear": "Clear history",
  "dino.history_clear_confirm": "Delete all saved stat history on this machine?",
  "dino.history_range_6h": "6 h",
  "dino.history_range_24h": "24 h",
  "dino.history_range_all": "All",
  "dino.growth_rate": "Growth rate",
  "dino.eta_adult": "To adult",
  "dino.drain_hunger": "Hunger drop",
  "dino.drain_thirst": "Thirst drop",
  "dino.rate_per_h": "{v}%/h",
  "dino.eta_hours": "≈ {h} h",
  "dino.eta_soon": "almost there",
  "dino.empty_in": "empty in ≈ {h} h",
  "dino.chart_growth": "Growth",
  "dino.chart_hunger": "Hunger",
  "dino.chart_thirst": "Thirst",

  "alert.section": "Alerts",
  "alert.enabled": "Enable alert notifications",
  "alert.hint":
    "Shows a Windows notification when a stat drops below its threshold — for use while " +
    "you are in the game. Only fires while the dino is online, with a per-rule cooldown.",
  "alert.thirst_label": "Thirst threshold (%)",
  "alert.hunger_label": "Hunger threshold (%)",
  "alert.hp_label": "Health threshold (%)",
  "alert.threshold_off": "0 = off",
  "alert.prime_ready": "When Prime becomes eligible",
  "alert.growth_milestones": "On growth milestones (25 / 50 / 75 / 100%)",
  "alert.test": "Send test",

  "garage.title": "Garage (Gacha)",
  "garage.hint":
    "Dinos parked in the server's garage. Park/Restore can take up to ~60 seconds — the " +
    "server processes commands asynchronously.",
  "garage.refresh": "Refresh",
  "garage.park": "Park current dino",
  "garage.slay": "💀 Slay dino",
  "garage.slay_confirm": "Slay your current dino? It dies in-game immediately and CANNOT be recovered.",
  "garage.restore": "Restore",
  "garage.sell": "Sell",
  "garage.rename": "Rename",
  "garage.rename_prompt": "New name for this dino:",
  "garage.confirm_restore": "Restore “{name}”? Your current dino may be replaced.",
  "garage.confirm_sell": "Sell “{name}”? This cannot be undone.",
  "garage.empty": "The garage is empty.",
  "garage.busy": "Sending command to the server… (up to ~60 s)",
  "garage.error": "Command failed:",
  "garage.sold": "Sold — received {amount} {currency}",
  "garage.done": "Done!",
  "garage.need_token":
    "The Garage needs the one-time Steam login via IslePilot — sign in from the " +
    "Your Dino tab. The legacy server + cookie flow cannot use the Garage.",
  "garage.unsupported":
    "Could not load the Garage — the server you are playing on may not support it.",
  "garage.updated":
    "Updated {time} · auto-refreshes every 10 minutes — press Refresh for now.",

  "dino3d.loading": "Loading 3D model…",
  "dino3d.no_model": "No 3D model for this species yet.",
  "dino3d.error": "Could not load the 3D model — check your connection and retry.",

  "layer.islepilot": "Server POIs (IslePilot)",
  "poi.islepilot_discord":
    "Link your Discord account with IslePilot to unlock the server map.",
  "poi.islepilot_disabled": "The live map is disabled on this server.",
  "poi.islepilot_login": "Log in with a token (Your Dino tab) to show server POIs.",
  "poi.islepilot_empty": "This server has no POIs yet.",
  "map.crashed":
    "The map hit a display error. Click Retry, or press F5 to reload the whole app.",
  "btn.retry": "Retry",


  "footer.based_on": "TheIsle Overlay · built by BumBum",
  "footer.source_link": "GitHub",
  "footer.reload_hint": "If the app breaks, press F5 or Ctrl+Alt+R to reload",


  "update.title": "App updates",
  "update.current": "Current version: {version}",
  "update.check": "Check for updates",
  "update.checking": "Checking…",
  "update.available": "Version {version} is available",
  "update.uptodate": "You're on the latest version.",
  "update.notes": "What's new",
  "update.install": "Download & install {version}",
  "update.downloading": "Downloading… {pct}%",
  "update.ready": "Installed — restarting…",
  "update.error": "Update failed: {err}",
  "update.later": "Later",
  "update.auto_check": "Check for updates on startup",
  "update.auto_check_hint":
    "Only fetches a small version-info file (latest.json) from the releases page. " +
    "Never downloads or installs on its own — it always asks first.",

  // --- supporters (license) ---
  "sup.title": "Supporters",
  "sup.badge": "Supporter",
  "sup.pitch":
    "Every core feature (map, minimap, waypoints, trail, dino stats, Garage, " +
    "basic skin editor) is always free. A few power-user extras are supporter-only:",
  "sup.perk_companion": "Companion window for a second monitor",
  "sup.perk_liveskin": "Live-apply skins onto your dino + cloud presets",
  "sup.perk_presets": "Unlimited local skins & presets",
  "sup.perk_more": "Advanced session replay, sound cues, and later additions",
  "sup.activate": "Activate",
  "sup.checking": "Checking…",
  "sup.recheck": "Check again",
  "sup.remove": "Remove key",
  "sup.active": "Active — thank you for supporting!",
  "sup.grace":
    "Couldn't re-verify with the server. Still working for a few more days — " +
    "go online to refresh.",
  "sup.get_key": "Get a supporter key →",
  "sup.price_hint":
    "Suggested support: 50,000₫ (lifetime, one-off). After supporting you'll " +
    "get a key by email; paste it above and click Activate.",
  "sup.locked_hint": "Supporter-only feature — see the Supporters section below.",
  "sup.required_toast": "This is a supporter feature. Tap to open the Supporters section.",
  "sup.err_unknown": "Unknown key. Double-check it for typos.",
  "sup.err_revoked": "This key has been revoked.",
  "sup.err_fp_limit":
    "This key has moved between too many machines this month. Try next month " +
    "or get in touch.",
  "sup.err_bad": "Malformed key. It should look like BUMBUM-XXXX-XXXX-XXXX.",
  "sup.err_network": "Couldn't reach the server. Check your connection and retry.",
  "sup.buy_btn": "💳 Buy a key — bank QR (Vietnam)",
  "sup.buy_creating": "Opening order…",
  "sup.buy_scan": "Scan the QR with your banking app, or transfer manually:",
  "sup.buy_amount": "Amount",
  "sup.buy_bank": "Bank / Account",
  "sup.buy_memo": "Transfer memo",
  "sup.buy_memo_warn":
    "Use this exact memo. A wrong memo means the key won't reach you automatically (still recoverable manually, just slower).",
  "sup.buy_waiting": "Waiting for automatic payment confirmation…",
  "sup.buy_expires": "Expires in {t}",
  "sup.buy_expired": "Order expired. Start a new one for a fresh QR.",
  "sup.buy_new": "New order",
  "sup.buy_cancel": "Cancel order",
  "sup.buy_activating": "Payment received — activating…",
  "sup.buy_err": "Couldn't open an order. Try again in a few minutes.",
  "sup.buy_unconfigured":
    "Automatic payment isn't set up. Use \"Get a supporter key\" below, or get in touch for a key.",
  "sup.buy_copy": "Copy",
  "sup.buy_copied": "Copied",
  "sup.buy_qr_alt": "VietQR bank-transfer QR code",

  "telemetry.title": "Usage data & feedback",
  "telemetry.enabled": "Send anonymous usage data",
  "telemetry.hint":
    "Only this: a random install id, the app version, the Windows build " +
    "number, the UI language, and how many times each feature was used. No " +
    "IP address, no in-game position, no Windows account name.",
  "feedback.title": "Send feedback",
  "feedback.cat_bug": "Bug",
  "feedback.cat_idea": "Idea",
  "feedback.cat_other": "Other",
  "feedback.body": "Description (max 2000 characters)",
  "feedback.contact": "How to reach you (optional)",
  "feedback.send": "Send",
  "feedback.sending": "Sending…",
  "feedback.sent": "Sent. Thank you!",
  "feedback.failed": "Could not send. Check your connection and try again.",

  "team.title": "Survival team",
  "team.intro":
    "Type a name → Create team → send the 6-char code to friends. Teammates show on the map on EVERY " +
    "server, even ones with no live map. Nothing else to set up.",
  "team.name_ph": "Display name",
  "team.or": "or",
  "team.code_ph": "CODE",
  "team.create": "Create team",
  "team.join": "Join",
  "team.leave": "Leave team",
  "team.code": "Team code",
  "team.copy_code": "Click to copy",
  "team.connected": "Connected",
  "team.connecting": "Connecting…",
  "team.members": "{n} people",
  "team.advanced": "Advanced (use a different relay)",
  "team.relay_base": "Relay URL",
  "team.relay_default_ph": "Empty = use the built-in relay",
  "team.you": "you",
  "team.offline": "no signal",
  "team.mark_toast": "{from} dropped a contact ping on the map",
  "team.wp_toast": "{from} shared “{name}” — added to your waypoints",

  "credits.title": "Data sources",
  "credits.body":
    "Basemap: VulnonaMAP (Coco.N) — stitched from in-game captures. " +
    "IsleMaps basemap & animal points: IsleMaps.com (Pont & Emeara). " +
    "Imagery copyright Afterthought LLC (The Isle). " +
    "Point data: VulnonaMAP, myislemap.com, wiredredman's Steam guide. " +
    "This app is not affiliated with Afterthought LLC.",
};
