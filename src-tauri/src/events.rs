//! Event names and payload shapes shared with the frontend. Rust emits KEYS
//! and numbers only, never display strings — localisation happens in the
//! webview.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const POSITION_UPDATE: &str = "position://update";
pub const TRAIL_CHANGED: &str = "trail://changed";
pub const SETTINGS_CHANGED: &str = "settings://changed";

/// Every payload carries both raw cm and precomputed px: the frontend never
/// runs a coordinate transform of its own.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionUpdate {
    pub x_cm: f64,
    pub y_cm: f64,
    pub z_cm: f64,
    pub px: f64,
    pub py: f64,
    pub heading_deg: Option<f64>,
    /// Compass key ("dir.N".."dir.NW") for the heading, when known.
    pub compass_key: Option<&'static str>,
    pub in_bounds: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrailPayload {
    pub segments_cm: Vec<Vec<(f64, f64)>>,
    pub segments_px: Vec<Vec<(f64, f64)>>,
}

/// One point of a session replay, projected to the active basemap and stamped
/// with a compressed playback clock (see `store::load_trail_replay`).
#[derive(Debug, Clone, Copy, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReplayPointOut {
    pub px: f64,
    pub py: f64,
    pub clock_ms: f64,
    /// Wall-clock epoch ms of this sample — lets the frontend line the
    /// playback clock up with the stats history (A6 overlay).
    pub real_ms: f64,
}

/// A past session ready for the replay scrubber (A6).
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrailReplayPayload {
    pub points: Vec<ReplayPointOut>,
    /// Indices in `points` the marker teleports to — a `break` or a squeezed idle.
    pub gaps: Vec<usize>,
    /// Total playback length in ms (the last point's clock).
    pub duration_ms: f64,
    /// ISO stamp of the first sample, for a caption ("2026-08-30T14:23:05+07:00").
    pub started_iso: Option<String>,
}

/// Broadcast to every window, hidden ones included. Hidden webviews stay
/// alive (suspension was removed — see webview_mem.rs) and are deliberately
/// kept current, so a window being shown again is already up to date;
/// `pipeline::resync` remains only as belt-and-braces for reloads.
pub fn emit_all<S: Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    if let Err(e) = app.emit(event, payload) {
        log::warn!("emit {event} failed: {e}");
    }
}
