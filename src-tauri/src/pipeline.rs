//! The one-way position flow: (clipboard | replay | debug) -> tracker -> both
//! windows. Port of the sample-handling wiring from the original `main.py`.

use overlay_core::{bearing_to_compass_key, world_to_pixel, Calibration};
// Note: every px in these payloads is computed with state.active_calibration()
// at emit time — nothing px-shaped is cached, so a basemap switch only needs a
// resync to repaint everything in the new frame.
use tauri::{AppHandle, Manager};

use crate::events::{
    emit_all, PositionUpdate, TrailPayload, POSITION_UPDATE, SETTINGS_CHANGED,
    TRAIL_CHANGED,
};
use crate::state::{AppState, LockExt};

/// A local-capture heading older than this falls back to movement heading.
const EXACT_HEADING_FRESHNESS_S: f64 = 2.0;
/// While a G1 sample is newer than this, remote providers stop feeding
/// position (they still feed vitals). Wider than the heading window so a
/// brief capture gap doesn't hand the marker back and forth.
const LOCALPOS_POSITION_FRESHNESS_S: f64 = 3.0;

/// A sample this close to the last one we broadcast is dropped: G1 capture and
/// the realtime socket push 5–22 Hz, and a still player would otherwise
/// repaint every window dozens of times a second for no visible change.
///
/// The turn threshold is deliberately just above the smoothed-heading noise
/// floor (mouse micro-jitter survives the EMA at well under 0.1°): a real turn
/// of even a few °/s then emits on *every* ingest tick, so the arrow rotates
/// at a steady cadence instead of the visible stair-step a coarser gate gave
/// during slow-to-medium turns. The keepalive still bounds staleness.
const POSITION_EMIT_MIN_MOVE_CM: f64 = 2.0;
const POSITION_EMIT_MIN_TURN_DEG: f64 = 0.18;
const POSITION_EMIT_KEEPALIVE_S: f64 = 0.5;

/// `(x_cm, y_cm, heading_deg | NaN, at_s)` of the last `POSITION_UPDATE` sent
/// through [`ingest_sample_with_heading`]. `resync` emits unconditionally and
/// does not touch this — a stale entry there only suppresses a redundant
/// repaint of a spot `resync` just painted.
static LAST_EMIT: std::sync::Mutex<Option<(f64, f64, f64, f64)>> = std::sync::Mutex::new(None);

/// Is G1 local capture currently the authoritative position source? Remote
/// providers check this and skip their own position ingest when true (P2).
pub fn localpos_position_fresh(state: &AppState) -> bool {
    fresh(&state.last_localpos_sample, state, LOCALPOS_POSITION_FRESHNESS_S)
}

/// Is the IslePilot realtime socket currently feeding position? The slower
/// REST poll checks this and yields so the marker doesn't hop each interval.
pub fn realtime_position_fresh(state: &AppState) -> bool {
    fresh(&state.last_realtime_sample, state, LOCALPOS_POSITION_FRESHNESS_S)
}

/// Record that a realtime-socket position sample was just ingested (G5).
pub fn mark_realtime_sample(state: &AppState) {
    *state.last_realtime_sample.lock_safe() = Some(state.now_s());
}

/// Current position as `(game_lat_cm, game_long_cm, z_cm, heading_deg)` — the
/// tracker's last sample plus the best available heading. `None` before the
/// first sample. Used by the team relay to publish the player's own marker.
pub fn current_world(state: &AppState) -> Option<(f64, f64, f64, Option<f64>)> {
    let now_s = state.now_s();
    let exact = match *state.last_exact_heading.lock_safe() {
        Some((h, at_s)) if now_s - at_s <= EXACT_HEADING_FRESHNESS_S => Some(h),
        _ => None,
    };
    let tracker = state.tracker.lock_safe();
    let cur = tracker.current?;
    let heading = exact.or_else(|| tracker.heading(now_s));
    Some((cur.x, cur.y, cur.z, heading))
}

fn fresh(slot: &std::sync::Mutex<Option<f64>>, state: &AppState, window_s: f64) -> bool {
    match *slot.lock_safe() {
        Some(at_s) => state.now_s() - at_s <= window_s,
        None => false,
    }
}

/// Feed one accepted coordinate sample through the tracker and notify the UI.
pub fn ingest_sample(app: &AppHandle, x: f64, y: f64, z: f64) {
    ingest_sample_with_heading(app, x, y, z, None, false);
}

/// As [`ingest_sample`], but with an EXACT heading already known for this
/// sample (G1 local capture and the IslePilot realtime socket both read the
/// control yaw directly). It overrides the movement-derived heading
/// everywhere — including [`current_payload`] on resync — while fresh.
///
/// `from_localpos` marks the sample as coming from G1 packet capture, which
/// takes precedence over remote providers' position (see
/// [`localpos_position_fresh`]).
pub fn ingest_sample_with_heading(
    app: &AppHandle,
    x: f64,
    y: f64,
    z: f64,
    exact_heading: Option<f64>,
    from_localpos: bool,
) {
    let state = app.state::<AppState>();
    let now_s = state.now_s();
    // Resolve the calibration BEFORE taking the tracker lock (active_calibration
    // briefly takes the settings lock).
    let cal = state.active_calibration();

    if let Some(h) = exact_heading {
        *state.last_exact_heading.lock_safe() = Some((h, now_s));
    }
    if from_localpos {
        *state.last_localpos_sample.lock_safe() = Some(now_s);
    }

    let (outcome, heading, trail) = {
        let mut tracker = state.tracker.lock_safe();
        let outcome = tracker.add_sample(x, y, z, now_s);
        let heading = exact_heading.or_else(|| tracker.heading(now_s));
        let trail = outcome
            .trail_changed
            .then(|| trail_payload(&tracker.segments, cal));
        (outcome, heading, trail)
    };

    // Persist AFTER releasing no locks out of order: trail writes follow the
    // same order the original used — break record first, then the sample.
    if !outcome.refreshed_only {
        if let Some(writer) = state.trail_writer.lock_safe().as_mut() {
            if outcome.broke_segment {
                writer.add_break();
            }
            writer.add(x, y, z);
        }
    }

    let (px, py) = world_to_pixel(x, y, cal);
    let payload = PositionUpdate {
        x_cm: x,
        y_cm: y,
        z_cm: z,
        px,
        py,
        heading_deg: heading,
        compass_key: heading.map(bearing_to_compass_key),
        in_bounds: overlay_core::is_in_bounds(px, py, cal),
    };

    // Drop repaints that would not visibly move anything (see LAST_EMIT).
    let should_emit = {
        let mut last = LAST_EMIT.lock_safe();
        let h = heading.unwrap_or(f64::NAN);
        let emit = match *last {
            Some((lx, ly, lh, lat_s)) => {
                let moved = ((x - lx).powi(2) + (y - ly).powi(2)).sqrt();
                let turned = if lh.is_nan() || h.is_nan() {
                    lh.is_nan() != h.is_nan()
                } else {
                    let d = (h - lh).rem_euclid(360.0);
                    d.min(360.0 - d) >= POSITION_EMIT_MIN_TURN_DEG
                };
                moved >= POSITION_EMIT_MIN_MOVE_CM
                    || turned
                    || now_s - lat_s >= POSITION_EMIT_KEEPALIVE_S
            }
            None => true,
        };
        if emit {
            *last = Some((x, y, h, now_s));
        }
        emit
    };

    if should_emit {
        emit_all(app, POSITION_UPDATE, payload);
    }
    if let Some(trail) = trail {
        emit_all(app, TRAIL_CHANGED, trail);
    }
    // Fog-of-war grid: only broadcasts when a genuinely new 500 m cell is
    // entered, which is rare enough to make the refetch free.
    if crate::explored::record(x, y) {
        emit_all(app, "explored://changed", ());
    }
}

/// The current tracker state as a PositionUpdate, or None before the first
/// sample. Shared by `resync` and the `get_current_position` command so a
/// freshly (re)loaded webview paints at once instead of waiting for the
/// player's next manual coordinate copy.
pub fn current_payload(state: &AppState) -> Option<PositionUpdate> {
    let now_s = state.now_s();
    let cal = state.active_calibration();
    let exact = match *state.last_exact_heading.lock_safe() {
        Some((h, at_s)) if now_s - at_s <= EXACT_HEADING_FRESHNESS_S => Some(h),
        _ => None,
    };
    let (current, heading) = {
        let tracker = state.tracker.lock_safe();
        (tracker.current, exact.or_else(|| tracker.heading(now_s)))
    };
    let cur = current?;
    let (px, py) = world_to_pixel(cur.x, cur.y, cal);
    Some(PositionUpdate {
        x_cm: cur.x,
        y_cm: cur.y,
        z_cm: cur.z,
        px,
        py,
        heading_deg: heading,
        compass_key: heading.map(bearing_to_compass_key),
        in_bounds: overlay_core::is_in_bounds(px, py, cal),
    })
}

/// Re-send the full current state to every window. Belt-and-braces: hidden
/// windows receive broadcasts and reloads fetch get_current_position, so
/// this mostly matters after a manual webview reload.
pub fn resync(app: &AppHandle) {
    let state = app.state::<AppState>();
    let cal = state.active_calibration();

    let trail = {
        let tracker = state.tracker.lock_safe();
        trail_payload(&tracker.segments, cal)
    };
    if let Some(payload) = current_payload(&state) {
        emit_all(app, POSITION_UPDATE, payload);
    }
    emit_all(app, TRAIL_CHANGED, trail);
    {
        let settings = state.settings.lock_safe().clone();
        emit_all(app, SETTINGS_CHANGED, settings);
    }
    emit_all(app, "waypoints://changed", ());
    crate::islepilot::emit_last(app);
}

pub fn trail_payload(segments_cm: &[Vec<(f64, f64)>], cal: &Calibration) -> TrailPayload {
    TrailPayload {
        segments_cm: segments_cm.to_vec(),
        segments_px: segments_cm
            .iter()
            .map(|seg| {
                seg.iter()
                    .map(|&(x, y)| world_to_pixel(x, y, cal))
                    .collect()
            })
            .collect(),
    }
}
