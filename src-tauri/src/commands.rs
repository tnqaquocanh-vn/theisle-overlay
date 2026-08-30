//! All #[tauri::command] handlers — the whole IPC surface, mirrored by
//! `src/lib/api.ts` on the frontend.

use overlay_core::{
    bearing_to_compass_key, pixel_to_world, world_to_pixel, Calibration, MapSource,
};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::events::{
    PositionUpdate, ReplayPointOut, TrailPayload, TrailReplayPayload, SETTINGS_CHANGED,
};
use crate::pipeline;
use crate::settings;
use crate::state::{AppState, LockExt};
use crate::store::{self, Waypoint};
use crate::telemetry;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Value {
    state.settings.lock_safe().clone()
}

/// Count the settings changes that are really feature use.
///
/// Reading the PATCH rather than the merged result is what makes this work:
/// the patch contains exactly the keys someone just touched, so a toggle is
/// counted once whether it came from the Settings screen or a hotkey, and an
/// unrelated save counts nothing.
fn count_settings_features(patch: &Value) {
    let touched = |path: &[&str]| settings::get_path(patch, path).is_some();
    if touched(&["minimap", "visible"]) {
        telemetry::counters::track("minimap_toggle");
    }
    if touched(&["language"]) {
        telemetry::counters::track("language_switch");
    }
    if touched(&["trail", "enabled"]) || touched(&["minimap", "show_trail"]) {
        telemetry::counters::track("trail_view");
    }
    if touched(&["islepilot", "show_quests_panel"]) {
        telemetry::counters::track("quests_open");
    }
    if let Some(layers) = patch.get("layers").and_then(Value::as_object) {
        for _ in layers.keys() {
            telemetry::counters::track("layer_toggle");
        }
    }
}

/// Deep-merge a partial patch into the settings, persist (debounced), and
/// broadcast the full new settings to every window. Shared by the IPC command
/// and the hotkey actions so both paths behave identically.
pub fn apply_settings_patch(app: &AppHandle, patch: Value) -> Value {
    count_settings_features(&patch);
    let state = app.state::<AppState>();
    let (old_language, merged) = {
        let mut s = state.settings.lock_safe();
        let old_language = settings::get_str(&s, &["language"], "vi").to_string();
        *s = settings::merge(&s, &patch);
        (old_language, s.clone())
    };
    state.request_settings_save();
    if settings::get_str(&merged, &["language"], "vi") != old_language {
        crate::tray::rebuild_menu(app);
    }
    crate::events::emit_all(app, SETTINGS_CHANGED, merged.clone());
    // Bounce a background worker only when its own toggle is in THIS patch.
    // Otherwise every hotkey/gesture (radius, opacity, visibility) re-locks
    // both supervisors just to conclude "nothing changed" — and the gesture
    // path could re-enter raw_input::apply_settings mid-teardown.
    if settings::get_path(&patch, &["localpos", "enabled"]).is_some() {
        crate::localpos::apply_settings(app);
    }
    if settings::get_path(&patch, &["minimap", "mouse_gestures"]).is_some() {
        crate::win::raw_input::apply_settings(app);
    }
    merged
}

/// Npcap availability + where to install it — for the G1 settings panel.
#[tauri::command]
pub fn localpos_status() -> crate::localpos::NpcapStatus {
    crate::localpos::npcap_status()
}

// --- G6 team relay -------------------------------------------------------

#[tauri::command]
pub fn team_create(app: AppHandle, name: String) -> Result<crate::team::TeamStatus, String> {
    crate::team::create(&app, &name)
}

#[tauri::command]
pub fn team_join(
    app: AppHandle,
    code: String,
    name: String,
) -> Result<crate::team::TeamStatus, String> {
    crate::team::join(&app, &code, &name)
}

#[tauri::command]
pub fn team_leave(app: AppHandle) {
    crate::team::leave(&app);
}

/// P4: push a waypoint (world cm) to the whole team. No-op when not in a team.
#[tauri::command]
pub fn team_share_waypoint(app: AppHandle, name: String, x_cm: f64, y_cm: f64) {
    crate::team::share_waypoint(&app, &name, x_cm, y_cm);
}

#[tauri::command]
pub fn team_status() -> crate::team::TeamStatus {
    crate::team::status()
}

// --- P5 layout presets ------------------------------------------------

/// The settings keys a preset captures — "what my overlay looks like".
fn preset_snapshot(s: &Value) -> Value {
    let get = |path: &[&str]| settings::get_path(s, path).cloned().unwrap_or(Value::Null);
    serde_json::json!({
        "layers": get(&["layers"]),
        "map": { "zone_labels": get(&["map", "zone_labels"]) },
        "minimap": {
            "size_px": get(&["minimap", "size_px"]),
            "opacity": get(&["minimap", "opacity"]),
            "radius_m": get(&["minimap", "radius_m"]),
            "hud_scale": get(&["minimap", "hud_scale"]),
            "corner": get(&["minimap", "corner"]),
            "rotate_with_heading": get(&["minimap", "rotate_with_heading"]),
            "show_team_panel": get(&["minimap", "show_team_panel"]),
        },
        "islepilot": {
            "show_overlay_panel": get(&["islepilot", "show_overlay_panel"]),
            "show_quests_panel": get(&["islepilot", "show_quests_panel"]),
        },
    })
}

fn presets_array(s: &Value) -> Vec<Value> {
    settings::get_path(s, &["presets"])
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

/// Save the current overlay look under `name` (replacing a same-named one).
#[tauri::command]
pub fn save_preset(app: AppHandle, state: State<AppState>, name: String) -> Value {
    let name = name.trim().to_string();
    if name.is_empty() {
        return apply_settings_patch(&app, serde_json::json!({}));
    }
    let (mut list, patch) = {
        let s = state.settings.lock_safe();
        (presets_array(&s), preset_snapshot(&s))
    };
    list.retain(|p| p.get("name").and_then(Value::as_str) != Some(name.as_str()));
    list.push(serde_json::json!({ "name": name, "patch": patch }));
    apply_settings_patch(&app, serde_json::json!({ "presets": list }))
}

/// A4 — apply the preset whose NAME matches this species (case-insensitive,
/// either side contains the other; ≥3 chars). Returns whether one applied.
/// The caller gates this on `settings.minimap.auto_preset`.
pub fn apply_preset_for_species(app: &AppHandle, species: &str) -> bool {
    let sp = species.trim().to_lowercase();
    if sp.len() < 3 {
        return false;
    }
    let state = app.state::<AppState>();
    let patch = {
        let s = state.settings.lock_safe();
        presets_array(&s).into_iter().find_map(|p| {
            let name = p.get("name").and_then(Value::as_str)?.trim().to_lowercase();
            if !name.is_empty() && (sp.contains(&name) || name.contains(&sp)) {
                p.get("patch").cloned()
            } else {
                None
            }
        })
    };
    match patch {
        Some(patch) => {
            apply_settings_patch(app, patch);
            true
        }
        None => false,
    }
}

/// Apply a saved preset by name.
#[tauri::command]
pub fn apply_preset(app: AppHandle, state: State<AppState>, name: String) -> Value {
    let patch = {
        let s = state.settings.lock_safe();
        presets_array(&s)
            .into_iter()
            .find(|p| p.get("name").and_then(Value::as_str) == Some(name.as_str()))
            .and_then(|p| p.get("patch").cloned())
    };
    match patch {
        Some(patch) => apply_settings_patch(&app, patch),
        None => state.settings.lock_safe().clone(),
    }
}

#[tauri::command]
pub fn delete_preset(app: AppHandle, state: State<AppState>, name: String) -> Value {
    let mut list = presets_array(&state.settings.lock_safe());
    list.retain(|p| p.get("name").and_then(Value::as_str) != Some(name.as_str()));
    apply_settings_patch(&app, serde_json::json!({ "presets": list }))
}

/// A4 slice — apply the NEXT saved preset. If the current overlay look matches
/// a saved preset, advance from there; otherwise start at the first. Bound to
/// the `cycle_preset` hotkey (Ctrl+Alt+P) so a playstyle swap is one key.
pub fn cycle_preset(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (list, current) = {
        let s = state.settings.lock_safe();
        (presets_array(&s), preset_snapshot(&s))
    };
    if list.is_empty() {
        return;
    }
    let here = list
        .iter()
        .position(|p| p.get("patch") == Some(&current));
    let next = here.map_or(0, |i| (i + 1) % list.len());
    if let Some(patch) = list[next].get("patch").cloned() {
        apply_settings_patch(app, patch);
    }
}

#[tauri::command]
pub fn patch_settings(app: AppHandle, patch: Value) -> Value {
    apply_settings_patch(&app, patch)
}

/// The last known position, so a (re)loaded webview paints immediately —
/// position otherwise only arrives as an event on the NEXT manual copy.
#[tauri::command]
pub fn get_current_position(state: State<AppState>) -> Option<PositionUpdate> {
    pipeline::current_payload(&state)
}

/// Settings-screen probe: is this key combination valid AND currently free?
/// Registering on a scratch id and immediately unregistering answers both.
#[tauri::command]
pub fn check_hotkey_available(spec: String) -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS,
    };
    const PROBE_ID: i32 = 0x3FFF;
    let Some((mods, vk)) = crate::hotkeys::parse_hotkey(&spec) else {
        return false;
    };
    unsafe {
        if RegisterHotKey(None, PROBE_ID, HOT_KEY_MODIFIERS(mods), vk).is_ok() {
            let _ = UnregisterHotKey(None, PROBE_ID);
            true
        } else {
            false
        }
    }
}

/// Re-register all hotkeys from the current settings (after a rebind).
#[tauri::command]
pub fn apply_hotkeys(app: AppHandle, state: State<AppState>) {
    state.hotkeys.restart(app.clone());
}

#[tauri::command]
pub fn list_waypoints(state: State<AppState>) -> Vec<Waypoint> {
    state.waypoints.lock_safe().clone()
}

#[derive(Serialize)]
pub struct WaypointPx {
    #[serde(flatten)]
    pub waypoint: Waypoint,
    pub px: f64,
    pub py: f64,
}

/// Waypoints with render pixels attached — the transform stays in Rust.
#[tauri::command]
pub fn list_waypoints_px(state: State<AppState>) -> Vec<WaypointPx> {
    let cal = state.active_calibration();
    state
        .waypoints
        .lock_safe()
        .iter()
        .map(|wp| {
            let (px, py) = world_to_pixel(wp.x, wp.y, cal);
            WaypointPx {
                waypoint: wp.clone(),
                px,
                py,
            }
        })
        .collect()
}

fn persist_waypoints(app: &AppHandle, waypoints: &[Waypoint]) {
    if let Err(e) = store::save_waypoints(waypoints) {
        log::warn!("saving waypoints failed: {e}");
    }
    // Both windows refresh on this (the minimap draws waypoints too).
    crate::events::emit_all(app, "waypoints://changed", ());
}

/// Right-click on the full map: the frontend sends the clicked PIXEL and Rust
/// converts — the transform stays single-sourced. Stored coords are raw cm.
#[tauri::command]
pub fn add_waypoint_at_pixel(
    app: AppHandle,
    state: State<AppState>,
    px: f64,
    py: f64,
    name: String,
) -> Waypoint {
    telemetry::counters::track("waypoint_add");
    let (x, y) = pixel_to_world(px, py, state.active_calibration());
    let wp = store::new_waypoint(&name, x, y, 0.0, None);
    let mut waypoints = state.waypoints.lock_safe();
    waypoints.push(wp.clone());
    persist_waypoints(&app, &waypoints);
    wp
}

/// P4: a teammate shared a waypoint over the relay — add it locally in a
/// "team" group with the party colour so it stands apart from own pins and
/// can be deleted like any other. Not an IPC command; called from `team`.
pub fn add_shared_waypoint(app: &AppHandle, name: &str, x_cm: f64, y_cm: f64) {
    let state = app.state::<AppState>();
    let group = {
        let s = state.settings.lock_safe();
        if settings::get_str(&s, &["language"], "vi") == "en" {
            "Team"
        } else {
            "Nhóm"
        }
    };
    let mut wp = store::new_waypoint(name, x_cm, y_cm, 0.0, Some("#ff7bd0".into()));
    wp.group = Some(group.to_string());
    let mut waypoints = state.waypoints.lock_safe();
    waypoints.push(wp);
    persist_waypoints(app, &waypoints);
}

/// The "mark here" hotkey action: drop a waypoint at the current position.
#[tauri::command]
pub fn add_waypoint_here(app: AppHandle, state: State<AppState>, name: String) -> Option<Waypoint> {
    telemetry::counters::track("waypoint_add");
    let current = state.tracker.lock_safe().current?;
    let wp = store::new_waypoint(&name, current.x, current.y, current.z, None);
    let mut waypoints = state.waypoints.lock_safe();
    waypoints.push(wp.clone());
    persist_waypoints(&app, &waypoints);
    Some(wp)
}

#[tauri::command]
pub fn rename_waypoint(app: AppHandle, state: State<AppState>, id: String, name: String) -> bool {
    let mut waypoints = state.waypoints.lock_safe();
    let Some(wp) = waypoints.iter_mut().find(|w| w.id == id) else {
        return false;
    };
    wp.name = name;
    persist_waypoints(&app, &waypoints);
    true
}

/// Set (or clear, with None) a waypoint's colour. Colours live in the same
/// legacy-compatible field the Python app already had.
#[tauri::command]
pub fn set_waypoint_color(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    color: Option<String>,
) -> bool {
    let mut waypoints = state.waypoints.lock_safe();
    let Some(wp) = waypoints.iter_mut().find(|w| w.id == id) else {
        return false;
    };
    wp.color = color;
    persist_waypoints(&app, &waypoints);
    true
}

/// Write the selected waypoints (empty `ids` = all) to a portable JSON file
/// for sharing. Returns how many were written.
#[tauri::command]
pub fn export_waypoints(
    state: State<AppState>,
    path: String,
    ids: Vec<String>,
) -> Result<usize, String> {
    let waypoints = state.waypoints.lock_safe();
    let selected: Vec<&Waypoint> = if ids.is_empty() {
        waypoints.iter().collect()
    } else {
        waypoints.iter().filter(|w| ids.contains(&w.id)).collect()
    };
    let payload = serde_json::json!({
        "format": "theisle-overlay-waypoints",
        "version": 1,
        "waypoints": selected.iter().map(|w| serde_json::json!({
            "name": w.name, "x": w.x, "y": w.y, "z": w.z,
            "color": w.color, "group": w.group,
        })).collect::<Vec<_>>(),
    });
    let text = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(selected.len())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub added: usize,
    pub skipped: usize,
}

/// Merge a shared waypoint file into the user's set. A point within 1 m of an
/// existing one is treated as a duplicate and skipped; everything else is
/// added with a fresh id.
#[tauri::command]
pub fn import_waypoints(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<ImportResult, String> {
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let raw: Value =
        serde_json::from_str(&text).map_err(|_| "not a valid waypoint file".to_string())?;
    let items = raw
        .get("waypoints")
        .and_then(Value::as_array)
        .ok_or("not a waypoint file")?
        .clone();

    let mut waypoints = state.waypoints.lock_safe();
    let mut added = 0usize;
    let mut skipped = 0usize;
    for item in &items {
        let (Some(x), Some(y)) = (
            item.get("x").and_then(Value::as_f64),
            item.get("y").and_then(Value::as_f64),
        ) else {
            skipped += 1;
            continue;
        };
        if waypoints.iter().any(|w| (w.x - x).hypot(w.y - y) < 100.0) {
            skipped += 1;
            continue;
        }
        let name = item.get("name").and_then(Value::as_str).unwrap_or_default();
        let z = item.get("z").and_then(Value::as_f64).unwrap_or(0.0);
        let color = item.get("color").and_then(Value::as_str).map(String::from);
        let mut wp = store::new_waypoint(name, x, y, z, color);
        wp.group = item.get("group").and_then(Value::as_str).map(String::from);
        waypoints.push(wp);
        added += 1;
    }
    if added > 0 {
        persist_waypoints(&app, &waypoints);
    }
    Ok(ImportResult { added, skipped })
}

/// Assign (or clear, with None) a waypoint's folder/group. Blank names clear.
#[tauri::command]
pub fn set_waypoint_group(
    app: AppHandle,
    state: State<AppState>,
    id: String,
    group: Option<String>,
) -> bool {
    let mut waypoints = state.waypoints.lock_safe();
    let Some(wp) = waypoints.iter_mut().find(|w| w.id == id) else {
        return false;
    };
    wp.group = group.map(|g| g.trim().to_string()).filter(|g| !g.is_empty());
    persist_waypoints(&app, &waypoints);
    true
}

#[tauri::command]
pub fn delete_waypoint(app: AppHandle, state: State<AppState>, id: String) -> bool {
    let mut waypoints = state.waypoints.lock_safe();
    let before = waypoints.len();
    waypoints.retain(|w| w.id != id);
    let removed = waypoints.len() != before;
    if removed {
        telemetry::counters::track("waypoint_delete");
        persist_waypoints(&app, &waypoints);
    }
    removed
}

/// The previous session's trail (bug fix: the old app wrote trails but never
/// restored them), rendered dimmed on both maps.
#[tauri::command]
pub fn get_previous_trail(state: State<AppState>) -> TrailPayload {
    let cal = state.active_calibration();
    match state.previous_trail_path.lock_safe().as_ref() {
        Some(path) => pipeline::trail_payload(&store::load_trail(path), cal),
        None => TrailPayload::default(),
    }
}

/// "Clear trail": declutter the maps mid-session. Resets the in-memory trail
/// (both windows repaint via trail://changed) and hides the previous
/// session's dimmed trail for the rest of this session. The trail FILES are
/// untouched — history survives on disk; a break record marks the cut.
#[tauri::command]
pub fn clear_trail(app: AppHandle, state: State<AppState>) {
    state.tracker.lock_safe().clear_trail();
    *state.previous_trail_path.lock_safe() = None;
    if let Some(writer) = state.trail_writer.lock_safe().as_mut() {
        writer.add_break();
    }
    let cal = state.active_calibration();
    crate::events::emit_all(&app, crate::events::TRAIL_CHANGED, pipeline::trail_payload(&[], cal));
}

/// Every past-session trail file (newest first) for the "show an old trail"
/// picker in the layer panel.
#[tauri::command]
pub fn list_trails() -> Vec<store::TrailFile> {
    store::list_trails()
}

/// One named past-session trail, projected to the active basemap.
#[tauri::command]
pub fn get_trail_file(state: State<AppState>, name: String) -> TrailPayload {
    let cal = state.active_calibration();
    pipeline::trail_payload(&store::read_named_trail(&name), cal)
}

/// A past session projected for the replay scrubber (A6): time-ordered points
/// on the active basemap, on a compressed playback clock, plus the gap
/// indices the marker teleports across. `name` is a bare `trail_*.jsonl`
/// from `list_trails`.
#[tauri::command]
pub fn get_trail_replay(state: State<AppState>, name: String) -> TrailReplayPayload {
    let cal = state.active_calibration();
    let (points, gaps, started_iso) = store::read_named_trail_replay(&name);
    let out: Vec<ReplayPointOut> = points
        .iter()
        .map(|p| {
            let (px, py) = world_to_pixel(p.x, p.y, cal);
            ReplayPointOut { px, py, clock_ms: p.clock_ms, real_ms: p.real_ms as f64 }
        })
        .collect();
    let duration_ms = out.last().map_or(0.0, |p| p.clock_ms);
    TrailReplayPayload { points: out, gaps, duration_ms, started_iso }
}

/// Write a past session to a portable GeoJSON `FeatureCollection` — one
/// `LineString` per unbroken segment, coordinates in world centimetres — so a
/// migration path can be shared or opened elsewhere. Returns the point count.
#[tauri::command]
pub fn export_trail_geojson(path: String, name: String) -> Result<usize, String> {
    let segments = store::read_named_trail(&name);
    if segments.is_empty() {
        return Err("trail has no points".into());
    }
    let features: Vec<Value> = segments
        .iter()
        .map(|seg| {
            serde_json::json!({
                "type": "Feature",
                "properties": { "source": name },
                "geometry": {
                    "type": "LineString",
                    "coordinates": seg.iter().map(|&(x, y)| [x, y]).collect::<Vec<_>>(),
                },
            })
        })
        .collect();
    let n: usize = segments.iter().map(Vec::len).sum();
    let doc = serde_json::json!({
        "type": "FeatureCollection",
        "name": "theisle-overlay-migration-path",
        "features": features,
    });
    let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(n)
}

/// Stats-history samples (growth / HP / hunger / thirst / stamina %) whose
/// wall-clock falls inside a past session's span — for the A6 replay stat
/// overlay. `start_ms` / `end_ms` are the replay's real-time bounds
/// (`points[0].realMs` .. `points.last().realMs`); a small pad each side
/// catches a sample that landed just outside. Empty when history is off or
/// the session predates it.
#[tauri::command]
pub fn get_trail_stats(start_ms: f64, end_ms: f64) -> Vec<crate::islepilot::history::HistPoint> {
    const PAD_S: i64 = 120;
    let start_s = (start_ms / 1000.0) as i64 - PAD_S;
    let end_s = (end_ms / 1000.0) as i64 + PAD_S;
    if end_s <= start_s {
        return Vec::new();
    }
    crate::islepilot::history::query_between(start_s, end_s)
}

/// The current session's trail so far — for a window opening mid-session.
#[tauri::command]
pub fn get_current_trail(state: State<AppState>) -> TrailPayload {
    // Resolve the calibration BEFORE taking the tracker lock (it briefly
    // takes the settings lock).
    let cal = state.active_calibration();
    let tracker = state.tracker.lock_safe();
    pipeline::trail_payload(&tracker.segments, cal)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataStatus {
    pub basemap_minimap: bool,
    pub basemap_fullmap: bool,
    pub pois: bool,
}

#[tauri::command]
pub fn data_status() -> DataStatus {
    DataStatus {
        basemap_minimap: settings::basemap_dir().join("minimap.webp").exists(),
        basemap_fullmap: settings::basemap_dir().join("fullmap.webp").exists(),
        pois: settings::pois_path().exists(),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BasemapPaths {
    pub minimap: String,
    pub fullmap: String,
    /// "vulnona" | "islemaps_light" | "islemaps_dark"
    pub source: String,
    /// Decode-time downscale hint for the minimap's createImageBitmap — set
    /// for the big islemaps PNGs so the always-resident bitmap stays small.
    pub minimap_decode_width: Option<u32>,
}

/// The minimap decode width for islemaps imagery: 1250 px over the 1234-unit
/// world span is slightly sharper than the old vulnona minimap tier (975/1112)
/// while keeping the resident bitmap at ~6 MB instead of ~25 MB.
const ISLEMAPS_MINIMAP_DECODE_WIDTH: u32 = 1250;

/// Bounds for `minimap.basemap_px`: tier-1 (975 px, the old always-blurry
/// default) up to vulnona's tier-3 native width (3900 px).
const VULNONA_MINIMAP_DECODE_MIN: u32 = 975;
const VULNONA_MINIMAP_DECODE_MAX: u32 = 3900;

/// Absolute paths for the frontend to feed through `convertFileSrc()` (asset
/// protocol) — the images are never bundled into the app. For islemaps both
/// roles use the same PNG; the minimap downscales at decode.
///
/// For vulnona the disc renders the SAME tier-3 file as the full map
/// (`fullmap.webp`, 3900 px) instead of the tiny tier-1 `minimap.webp` — the
/// latter is ~975 px for the whole island, so any zoomed-in view was heavily
/// upscaled and blurry. `minimap.basemap_px` picks the decode width (RAM vs
/// sharpness); it is still downscaled at `createImageBitmap`, so the resident
/// bitmap stays bounded.
#[tauri::command]
pub fn get_basemap_paths(state: State<AppState>) -> BasemapPaths {
    let source = state.active_source();
    match crate::fetch::IslemapsVariant::for_source(source) {
        Some(variant) => {
            let path = variant.dest().to_string_lossy().into_owned();
            BasemapPaths {
                minimap: path.clone(),
                fullmap: path,
                source: source.key().to_string(),
                minimap_decode_width: Some(ISLEMAPS_MINIMAP_DECODE_WIDTH),
            }
        }
        None => {
            let fullmap = settings::basemap_dir()
                .join("fullmap.webp")
                .to_string_lossy()
                .into_owned();
            let decode_px = {
                let s = state.settings.lock_safe();
                (settings::get_f64(&s, &["minimap", "basemap_px"], 2600.0) as u32)
                    .clamp(VULNONA_MINIMAP_DECODE_MIN, VULNONA_MINIMAP_DECODE_MAX)
            };
            BasemapPaths {
                minimap: fullmap.clone(),
                fullmap,
                source: source.key().to_string(),
                minimap_decode_width: Some(decode_px),
            }
        }
    }
}

/// Switch the basemap imagery. Downloads the islemaps PNG on first selection
/// (blocking work off the async core), then patches settings (which
/// broadcasts `settings://changed`) and resyncs so both windows repaint in
/// the new frame. Settings are only ever patched on success, so "revert on
/// failure" needs no code. Deliberately does NOT emit `fetch://finished` —
/// that channel means "the vulnona+POI bundle finished" and drives first-run.
#[tauri::command]
pub async fn set_basemap_source(app: AppHandle, source: String) -> Result<(), String> {
    let src = MapSource::try_from_key(&source)
        .ok_or_else(|| format!("unknown basemap source {source:?}"))?;
    if let Some(variant) = crate::fetch::IslemapsVariant::for_source(src) {
        if !variant.dest().exists() {
            let app2 = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                crate::fetch::fetch_islemaps_with_events(&app2, variant, false)
            })
            .await
            .map_err(|e| e.to_string())??;
        }
    }
    apply_settings_patch(&app, serde_json::json!({ "map": { "basemap": src.key() } }));
    pipeline::resync(&app);
    // Counted here, not at entry: a failed imagery download leaves settings
    // untouched, so it must leave the counter untouched too.
    telemetry::counters::track("basemap_change");
    Ok(())
}

/// Raw pois_gateway.json (already px+cm normalised by the fetch step).
#[tauri::command]
pub fn get_pois() -> Result<Value, String> {
    let text = std::fs::read_to_string(settings::pois_path()).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PoiItem {
    pub label: String,
    pub px: f64,
    pub py: f64,
    /// cm, so the minimap can distance-filter without any transform.
    pub x_cm: f64,
    pub y_cm: f64,
    /// Circle zones: radius in basemap pixels.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius_px: Option<f64>,
    /// Polygon zones: vertices in basemap pixels.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points_px: Option<Vec<(f64, f64)>>,
    /// Zones: where to place the name label (polygon centroid, circle
    /// centre) — computed here so the frontend never does geometry.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_px: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_py: Option<f64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PoiLayer {
    pub key: String,
    /// "point" | "zone"
    pub kind: String,
    pub items: Vec<PoiItem>,
}

/// `get_pois_render` output for one (basemap, file) pair. The projection
/// depends on the active calibration, so the source is part of the key; the
/// file's mtime+len is the rest, which lets a re-download or an offline
/// upgrade of pois_gateway.json invalidate it without anyone remembering to.
pub struct PoisCache {
    source: MapSource,
    mtime: Option<std::time::SystemTime>,
    len: u64,
    layers: Vec<PoiLayer>,
}

/// One POI record -> render item, or None when it carries no usable geometry.
///
/// Polygon zones have NO top-level x/y (only `points`), so the world anchor is
/// derived from the vertex centroid. Reading `points` BEFORE the x/y lookup is
/// the whole point: the old order dropped every polygon zone before it ever
/// looked at them.
fn poi_render_item(item: &Value, kind: &str, cal: &Calibration) -> Option<PoiItem> {
    let shape = item.get("shape").and_then(|s| s.as_str());
    // Vertices in world cm first — they double as the anchor for polygons.
    let points_cm: Option<Vec<(f64, f64)>> = (shape == Some("polygon"))
        .then(|| item.get("points").and_then(|p| p.as_array()))
        .flatten()
        .map(|pts| {
            pts.iter()
                .filter_map(|p| Some((p.get(0)?.as_f64()?, p.get(1)?.as_f64()?)))
                .collect::<Vec<_>>()
        })
        .filter(|pts: &Vec<_>| pts.len() >= 3);

    let (x, y) = match (
        item.get("x").and_then(|v| v.as_f64()),
        item.get("y").and_then(|v| v.as_f64()),
    ) {
        (Some(x), Some(y)) => (x, y),
        // Vertex centroid is plenty for an anchor (and for name placement).
        _ => {
            let pts = points_cm.as_ref()?;
            let n = pts.len() as f64;
            (
                pts.iter().map(|p| p.0).sum::<f64>() / n,
                pts.iter().map(|p| p.1).sum::<f64>() / n,
            )
        }
    };
    let (px, py) = world_to_pixel(x, y, cal);

    // Same metres->basemap-pixels factor the original layers.py used.
    let radius_px = (shape == Some("circle"))
        .then(|| item.get("radius_m").and_then(|r| r.as_f64()))
        .flatten()
        .map(|r_m| r_m * 100.0 / 1000.0 / cal.span_y() * cal.image_width_px as f64)
        .filter(|r| *r > 0.0);
    let points_px = points_cm
        .map(|pts| pts.iter().map(|p| world_to_pixel(p.0, p.1, cal)).collect::<Vec<_>>());

    let (label_px, label_py) = if kind == "zone" {
        match &points_px {
            Some(pts) => {
                let n = pts.len() as f64;
                (
                    Some(pts.iter().map(|p| p.0).sum::<f64>() / n),
                    Some(pts.iter().map(|p| p.1).sum::<f64>() / n),
                )
            }
            None => (Some(px), Some(py)),
        }
    } else {
        (None, None)
    };

    Some(PoiItem {
        label: item
            .get("label")
            .and_then(|l| l.as_str())
            .unwrap_or_default()
            .to_string(),
        px,
        py,
        x_cm: x,
        y_cm: y,
        radius_px,
        points_px,
        label_px,
        label_py,
    })
}

/// POI layers with every coordinate already converted to basemap pixels —
/// the frontend renders, it never transforms.
///
/// Cached. Three callers — the full map on mount and after every fetch, and
/// the minimap window on its own — each used to read, parse and re-project
/// the whole 120 KB file (~630 items, ~1,300 polygon vertices) for a result
/// that only changes when the file or the basemap does.
#[tauri::command]
pub fn get_pois_render(state: State<AppState>) -> Result<Vec<PoiLayer>, String> {
    let source = state.active_source();
    let path = settings::pois_path();
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let mtime = meta.modified().ok();
    let len = meta.len();

    if let Some(c) = state.pois_cache.lock_safe().as_ref() {
        if c.source == source && c.mtime == mtime && c.len == len {
            return Ok(c.layers.clone());
        }
    }

    let layers = render_pois(&path, source.calibration())?;
    *state.pois_cache.lock_safe() = Some(PoisCache {
        source,
        mtime,
        len,
        layers: layers.clone(),
    });
    Ok(layers)
}

fn render_pois(path: &std::path::Path, cal: &Calibration) -> Result<Vec<PoiLayer>, String> {
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let raw: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let Some(layers) = raw.get("layers").and_then(|l| l.as_object()) else {
        return Ok(Vec::new());
    };

    let mut out = Vec::new();
    for (key, layer) in layers {
        let kind = layer
            .get("kind")
            .and_then(|k| k.as_str())
            .unwrap_or("point")
            .to_string();
        let items = layer
            .get("items")
            .and_then(|i| i.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| poi_render_item(item, &kind, cal))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        out.push(PoiLayer {
            key: key.clone(),
            kind,
            items,
        });
    }
    Ok(out)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NearestWaypoint {
    pub id: String,
    pub name: String,
    pub bearing_deg: f64,
    pub compass_key: &'static str,
    pub distance_m: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestTargetOut {
    pub index: usize,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_vi: Option<String>,
    pub completed: bool,
    /// The POI layer this quest points at, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::islepilot::quests_map::QuestTarget>,
}

/// Prime quests of the latest IslePilot update, each tagged with the POI layer
/// it refers to — the "show on map" list in the layer panel.
#[tauri::command]
pub fn quest_targets() -> Vec<QuestTargetOut> {
    crate::islepilot::last_prime_quests()
        .into_iter()
        .enumerate()
        .map(|(index, q)| QuestTargetOut {
            index,
            target: crate::islepilot::quests_map::target_for(&q.text),
            text: q.text,
            text_vi: q.text_vi,
            completed: q.completed,
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NearestZone {
    pub name: String,
    pub bearing_deg: f64,
    pub compass_key: &'static str,
    pub distance_m: f64,
    /// Render pixel on the active basemap, for a jump-to.
    pub px: f64,
    pub py: f64,
}

/// Closest item of a POI layer to the current position, with bearing —
/// generalises `nearest_waypoint` for the Prime-quest map hints. Reads the raw
/// POI file (every item carries a top-level x/y in cm, zones included).
#[tauri::command]
pub fn nearest_zone(state: State<AppState>, layer_key: String) -> Option<NearestZone> {
    let text = std::fs::read_to_string(settings::pois_path()).ok()?;
    let raw: Value = serde_json::from_str(&text).ok()?;
    let items = raw
        .get("layers")?
        .get(&layer_key)?
        .get("items")?
        .as_array()?;
    // Calibration before the tracker lock (active_calibration briefly locks
    // settings).
    let cal = state.active_calibration();
    let tracker = state.tracker.lock_safe();
    let mut best: Option<NearestZone> = None;
    for item in items {
        let (Some(x), Some(y)) = (
            item.get("x").and_then(Value::as_f64),
            item.get("y").and_then(Value::as_f64),
        ) else {
            continue;
        };
        let Some((bearing, dist)) = tracker.bearing_to(x, y) else {
            return None; // no current position yet
        };
        if best.as_ref().is_none_or(|b| dist < b.distance_m) {
            let (px, py) = world_to_pixel(x, y, cal);
            best = Some(NearestZone {
                name: item
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                bearing_deg: bearing,
                compass_key: bearing_to_compass_key(bearing),
                distance_m: dist,
                px,
                py,
            });
        }
    }
    best
}

/// Closest saved waypoint to the current position, with bearing — geometry
/// stays in Rust like every other transform. Waypoints in a hidden group are
/// skipped so the rim arrow never points at a dot you cannot see.
#[tauri::command]
pub fn nearest_waypoint(state: State<AppState>) -> Option<NearestWaypoint> {
    let hidden: Vec<String> = {
        let s = state.settings.lock_safe();
        settings::get_path(&s, &["hidden_waypoint_groups"])
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default()
    };
    let tracker = state.tracker.lock_safe();
    let waypoints = state.waypoints.lock_safe();
    let mut best: Option<NearestWaypoint> = None;
    for wp in waypoints.iter() {
        if wp
            .group
            .as_deref()
            .is_some_and(|g| hidden.iter().any(|h| h.as_str() == g))
        {
            continue;
        }
        let Some((bearing, dist)) = tracker.bearing_to(wp.x, wp.y) else {
            return None; // no current position yet
        };
        if best.as_ref().is_none_or(|b| dist < b.distance_m) {
            best = Some(NearestWaypoint {
                id: wp.id.clone(),
                name: wp.name.clone(),
                bearing_deg: bearing,
                compass_key: bearing_to_compass_key(bearing),
                distance_m: dist,
            });
        }
    }
    best
}

/// 0 = exclusive fullscreen (overlay cannot draw) -> the UI shows a warning
/// banner. None = game config not found.
#[tauri::command]
pub fn get_fullscreen_mode() -> Option<i32> {
    settings::read_game_fullscreen_mode()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedCoords {
    pub x_cm: f64,
    pub y_cm: f64,
    pub px: f64,
    pub py: f64,
    pub in_bounds: bool,
}

/// Parse a MANUALLY pasted coordinate string (friend's Discord message, own
/// notes) into world cm + active-basemap px, with the same parser and number
/// format the clipboard path uses. Manual input only — never wired to any
/// automatic source.
#[tauri::command]
pub fn resolve_coordinates(state: State<AppState>, text: String) -> Option<ResolvedCoords> {
    let format = {
        let s = state.settings.lock_safe();
        overlay_core::NumberFormat::from_setting(settings::get_str(&s, &["number_format"], "auto"))
    };
    let (x, y, _z) = overlay_core::parse_coordinates(&text, format)?;
    telemetry::counters::track("coord_resolve");
    let cal = state.active_calibration();
    let (px, py) = world_to_pixel(x, y, cal);
    Some(ResolvedCoords {
        x_cm: x,
        y_cm: y,
        px,
        py,
        in_bounds: overlay_core::is_in_bounds(px, py, cal),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelCoords {
    pub x_cm: f64,
    pub y_cm: f64,
    pub in_bounds: bool,
}

/// Game coords under a full-map pixel — the hover readout. Inverse of
/// `resolve_coordinates`; the transform stays single-sourced in Rust.
#[tauri::command]
pub fn pixel_to_coords(state: State<AppState>, px: f64, py: f64) -> PixelCoords {
    let cal = state.active_calibration();
    let (x_cm, y_cm) = pixel_to_world(px, py, cal);
    PixelCoords {
        x_cm,
        y_cm,
        in_bounds: overlay_core::is_in_bounds(px, py, cal),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasureResult {
    /// Per-leg distances in metres.
    pub legs_m: Vec<f64>,
    pub total_m: f64,
    /// Straight-line bearing from the first point to the last.
    pub bearing_deg: Option<f64>,
    pub compass_key: Option<&'static str>,
    /// Each input point as game cm (so it can be dictated to a friend).
    pub points_cm: Vec<(f64, f64)>,
}

/// The ruler tool: full-map pixels in, per-leg + total distance (m) and the
/// first->last bearing out. All geometry in Rust, straight from cm.
#[tauri::command]
pub fn measure(state: State<AppState>, points_px: Vec<(f64, f64)>) -> MeasureResult {
    measure_points(&points_px, state.active_calibration())
}

/// Pure core of `measure`, so the geometry is unit-testable without a running
/// app.
fn measure_points(points_px: &[(f64, f64)], cal: &Calibration) -> MeasureResult {
    let points_cm: Vec<(f64, f64)> = points_px
        .iter()
        .map(|&(px, py)| pixel_to_world(px, py, cal))
        .collect();
    let legs_m: Vec<f64> = points_cm
        .windows(2)
        .map(|w| overlay_core::distance_m(w[0].0, w[0].1, w[1].0, w[1].1))
        .collect();
    let total_m: f64 = legs_m.iter().sum();
    let (bearing_deg, compass_key) = if points_cm.len() >= 2 {
        let (a, b) = (points_cm[0], points_cm[points_cm.len() - 1]);
        let brg = overlay_core::bearing_deg(a.0, a.1, b.0, b.1, cal);
        (Some(brg), Some(bearing_to_compass_key(brg)))
    } else {
        (None, None)
    };
    MeasureResult {
        legs_m,
        total_m,
        bearing_deg,
        compass_key,
        points_cm,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExploredRender {
    /// `[left, top, right, bottom]` in active-basemap px, one per visited cell.
    pub cells: Vec<[f64; 4]>,
}

/// Visited grid cells (fog-of-war layer), each as a px rect on the active
/// basemap. The transform stays in Rust.
#[tauri::command]
pub fn get_explored(state: State<AppState>) -> ExploredRender {
    let cal = state.active_calibration();
    let span = crate::explored::cell_span_cm();
    let cells = crate::explored::cells_cm()
        .into_iter()
        .map(|(x_cm, y_cm)| {
            let (a_px, a_py) = world_to_pixel(x_cm, y_cm, cal);
            let (b_px, b_py) = world_to_pixel(x_cm + span, y_cm + span, cal);
            [a_px.min(b_px), a_py.min(b_py), a_px.max(b_px), a_py.max(b_py)]
        })
        .collect();
    ExploredRender { cells }
}

#[tauri::command]
pub fn reset_explored() -> Result<(), String> {
    crate::explored::reset().map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ routes ---

/// Project a list of game-cm points to active-basemap px (for drawing a saved
/// route). Batch form of the transform that otherwise lives only in Rust.
#[tauri::command]
pub fn world_points_to_px(state: State<AppState>, points: Vec<(f64, f64)>) -> Vec<[f64; 2]> {
    let cal = state.active_calibration();
    points
        .into_iter()
        .map(|(x, y)| {
            let (px, py) = world_to_pixel(x, y, cal);
            [px, py]
        })
        .collect()
}

#[tauri::command]
pub fn list_routes() -> Vec<crate::routes::Route> {
    crate::routes::load()
}

#[tauri::command]
pub fn save_route(name: String, points: Vec<(f64, f64)>) -> Result<crate::routes::Route, String> {
    if points.len() < 2 {
        return Err("a route needs at least two points".into());
    }
    let mut routes = crate::routes::load();
    let route = crate::routes::Route {
        id: crate::routes::new_id(),
        name: name.trim().to_string(),
        points,
    };
    routes.push(route.clone());
    crate::routes::save(&routes).map_err(|e| e.to_string())?;
    Ok(route)
}

#[tauri::command]
pub fn delete_route(id: String) -> Result<bool, String> {
    let mut routes = crate::routes::load();
    let before = routes.len();
    routes.retain(|r| r.id != id);
    let removed = routes.len() != before;
    if removed {
        crate::routes::save(&routes).map_err(|e| e.to_string())?;
    }
    Ok(removed)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapInfo {
    pub image_width_px: u32,
    pub image_height_px: u32,
    /// Basemap pixels per real-world metre, horizontal / vertical.
    pub px_per_m_x: f64,
    pub px_per_m_y: f64,
    /// "vulnona" | "islemaps_light" | "islemaps_dark"
    pub source: String,
    /// Image overlays drawn over the basemap (only those present on disk).
    pub overlays: Vec<OverlayRender>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayRender {
    /// Doubles as the layers.* visibility key.
    pub key: &'static str,
    /// Absolute path — the frontend feeds it through convertFileSrc.
    pub path: String,
    /// [left, top, right, bottom] in ACTIVE-calibration basemap px. The
    /// overlay image is stretched over this rect, so its own pixel size is
    /// irrelevant and it stays aligned on every basemap.
    pub bounds_px: [f64; 4],
}

/// Scale constants both windows need for their geometry maths — derived from
/// the ACTIVE calibration in Rust so the frontend holds no transform of its
/// own.
#[tauri::command]
pub fn get_map_info(state: State<AppState>) -> MapInfo {
    let source = state.active_source();
    let cal = source.calibration();
    let mut overlays = Vec::new();
    let freshwater = crate::fetch::freshwater_dest();
    if freshwater.exists() {
        // The overlay is painted in the islemaps frame; re-project its world
        // rect into the active basemap's px space.
        let frame = MapSource::IslemapsLight.calibration();
        let (left, top) = world_to_pixel(frame.min_x * 1000.0, frame.min_y * 1000.0, cal);
        let (right, bottom) = world_to_pixel(frame.max_x * 1000.0, frame.max_y * 1000.0, cal);
        overlays.push(OverlayRender {
            key: "freshwater",
            path: freshwater.to_string_lossy().into_owned(),
            bounds_px: [left, top, right, bottom],
        });
    }
    MapInfo {
        image_width_px: cal.image_width_px,
        image_height_px: cal.image_height_px,
        px_per_m_x: cal.image_width_px as f64 / (cal.span_y() * 10.0),
        px_per_m_y: cal.image_height_px as f64 / (cal.span_x() * 10.0),
        source: source.key().to_string(),
        overlays,
    }
}

/// Days since the POI/basemap data was last downloaded (from sources.json).
/// None when it has never been fetched. Drives a gentle "consider refreshing"
/// note in Settings — there is no reliable upstream version to compare, so
/// this nudges rather than claims an update exists.
#[tauri::command]
pub fn data_age_days() -> Option<i64> {
    let text = std::fs::read_to_string(settings::sources_path()).ok()?;
    let raw: Value = serde_json::from_str(&text).ok()?;
    let fetched = raw.get("fetched").and_then(Value::as_str)?;
    let date = chrono::NaiveDate::parse_from_str(fetched, "%Y-%m-%d").ok()?;
    Some((chrono::Local::now().date_naive() - date).num_days())
}

/// Start the first-run / re-download data fetch on a worker thread. Progress
/// arrives as `fetch://progress` events, completion as `fetch://finished`.
#[tauri::command]
pub fn fetch_data(app: AppHandle, force: bool) {
    telemetry::counters::track("data_fetch");
    std::thread::spawn(move || {
        crate::fetch::run(&app, force);
    });
}

/// Open the trails folder in Explorer (legacy-compatible path under
/// %APPDATA%\TheIsleOverlay).
#[tauri::command]
pub fn open_trails_folder(app: AppHandle) -> Result<(), String> {
    let dir = settings::trails_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Open the IslePilot login window; completion arrives as dino:// events.
/// MUST be async: building a webview window inside a synchronous command is
/// a documented deadlock/blank-window hazard on Windows.
#[tauri::command]
pub async fn islepilot_login(app: AppHandle, domain: String) -> Result<(), String> {
    telemetry::counters::track("islepilot_login");
    crate::islepilot::start_login(&app, domain)
}

#[tauri::command]
pub fn islepilot_cancel_login(app: AppHandle) {
    crate::islepilot::cancel_login(&app);
}

/// Manual fallback: validate + store a pasted Cookie header.
#[tauri::command]
pub async fn islepilot_set_cookie(
    app: AppHandle,
    domain: String,
    cookie: String,
) -> Result<(), String> {
    // Blocking HTTP validation happens off the async runtime's core threads.
    tauri::async_runtime::spawn_blocking(move || {
        crate::islepilot::manual_cookie(&app, domain, cookie)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// One-time Steam login against the CENTRAL overlay API (token mode — one
/// login works on every IslePilot server). Async for the same webview-
/// creation deadlock reason as islepilot_login.
#[tauri::command]
pub async fn islepilot_token_login(app: AppHandle) -> Result<(), String> {
    telemetry::counters::track("islepilot_login");
    crate::islepilot::start_token_login(&app)
}

/// Manual fallback for token mode: validate + store a pasted overlay token
/// (or a whole isle-overlay:// redirect URL).
#[tauri::command]
pub async fn islepilot_set_token(app: AppHandle, token: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::islepilot::manual_token(&app, token)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// IslePilot POIs (sanctuaries, migration/patrol zones, ...) as render
/// pixels for the full map. Token mode only; cached ~15 s in Rust.
#[tauri::command]
pub async fn islepilot_overlay_map(
    app: AppHandle,
) -> Result<crate::islepilot::OverlayMapRender, String> {
    tauri::async_runtime::spawn_blocking(move || crate::islepilot::overlay_map_render(&app))
        .await
        .map_err(|e| e.to_string())?
}

/// Download-and-cache a skinviewer CDN asset (3D model / texture); returns
/// the local file path for convertFileSrc. Public CDN, no auth — routed
/// through Rust because the CDN sends no CORS headers. `force` re-downloads
/// even on a cache hit — the 3D viewer sets it to retry once when a cached
/// file fails to decode (a CDN hiccup that served an error body with a 200
/// would otherwise poison the cache until manual deletion).
#[tauri::command]
pub async fn islepilot_cdn_asset(
    app: AppHandle,
    url: String,
    force: Option<bool>,
) -> Result<String, String> {
    let force = force.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || crate::islepilot::cdn_asset(&app, &url, force))
        .await
        .map_err(|e| e.to_string())?
}

/// Garage (gacha) listing: parked dinos + server flags. Token mode only.
#[tauri::command]
pub async fn islepilot_garage(
) -> Result<crate::islepilot::api::GarageState, String> {
    tauri::async_runtime::spawn_blocking(crate::islepilot::garage_fetch)
        .await
        .map_err(|e| e.to_string())?
}

/// Park the CURRENT dino into the garage. Blocks through the async-command
/// status poll (up to ~60 s), so the frontend should show a busy state.
#[tauri::command]
pub async fn islepilot_garage_park() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::islepilot::garage_action(
            "/api/overlay/garage/park",
            serde_json::json!({ "step": "start" }),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn islepilot_garage_restore(id: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::islepilot::garage_action(
            &format!("/api/overlay/garage/{id}/restore"),
            serde_json::json!({}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn islepilot_garage_sell(id: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::islepilot::garage_action(
            &format!("/api/overlay/garage/{id}/sell"),
            serde_json::json!({}),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn islepilot_garage_rename(id: String, name: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::islepilot::garage_action(
            &format!("/api/overlay/garage/{id}/rename"),
            serde_json::json!({ "name": name }),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Slay (kill) the CURRENT in-game dino. Server-gated by
/// `garage.settings.selfSlayEnabled`; blocks through the async-command poll.
#[tauri::command]
pub async fn islepilot_garage_slay() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::islepilot::garage_action("/api/overlay/garage/slay", serde_json::json!({}))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn islepilot_logout(app: AppHandle) -> Result<(), String> {
    crate::islepilot::logout(&app)
}

// --- skin editor: IslePilot "apply live on your dino" (opt-in) --------------

/// The account's saved skin presets. Token mode only.
#[tauri::command]
pub async fn islepilot_skin() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(crate::islepilot::skin_fetch)
        .await
        .map_err(|e| e.to_string())?
}

/// Save or delete a skin preset on IslePilot (`{action:"save"|"delete", …}`).
#[tauri::command]
pub async fn islepilot_skin_preset(body: Value) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || crate::islepilot::skin_preset(body))
        .await
        .map_err(|e| e.to_string())?
}

/// Queue a live skin state to broadcast on the realtime socket. `state` is the
/// `{skin_body_r: 0.4, …}` RGB-float map the official overlay uses.
#[tauri::command]
pub fn islepilot_send_liveskin(state: Value) {
    crate::islepilot::send_liveskin(state);
}

/// Re-read islepilot settings and (re)start/stop the poller accordingly —
/// the Dino tab calls this after toggling enabled/interval/map-position.
#[tauri::command]
pub fn islepilot_apply(app: AppHandle) {
    crate::islepilot::restart_poller(&app);
}

#[tauri::command]
pub fn islepilot_state(app: AppHandle) -> crate::islepilot::IslepilotState {
    crate::islepilot::current_state(&app)
}

/// Local "your dino" stat history for the tab's charts. `range_hours <= 0`
/// means the whole current segment. Reads a JSONL file off the async pool.
#[tauri::command]
pub async fn dino_history(
    range_hours: f64,
) -> Result<crate::islepilot::history::HistorySeries, String> {
    tauri::async_runtime::spawn_blocking(move || crate::islepilot::history::query(range_hours))
        .await
        .map_err(|e| e.to_string())
}

/// Wipe the local stat-history file (the "Clear history" button).
#[tauri::command]
pub fn dino_history_clear() -> Result<(), String> {
    crate::islepilot::history::clear().map_err(|e| e.to_string())
}

/// Fire a sample notification — the "Send test" button in the alerts settings.
#[tauri::command]
pub fn alerts_test(app: AppHandle) {
    crate::islepilot::alerts::test_notification(&app);
}

// --- supporter license ----------------------------------------------------

/// Current supporter status from the local (signed) cache — no network.
#[tauri::command]
pub fn license_status() -> crate::license::LicenseStatus {
    crate::license::status()
}

/// Validate a pasted key against the server and, on success, persist it.
#[tauri::command]
pub async fn license_activate(key: String) -> Result<crate::license::LicenseStatus, String> {
    tauri::async_runtime::spawn_blocking(move || crate::license::activate(&key))
        .await
        .map_err(|e| e.to_string())
}

/// Re-check the stored key against the server (the "Check again" button).
#[tauri::command]
pub async fn license_refresh() -> Result<crate::license::LicenseStatus, String> {
    tauri::async_runtime::spawn_blocking(crate::license::refresh)
        .await
        .map_err(|e| e.to_string())
}

/// Forget the stored key — drops back to the free tier immediately.
#[tauri::command]
pub fn license_clear() -> crate::license::LicenseStatus {
    crate::license::deactivate()
}

/// Open an in-app purchase order (returns the VietQR + memo code, or `{error}`).
#[tauri::command]
pub async fn license_order_new() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(crate::license::order_new)
        .await
        .map_err(|e| e.to_string())?
}

/// Poll a purchase order: `{status, key}`. The frontend activates `key` itself
/// (via `license_activate`) once `status == "paid"`.
#[tauri::command]
pub async fn license_order_poll(code: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || crate::license::order_poll(&code))
        .await
        .map_err(|e| e.to_string())?
}

/// Dev-only: feed a fake sample through the real pipeline.
#[cfg(debug_assertions)]
#[tauri::command]
pub fn simulate_position(app: AppHandle, x: f64, y: f64, z: f64) {
    pipeline::ingest_sample(&app, x, y, z);
}

/// B5 — the minimap webview hands over its canvas' raw RGBA frame (top-down,
/// `width·height·4` bytes) and we drop it on the clipboard as an image. Runs on
/// a blocking thread: `OpenClipboard` can spin briefly while another app holds
/// the clipboard.
#[tauri::command]
pub async fn copy_map_snapshot(width: u32, height: u32, data: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::snapshot::copy_rgba_to_clipboard(width as i32, height as i32, &data)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn cal() -> &'static Calibration {
        Calibration::gateway()
    }

    #[test]
    fn measure_empty_and_single_point_have_no_bearing() {
        let m0 = measure_points(&[], cal());
        assert_eq!(m0.total_m, 0.0);
        assert!(m0.legs_m.is_empty());
        assert!(m0.bearing_deg.is_none() && m0.compass_key.is_none());

        let m1 = measure_points(&[(100.0, 200.0)], cal());
        assert_eq!(m1.points_cm.len(), 1);
        assert!(m1.bearing_deg.is_none());
    }

    #[test]
    fn measure_total_is_the_sum_of_legs() {
        let m = measure_points(&[(0.0, 0.0), (500.0, 0.0), (500.0, 800.0)], cal());
        assert_eq!(m.legs_m.len(), 2);
        assert!((m.total_m - (m.legs_m[0] + m.legs_m[1])).abs() < 1e-9);
        assert!(m.compass_key.is_some(), "3 points -> a first->last bearing");
    }

    #[test]
    fn measure_leg_length_scales_by_px_per_metre() {
        let c = cal();
        // A pure-horizontal 1000 px leg on the basemap.
        let m = measure_points(&[(1000.0, 1000.0), (2000.0, 1000.0)], c);
        let px_per_m = c.image_width_px as f64 / (c.span_y() * 10.0);
        assert!((m.total_m - 1000.0 / px_per_m).abs() < 1.0, "total was {}", m.total_m);
    }

    /// The regression this module exists for: zone polygons carry `points`
    /// and NO top-level x/y, and used to be dropped before `points` was read.
    #[test]
    fn polygon_zone_without_xy_still_renders() {
        let item = json!({
            "shape": "polygon",
            "label": "Swamp",
            "points": [[228_100.0, -31_000.0], [361_000.0, -31_000.0],
                       [361_000.0, 141_000.0], [228_100.0, 141_000.0]],
        });
        let out = poi_render_item(&item, "zone", cal()).expect("polygon must survive");
        let pts = out.points_px.expect("points_px");
        assert_eq!(pts.len(), 4);
        // Anchor and label both sit on the vertex centroid (the two are
        // computed either side of the projection, so compare with a tolerance).
        assert!((out.px - out.label_px.unwrap()).abs() < 1e-6);
        assert!((out.py - out.label_py.unwrap()).abs() < 1e-6);
        let (cx, cy) = world_to_pixel(294_550.0, 55_000.0, cal());
        assert!((out.px - cx).abs() < 1e-6 && (out.py - cy).abs() < 1e-6);
        assert!(out.radius_px.is_none());
    }

    #[test]
    fn circle_zone_is_unchanged() {
        let item = json!({
            "shape": "circle", "label": "Tide Beach",
            "x": -37_105.64, "y": 450_363.68, "radius_m": 625.72,
        });
        let out = poi_render_item(&item, "zone", cal()).expect("circle must survive");
        assert_eq!((out.x_cm, out.y_cm), (-37_105.64, 450_363.68));
        assert!(out.radius_px.unwrap() > 0.0);
        assert!(out.points_px.is_none());
        // Circle label sits at the centre.
        assert_eq!((out.label_px, out.label_py), (Some(out.px), Some(out.py)));
    }

    /// Under three vertices is not a polygon; with no x/y there is nothing
    /// left to anchor on, so the item is still skipped.
    #[test]
    fn degenerate_polygon_without_xy_is_skipped() {
        let item = json!({
            "shape": "polygon", "label": "sliver",
            "points": [[0.0, 0.0], [1000.0, 1000.0]],
        });
        assert!(poi_render_item(&item, "zone", cal()).is_none());
    }

    /// Against the real on-disk database, not a fixture: every zone item must
    /// survive into a render item. Before the fix 48 of them silently did not.
    ///
    /// `cargo test -- --ignored real_pois`
    #[test]
    #[ignore = "needs the downloaded pois_gateway.json"]
    fn real_pois_lose_no_zone() {
        let text = std::fs::read_to_string(settings::pois_path()).unwrap();
        let raw: Value = serde_json::from_str(&text).unwrap();
        for (key, layer) in raw["layers"].as_object().unwrap() {
            let kind = layer["kind"].as_str().unwrap();
            if kind != "zone" {
                continue;
            }
            let items = layer["items"].as_array().unwrap();
            let rendered = items
                .iter()
                .filter(|i| poi_render_item(i, kind, cal()).is_some())
                .count();
            assert_eq!(rendered, items.len(), "{key} lost zones");
        }
    }

    #[test]
    fn point_poi_gets_no_zone_label_anchor() {
        let item = json!({ "label": "", "x": 1000.0, "y": 2000.0 });
        let out = poi_render_item(&item, "point", cal()).expect("point must survive");
        assert_eq!((out.label_px, out.label_py), (None, None));
    }
}
