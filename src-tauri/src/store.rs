//! Waypoint and trail persistence. Port of `app/store.py`.
//!
//! IRON RULE: every coordinate persisted to disk is raw UE centimetres, never
//! pixels. Re-calibrating later must not corrupt saved data.
//!
//! Trails are append-only JSON Lines: one sample per line, flushed
//! immediately. Crash-safe and never rewrites the whole file.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::settings;

fn now_iso() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

// ------------------------------------------------------------- waypoints ---

/// Field names match the Python app's waypoints.json exactly; `group` is the
/// one addition (v2) — an old app / v1 file simply has no such key and it
/// loads as None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Waypoint {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub z: f64,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub created: Option<String>,
    /// Folder/group name (None = ungrouped). Added in waypoints.json v2.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

pub fn load_waypoints() -> Vec<Waypoint> {
    // A corrupt file must never stop the app from starting; individually
    // malformed entries are dropped, the rest kept.
    let Ok(text) = std::fs::read_to_string(settings::waypoints_path()) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    value
        .get("waypoints")
        .and_then(|w| w.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| serde_json::from_value(item.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

pub fn save_waypoints(waypoints: &[Waypoint]) -> std::io::Result<()> {
    settings::save_json(
        &settings::waypoints_path(),
        &serde_json::json!({ "version": 2, "waypoints": waypoints }),
    )
}

pub fn new_waypoint(name: &str, x: f64, y: f64, z: f64, color: Option<String>) -> Waypoint {
    Waypoint {
        id: format!("wp_{}", &uuid::Uuid::new_v4().simple().to_string()[..8]),
        name: name.to_string(),
        x,
        y,
        z,
        color,
        created: Some(now_iso()),
        group: None,
    }
}

// ----------------------------------------------------------------- trail ---

/// Appends each sample of the current session to its own JSONL file. The file
/// is created lazily on the first write, so an app run with no samples leaves
/// no empty file behind (and `latest_trail_path` at startup still points at
/// the previous session).
pub struct TrailWriter {
    pub path: PathBuf,
    file: Option<File>,
}

impl Default for TrailWriter {
    fn default() -> Self {
        Self::new()
    }
}

impl TrailWriter {
    pub fn new() -> Self {
        let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        Self {
            path: settings::trails_dir().join(format!("trail_{stamp}.jsonl")),
            file: None,
        }
    }

    fn open(&mut self) -> std::io::Result<&mut File> {
        if self.file.is_none() {
            std::fs::create_dir_all(settings::trails_dir())?;
            self.file = Some(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&self.path)?,
            );
        }
        Ok(self.file.as_mut().unwrap())
    }

    fn write_line(&mut self, line: &str) {
        // Trail persistence must never crash the overlay mid-game; failures
        // are logged and the session trail stays in memory regardless.
        let result: std::io::Result<()> = (|| {
            let file = self.open()?;
            file.write_all(line.as_bytes())?;
            file.write_all(b"\n")?;
            file.flush()
        })();
        if let Err(e) = result {
            log::warn!("trail write failed: {e}");
        }
    }

    pub fn add(&mut self, x: f64, y: f64, z: f64) {
        self.write_line(
            &serde_json::json!({ "t": now_iso(), "x": x, "y": y, "z": z }).to_string(),
        );
    }

    pub fn add_break(&mut self) {
        self.write_line(&serde_json::json!({ "t": now_iso(), "break": true }).to_string());
    }
}

/// Read one trail file into a list of DISJOINT segments.
///
/// `break` records split segments. Two consecutive samples can be hours and
/// kilometres apart (sampling is manual), and joining them with a straight
/// line would imply a journey that never happened.
pub fn load_trail(path: &Path) -> Vec<Vec<(f64, f64)>> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    let mut segments: Vec<Vec<(f64, f64)>> = Vec::new();
    let mut current: Vec<(f64, f64)> = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Skip corrupt lines, keep the rest.
        let Ok(rec) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if rec.get("break").and_then(|b| b.as_bool()).unwrap_or(false) {
            if current.len() > 1 {
                segments.push(std::mem::take(&mut current));
            } else {
                current.clear();
            }
        } else if let (Some(x), Some(y)) = (
            rec.get("x").and_then(|v| v.as_f64()),
            rec.get("y").and_then(|v| v.as_f64()),
        ) {
            current.push((x, y));
        }
    }
    if current.len() > 1 {
        segments.push(current);
    }
    segments
}

/// One replay sample in world centimetres, stamped with a *compressed*
/// playback clock (ms from the start of playback, not wall time). Long idle
/// spans and every `break` are squeezed to a short fixed hop so the scrubber
/// never sits on dead air through an AFK. `real_ms` keeps the sample's
/// wall-clock epoch so a caller can line the playback clock up with the
/// stats history (A6 overlay); it falls back to the compressed clock when the
/// file carried no parseable timestamp.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReplayPoint {
    pub x: f64,
    pub y: f64,
    pub clock_ms: f64,
    pub real_ms: i64,
}

/// Idle longer than this between two consecutive samples (and every `break`)
/// collapses to `REPLAY_HOP_MS` of playback time — the marker teleports.
const REPLAY_IDLE_MS: i64 = 5 * 60 * 1000;
const REPLAY_HOP_MS: f64 = 1500.0;

/// Read one trail file for the replay scrubber: a flat, time-ordered point
/// list on a compressed playback clock, plus the indices where the path was
/// cut (a `break` or a squeezed idle) so the caller can teleport the marker
/// instead of drawing a journey that never happened. The third value is the
/// ISO stamp of the first sample, for a "session of …" caption.
pub fn load_trail_replay(path: &Path) -> (Vec<ReplayPoint>, Vec<usize>, Option<String>) {
    let Ok(text) = std::fs::read_to_string(path) else {
        return (Vec::new(), Vec::new(), None);
    };
    // First pass: raw (x, y, epoch_ms?, a break preceded this point).
    let mut raw: Vec<(f64, f64, Option<i64>, bool)> = Vec::new();
    let mut first_iso: Option<String> = None;
    let mut pending_break = false;
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(rec) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if rec.get("break").and_then(serde_json::Value::as_bool).unwrap_or(false) {
            if !raw.is_empty() {
                pending_break = true;
            }
            continue;
        }
        let (Some(x), Some(y)) = (
            rec.get("x").and_then(serde_json::Value::as_f64),
            rec.get("y").and_then(serde_json::Value::as_f64),
        ) else {
            continue;
        };
        let iso = rec.get("t").and_then(serde_json::Value::as_str);
        let epoch_ms = iso
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.timestamp_millis());
        if first_iso.is_none() {
            first_iso = iso.map(str::to_string);
        }
        raw.push((x, y, epoch_ms, std::mem::take(&mut pending_break)));
    }
    // Second pass: build the compressed clock.
    let first_epoch = raw.iter().find_map(|&(_, _, e, _)| e);
    let mut points: Vec<ReplayPoint> = Vec::with_capacity(raw.len());
    let mut gaps: Vec<usize> = Vec::new();
    let mut clock = 0.0_f64;
    let mut prev_epoch: Option<i64> = None;
    for (i, &(x, y, epoch_ms, was_break)) in raw.iter().enumerate() {
        if i > 0 {
            let real_dt = match (prev_epoch, epoch_ms) {
                (Some(a), Some(b)) if b > a => (b - a).min(REPLAY_IDLE_MS * 4),
                // A missing/garbled stamp: assume manual samples ~1 s apart.
                _ => 1000,
            };
            if was_break || real_dt >= REPLAY_IDLE_MS {
                gaps.push(i);
                clock += REPLAY_HOP_MS;
            } else {
                clock += real_dt as f64;
            }
        }
        if epoch_ms.is_some() {
            prev_epoch = epoch_ms;
        }
        // A stamped point keeps its real epoch; an unstamped one (only the
        // dev fixtures) is pinned to the first real stamp plus its clock so
        // the value is at least monotonic.
        let real_ms = epoch_ms
            .or_else(|| first_epoch.map(|fe| fe + clock as i64))
            .unwrap_or(clock as i64);
        points.push(ReplayPoint { x, y, clock_ms: clock, real_ms });
    }
    (points, gaps, first_iso)
}

/// `load_trail_replay` for a bare `trail_*.jsonl` name in the trails dir.
pub fn read_named_trail_replay(name: &str) -> (Vec<ReplayPoint>, Vec<usize>, Option<String>) {
    let bad_char = name.contains('/') || name.contains('\\') || name.contains(':');
    if bad_char || !name.starts_with("trail_") || !name.ends_with(".jsonl") {
        return (Vec::new(), Vec::new(), None);
    }
    load_trail_replay(&settings::trails_dir().join(name))
}

/// One past-session trail file, for the "show an old trail" picker.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrailFile {
    /// Bare file name — the key passed back to `get_trail_file`.
    pub name: String,
    /// "2026-08-27 22:56" from the filename stamp (raw name if it does not parse).
    pub label: String,
    /// Rough sample count (non-empty lines).
    pub points: usize,
}

/// "trail_20260827_225643.jsonl" -> "2026-08-27 22:56".
fn trail_label(name: &str) -> String {
    let d: String = name.chars().filter(char::is_ascii_digit).collect();
    if d.len() >= 12 {
        format!(
            "{}-{}-{} {}:{}",
            &d[0..4], &d[4..6], &d[6..8], &d[8..10], &d[10..12]
        )
    } else {
        name.to_string()
    }
}

/// Every `trail_*.jsonl` in the trails dir, newest first. The current
/// session's file may appear once it has been written to.
pub fn list_trails() -> Vec<TrailFile> {
    let Ok(entries) = std::fs::read_dir(settings::trails_dir()) else {
        return Vec::new();
    };
    let mut out: Vec<TrailFile> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_str()?.to_string();
            if !name.starts_with("trail_") || !name.ends_with(".jsonl") {
                return None;
            }
            let points = std::fs::read_to_string(e.path())
                .map(|t| t.lines().filter(|l| !l.trim().is_empty()).count())
                .unwrap_or(0);
            Some(TrailFile {
                label: trail_label(&name),
                name,
                points,
            })
        })
        .collect();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out.reverse();
    out
}

/// Load a named trail file from the trails dir. `name` must be a bare
/// `trail_*.jsonl` file name — no path components.
pub fn read_named_trail(name: &str) -> Vec<Vec<(f64, f64)>> {
    let bad_char = name.contains('/') || name.contains('\\') || name.contains(':');
    if bad_char || !name.starts_with("trail_") || !name.ends_with(".jsonl") {
        return Vec::new();
    }
    load_trail(&settings::trails_dir().join(name))
}

pub fn latest_trail_path() -> Option<PathBuf> {
    let entries = std::fs::read_dir(settings::trails_dir()).ok()?;
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("trail_") && n.ends_with(".jsonl"))
        })
        .collect();
    files.sort();
    files.pop()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_trail_splits_on_breaks_and_skips_bad_lines() {
        let dir = std::env::temp_dir().join("theisle_overlay_test_trails");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("trail_test.jsonl");
        std::fs::write(
            &path,
            concat!(
                "{\"t\":\"x\",\"x\":1.0,\"y\":2.0,\"z\":0}\n",
                "{\"t\":\"x\",\"x\":3.0,\"y\":4.0,\"z\":0}\n",
                "not json at all\n",
                "{\"t\":\"x\",\"break\":true}\n",
                "{\"t\":\"x\",\"x\":5.0,\"y\":6.0,\"z\":0}\n",
            ),
        )
        .unwrap();
        let segments = load_trail(&path);
        // The single point after the break is dropped (< 2 nodes).
        assert_eq!(segments, vec![vec![(1.0, 2.0), (3.0, 4.0)]]);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn replay_clock_keeps_short_deltas_and_squeezes_idles_and_breaks() {
        let dir = std::env::temp_dir().join("theisle_overlay_test_replay");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("trail_replay_test.jsonl");
        // 0s, +5s, +7s (short), then a 20-min idle, then +3s, a break, +2s.
        std::fs::write(
            &path,
            concat!(
                "{\"t\":\"2026-08-30T10:00:00+07:00\",\"x\":0.0,\"y\":0.0,\"z\":0}\n",
                "{\"t\":\"2026-08-30T10:00:05+07:00\",\"x\":10.0,\"y\":0.0,\"z\":0}\n",
                "{\"t\":\"2026-08-30T10:00:07+07:00\",\"x\":20.0,\"y\":0.0,\"z\":0}\n",
                "{\"t\":\"2026-08-30T10:20:07+07:00\",\"x\":30.0,\"y\":0.0,\"z\":0}\n",
                "{\"t\":\"2026-08-30T10:20:10+07:00\",\"x\":40.0,\"y\":0.0,\"z\":0}\n",
                "{\"t\":\"2026-08-30T10:20:10+07:00\",\"break\":true}\n",
                "{\"t\":\"2026-08-30T10:20:12+07:00\",\"x\":50.0,\"y\":0.0,\"z\":0}\n",
            ),
        )
        .unwrap();
        let (points, gaps, first) = load_trail_replay(&path);
        assert_eq!(points.len(), 6);
        // Clock is monotonic and starts at 0.
        assert_eq!(points[0].clock_ms, 0.0);
        for w in points.windows(2) {
            assert!(w[1].clock_ms > w[0].clock_ms, "clock must advance");
        }
        // Real 5 s and 2 s deltas survive; the 20-min idle collapses to a
        // 1500 ms hop (not 1_200_000).
        assert_eq!(points[1].clock_ms, 5_000.0);
        assert_eq!(points[2].clock_ms, 7_000.0);
        assert_eq!(points[3].clock_ms, 7_000.0 + 1_500.0);
        // The idle and the break are both flagged as teleport points.
        assert_eq!(gaps, vec![3, 5]);
        assert_eq!(first.as_deref(), Some("2026-08-30T10:00:00+07:00"));
        // real_ms tracks true wall time even where the playback clock was
        // squeezed: 5 s between p0/p1, a full 20 min across the collapsed idle.
        assert!(points[0].real_ms > 1_000_000_000_000);
        assert_eq!(points[1].real_ms - points[0].real_ms, 5_000);
        assert_eq!(points[3].real_ms - points[2].real_ms, 20 * 60 * 1000);
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn trail_label_formats_the_filename_stamp() {
        assert_eq!(trail_label("trail_20260827_225643.jsonl"), "2026-08-27 22:56");
        assert_eq!(trail_label("trail_nope.jsonl"), "trail_nope.jsonl");
    }

    #[test]
    fn read_named_trail_rejects_path_escapes() {
        for bad in [
            "../secret.jsonl",
            "trail_x/../../y.jsonl",
            r"C:\evil.jsonl",
            "notatrail.txt",
            "trail_x.json", // wrong extension
        ] {
            assert!(read_named_trail(bad).is_empty(), "{bad} must be rejected");
        }
        // Well-formed but absent -> empty, no panic.
        assert!(read_named_trail("trail_20260101_000000.jsonl").is_empty());
    }

    #[test]
    fn waypoint_json_round_trips_python_format() {
        let json = r#"{"id":"wp_ab12cd34","name":"Hang da","x":-231654.353,"y":52099.673,"z":0.0,"color":null,"created":"2026-01-01T00:00:00+07:00"}"#;
        let wp: Waypoint = serde_json::from_str(json).unwrap();
        assert_eq!(wp.id, "wp_ab12cd34");
        assert_eq!(wp.name, "Hang da");
        // A v1 file has no `group`; it loads as None and is not written back.
        assert_eq!(wp.group, None);
        let back = serde_json::to_value(&wp).unwrap();
        assert_eq!(back["x"], -231654.353);
        assert_eq!(back["color"], serde_json::Value::Null);
        assert!(back.get("group").is_none(), "empty group is not serialised");
    }

    #[test]
    fn waypoint_group_round_trips_when_set() {
        let json = r#"{"id":"wp_1","name":"nest","x":1.0,"y":2.0,"z":0.0,"color":null,"created":null,"group":"Tổ"}"#;
        let wp: Waypoint = serde_json::from_str(json).unwrap();
        assert_eq!(wp.group.as_deref(), Some("Tổ"));
        assert_eq!(serde_json::to_value(&wp).unwrap()["group"], "Tổ");
    }
}
