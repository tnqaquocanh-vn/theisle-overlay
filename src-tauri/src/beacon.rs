//! P6 — "last seen" beacon. When the position signal goes quiet mid-session
//! (you died, disconnected, or just stopped copying coordinates), drop a
//! waypoint at the last known spot so it is easy to walk back to a corpse or
//! nest. The next fresh sample removes it again.
//!
//! Purely a waypoint drop/remove — nothing here touches the game. Off with
//! `settings.minimap.last_seen_beacon` (default on; the pin is deletable like
//! any other).

use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::settings;
use crate::state::{AppState, LockExt};
use crate::store;

/// A sample newer than this means the signal is live (re-arm, clear beacon).
const LIVE_S: f64 = 6.0;
/// Armed and no sample for this long -> drop the beacon.
const LOST_S: f64 = 30.0;
const CHECK_EVERY: Duration = Duration::from_secs(2);

pub fn spawn(app: AppHandle) {
    std::thread::Builder::new()
        .name("beacon".into())
        .spawn(move || run(app))
        .expect("spawn beacon");
}

fn run(app: AppHandle) {
    let mut armed = false;
    let mut beacon_id: Option<String> = None;

    loop {
        std::thread::sleep(CHECK_EVERY);
        let state = app.state::<AppState>();

        let enabled = {
            let s = state.settings.lock_safe();
            settings::get_bool(&s, &["minimap", "last_seen_beacon"], true)
        };
        if !enabled {
            if let Some(id) = beacon_id.take() {
                remove_waypoint(&app, &state, &id);
            }
            armed = false;
            continue;
        }

        let now_s = state.now_s();
        let sample = state.tracker.lock_safe().current;
        let Some(sample) = sample else {
            continue; // no position at all yet this session
        };
        let age = now_s - sample.at_s;

        if age < LIVE_S {
            armed = true;
            if let Some(id) = beacon_id.take() {
                remove_waypoint(&app, &state, &id); // signal came back
            }
        } else if armed && age > LOST_S && beacon_id.is_none() {
            let vi = {
                let s = state.settings.lock_safe();
                settings::get_str(&s, &["language"], "vi") != "en"
            };
            let name = if vi { "Vị trí cuối 💀" } else { "Last seen 💀" };
            let group = if vi { "Vị trí cuối" } else { "Last seen" };
            let mut wp = store::new_waypoint(name, sample.x, sample.y, sample.z, Some("#e2664a".into()));
            wp.group = Some(group.to_string());
            let id = wp.id.clone();
            {
                let mut waypoints = state.waypoints.lock_safe();
                waypoints.push(wp);
                let _ = store::save_waypoints(&waypoints);
            }
            crate::events::emit_all(&app, "waypoints://changed", ());
            log::info!("beacon: dropped last-seen waypoint at {:.0},{:.0}", sample.x, sample.y);
            beacon_id = Some(id);
            armed = false;
        }
    }
}

fn remove_waypoint(app: &AppHandle, state: &AppState, id: &str) {
    {
        let mut waypoints = state.waypoints.lock_safe();
        let before = waypoints.len();
        waypoints.retain(|w| w.id != id);
        if waypoints.len() == before {
            return;
        }
        let _ = store::save_waypoints(&waypoints);
    }
    crate::events::emit_all(app, "waypoints://changed", ());
}
