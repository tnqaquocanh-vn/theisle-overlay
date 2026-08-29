//! "Where have I been" — a coarse grid of visited cells, accumulated across
//! sessions, that feeds the optional fog-of-war overlay on both maps.
//!
//! Deliberately low resolution: a 500 m cell means a fully-explored Gateway is
//! only a few hundred entries, so the whole set fits in one small JSON array
//! and both windows can redraw it every frame without thinking about it.
//!
//! Fed from `pipeline::ingest_sample`, so every accepted position (clipboard,
//! replay, live-map) marks its cell. Nothing here touches the game.

use std::collections::HashSet;
use std::sync::Mutex;

use crate::settings;
use crate::state::LockExt;

/// Grid cell size in game cm. 50_000 cm = 500 m.
const CELL_CM: f64 = 50_000.0;

static CELLS: Mutex<Option<HashSet<(i32, i32)>>> = Mutex::new(None);

fn path() -> std::path::PathBuf {
    settings::local_dir().join("explored.json")
}

fn cell_of(x_cm: f64, y_cm: f64) -> (i32, i32) {
    ((x_cm / CELL_CM).floor() as i32, (y_cm / CELL_CM).floor() as i32)
}

fn load() -> HashSet<(i32, i32)> {
    std::fs::read_to_string(path())
        .ok()
        .and_then(|t| serde_json::from_str::<Vec<(i32, i32)>>(&t).ok())
        .map(|v| v.into_iter().collect())
        .unwrap_or_default()
}

fn store(set: &HashSet<(i32, i32)>) {
    let v: Vec<(i32, i32)> = set.iter().copied().collect();
    if let Err(e) = settings::save_json(&path(), &serde_json::json!(v)) {
        log::debug!("explored.json save: {e}");
    }
}

fn with_set<R>(f: impl FnOnce(&mut HashSet<(i32, i32)>) -> R) -> R {
    let mut guard = CELLS.lock_safe();
    let set = guard.get_or_insert_with(load);
    f(set)
}

/// Mark the cell holding this position visited. Returns true only when the
/// cell was NEW, so the caller can broadcast a one-off refresh.
pub fn record(x_cm: f64, y_cm: f64) -> bool {
    let cell = cell_of(x_cm, y_cm);
    with_set(|set| {
        if set.insert(cell) {
            store(set);
            true
        } else {
            false
        }
    })
}

/// Every visited cell's TOP-LEFT corner in game cm — the caller projects to
/// the active basemap.
pub fn cells_cm() -> Vec<(f64, f64)> {
    with_set(|set| {
        set.iter()
            .map(|&(cx, cy)| (cx as f64 * CELL_CM, cy as f64 * CELL_CM))
            .collect()
    })
}

pub fn cell_span_cm() -> f64 {
    CELL_CM
}

/// Wipe the history (the "reset" button).
pub fn reset() -> std::io::Result<()> {
    with_set(|set| set.clear());
    match std::fs::remove_file(path()) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cells_are_500m_and_floor_toward_negative() {
        assert_eq!(cell_of(0.0, 0.0), (0, 0));
        assert_eq!(cell_of(49_999.0, 50_001.0), (0, 1));
        assert_eq!(cell_of(-1.0, -50_001.0), (-1, -2));
    }
}
