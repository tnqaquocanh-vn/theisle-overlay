//! Saved multi-point routes for the full-map planner. Same storage rules as
//! waypoints: small, roaming (`%APPDATA%\TheIsleOverlay\routes.json`), points
//! in raw UE cm so a re-calibration never corrupts them.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: String,
    #[serde(default)]
    pub name: String,
    /// Ordered points, game cm (x, y).
    pub points: Vec<(f64, f64)>,
}

fn routes_path() -> PathBuf {
    settings::roaming_dir().join("routes.json")
}

pub fn load() -> Vec<Route> {
    let Ok(text) = std::fs::read_to_string(routes_path()) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    value
        .get("routes")
        .and_then(|r| r.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|it| serde_json::from_value(it.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

pub fn save(routes: &[Route]) -> std::io::Result<()> {
    settings::save_json(
        &routes_path(),
        &serde_json::json!({ "version": 1, "routes": routes }),
    )
}

pub fn new_id() -> String {
    format!("rt_{}", &uuid::Uuid::new_v4().simple().to_string()[..8])
}
