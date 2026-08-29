//! Local time-series of "your dino" stats.
//!
//! The poller already pulls growth / HP / hunger / thirst / stamina / Prime
//! every few seconds and then throws it away. This module appends one compact
//! JSON-Lines record per good `publish()` to
//! `%LOCALAPPDATA%\TheIsleOverlay\dino_history.jsonl`, so the Your Dino tab can
//! draw a growth curve and estimate drain rates.
//!
//! Same leniency as the trail store: a corrupt line is skipped, a missing file
//! is an empty series, and a failed write is logged and forgotten — history is
//! rebuildable and must never disturb the poller.
//!
//! Nothing here touches the game or the network. The file is raw UE values
//! (cur/max), never percentages — recalibrating display later loses nothing.

use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::settings;
use crate::state::LockExt;

use super::DinoUpdate;

/// Do not append more often than this while the segment identity is unchanged.
/// At a 5 s poll interval that is one record every sixth poll (~2 MB / week);
/// a server or dino change writes immediately regardless.
const MIN_INTERVAL_S: i64 = 30;

/// Chart point budget after range filtering — a sparkline needs no more.
const MAX_POINTS: usize = 300;

/// A break in the current segment: growth dropping by more than this many
/// points between consecutive records means a death / new dino, not decay.
const DEATH_DROP_PCT: f64 = 3.0;

/// A gap longer than this between records ends the segment (session break —
/// the older data is stale and joining across it would invent a trend).
const SEGMENT_GAP_S: i64 = 1800;

/// (last write unix-seconds, segment key) — the append throttle.
static LAST: Mutex<Option<(i64, String)>> = Mutex::new(None);

fn history_path() -> PathBuf {
    settings::local_dir().join("dino_history.jsonl")
}

fn now_s() -> i64 {
    chrono::Utc::now().timestamp()
}

/// One stored sample. Keys are terse on purpose — this line is appended every
/// ~30 s for as long as the app runs.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Rec {
    /// unix seconds
    t: i64,
    #[serde(rename = "s", default, skip_serializing_if = "String::is_empty")]
    server: String,
    #[serde(rename = "d", default, skip_serializing_if = "String::is_empty")]
    dino: String,
    #[serde(rename = "g", default, skip_serializing_if = "Option::is_none")]
    growth: Option<f64>,
    #[serde(rename = "h", default, skip_serializing_if = "Option::is_none")]
    hp: Option<f64>,
    #[serde(rename = "hm", default, skip_serializing_if = "Option::is_none")]
    hp_max: Option<f64>,
    #[serde(rename = "u", default, skip_serializing_if = "Option::is_none")]
    hunger: Option<f64>,
    #[serde(rename = "um", default, skip_serializing_if = "Option::is_none")]
    hunger_max: Option<f64>,
    #[serde(rename = "w", default, skip_serializing_if = "Option::is_none")]
    thirst: Option<f64>,
    #[serde(rename = "wm", default, skip_serializing_if = "Option::is_none")]
    thirst_max: Option<f64>,
    #[serde(rename = "st", default, skip_serializing_if = "Option::is_none")]
    stam: Option<f64>,
    #[serde(rename = "stm", default, skip_serializing_if = "Option::is_none")]
    stam_max: Option<f64>,
    #[serde(rename = "pd", default, skip_serializing_if = "Option::is_none")]
    prime_done: Option<u32>,
    #[serde(rename = "pt", default, skip_serializing_if = "Option::is_none")]
    prime_total: Option<u32>,
    #[serde(rename = "on", default, skip_serializing_if = "Option::is_none")]
    online: Option<bool>,
}

impl Rec {
    fn segment_key(&self) -> String {
        format!("{}|{}", self.server, self.dino)
    }
}

// --------------------------------------------------------------- write path ---

/// Append a record for a good update. No-op for error / no-dino updates and
/// while inside the throttle window.
pub fn record(update: &DinoUpdate) {
    if update.error.is_some() {
        return;
    }
    let Some(player) = update.player.as_ref().filter(|p| p.looks_logged_in()) else {
        return;
    };

    let bar = |b: &Option<super::parser::StatBar>| -> (Option<f64>, Option<f64>) {
        b.as_ref().map_or((None, None), |x| (x.current, x.max))
    };
    let (hp, hp_max) = bar(&player.health);
    let (hunger, hunger_max) = bar(&player.hunger);
    let (thirst, thirst_max) = bar(&player.thirst);
    let (stam, stam_max) = bar(&player.stamina);

    let rec = Rec {
        t: now_s(),
        server: player.server.clone().unwrap_or_default(),
        dino: player.dino_name.clone().unwrap_or_default(),
        growth: player.growth_pct,
        hp,
        hp_max,
        hunger,
        hunger_max,
        thirst,
        thirst_max,
        stam,
        stam_max,
        prime_done: Some(player.prime_quests.iter().filter(|q| q.completed).count() as u32),
        prime_total: Some(player.prime_quests.len() as u32),
        online: player.online,
    };

    {
        let mut last = LAST.lock_safe();
        let throttled = matches!(
            last.as_ref(),
            Some((t, key)) if *key == rec.segment_key() && rec.t - *t < MIN_INTERVAL_S
        );
        if throttled {
            return;
        }
        *last = Some((rec.t, rec.segment_key()));
    }

    match serde_json::to_string(&rec) {
        Ok(line) => append_line(&line),
        Err(e) => log::debug!("dino history serialize: {e}"),
    }
}

fn append_line(line: &str) {
    let path = history_path();
    let result: std::io::Result<()> = (|| {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut f = OpenOptions::new().create(true).append(true).open(&path)?;
        f.write_all(line.as_bytes())?;
        f.write_all(b"\n")
    })();
    if let Err(e) = result {
        log::debug!("dino history write: {e}");
    }
}

/// Delete the whole history (the "Clear history" button). A missing file is
/// success. Resets the throttle so the next poll records immediately.
pub fn clear() -> std::io::Result<()> {
    *LAST.lock_safe() = None;
    match std::fs::remove_file(history_path()) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    }
}

/// Drop records older than `max_age_days` and rewrite the file. Called once on
/// startup, off-thread — a no-op when nothing is stale.
pub fn prune(max_age_days: i64) {
    let path = history_path();
    let Ok(text) = std::fs::read_to_string(&path) else {
        return;
    };
    let recs = parse_lines(&text);
    if recs.is_empty() {
        return;
    }
    let cutoff = now_s() - max_age_days.max(1) * 86_400;
    let kept: Vec<&Rec> = recs.iter().filter(|r| r.t >= cutoff).collect();
    if kept.len() == recs.len() {
        return;
    }
    let body: String = kept
        .iter()
        .copied()
        .filter_map(|r| serde_json::to_string(r).ok())
        .collect::<Vec<_>>()
        .join("\n");
    let tmp = path.with_extension("jsonl.tmp");
    if std::fs::write(&tmp, format!("{body}\n")).is_ok() {
        let _ = std::fs::rename(&tmp, &path);
    }
    log::info!(
        "dino history pruned {} -> {} records",
        recs.len(),
        kept.len()
    );
}

// ---------------------------------------------------------------- read path ---

/// Chart-ready view of the CURRENT segment (this dino, this server, since the
/// last death / long gap), decimated and annotated with derived rates.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistorySeries {
    pub points: Vec<HistPoint>,
    /// Growth %-points per hour (least-squares over the segment).
    pub growth_rate_per_h: Option<f64>,
    /// Hours until growth reaches 100 at the current rate.
    pub eta_adult_h: Option<f64>,
    /// Hunger / thirst %-points LOST per hour (positive = draining).
    pub hunger_drain_per_h: Option<f64>,
    pub thirst_drain_per_h: Option<f64>,
    /// Hours until hunger / thirst hits 0 at the current rate.
    pub hunger_empty_h: Option<f64>,
    pub thirst_empty_h: Option<f64>,
    /// Wall-clock span the segment actually covers, in hours.
    pub span_h: f64,
    /// Records in the whole file — drives the "Clear history" affordance.
    pub total_records: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistPoint {
    pub t: i64,
    pub growth_pct: Option<f64>,
    pub health_pct: Option<f64>,
    pub hunger_pct: Option<f64>,
    pub thirst_pct: Option<f64>,
    pub stamina_pct: Option<f64>,
    pub prime_done: Option<u32>,
    pub prime_total: Option<u32>,
}

/// Read the file and build the series. `range_hours <= 0` means "all".
pub fn query(range_hours: f64) -> HistorySeries {
    let text = std::fs::read_to_string(history_path()).unwrap_or_default();
    let recs = parse_lines(&text);
    build_series(&recs, range_hours, now_s())
}

/// Every stored sample whose timestamp falls in `[start_s, end_s]`, oldest
/// first, decimated to `MAX_POINTS`. For the A6 replay stat overlay: a raw
/// time window aligned to a past trail, NOT the "current segment / death
/// break" logic `query` applies.
pub fn query_between(start_s: i64, end_s: i64) -> Vec<HistPoint> {
    let text = std::fs::read_to_string(history_path()).unwrap_or_default();
    window(parse_lines(&text), start_s, end_s)
}

fn window(recs: Vec<Rec>, start_s: i64, end_s: i64) -> Vec<HistPoint> {
    let mut kept: Vec<Rec> = recs
        .into_iter()
        .filter(|r| r.t >= start_s && r.t <= end_s)
        .collect();
    kept.sort_by_key(|r| r.t);
    let refs: Vec<&Rec> = kept.iter().collect();
    decimate(&refs, MAX_POINTS)
}

fn parse_lines(text: &str) -> Vec<Rec> {
    text.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str::<Rec>(l).ok())
        .collect()
}

fn pct(cur: Option<f64>, max: Option<f64>) -> Option<f64> {
    match (cur, max) {
        (Some(c), Some(m)) if m > 0.0 => Some((c / m * 100.0).clamp(0.0, 100.0)),
        _ => None,
    }
}

/// The tail of `recs` that belongs to the current dino / server / life.
fn current_segment<'a>(recs: &[&'a Rec]) -> Vec<&'a Rec> {
    if recs.is_empty() {
        return Vec::new();
    }
    let mut start = 0;
    for i in 1..recs.len() {
        let (prev, cur) = (recs[i - 1], recs[i]);
        let ident_changed = prev.server != cur.server || prev.dino != cur.dino;
        let death = matches!(
            (prev.growth, cur.growth),
            (Some(a), Some(b)) if b + DEATH_DROP_PCT < a
        );
        let gap = cur.t - prev.t > SEGMENT_GAP_S;
        if ident_changed || death || gap {
            start = i;
        }
    }
    recs[start..].to_vec()
}

/// Least-squares slope of `f` against time, in units per HOUR. `None` for
/// fewer than three usable points or a degenerate time spread.
fn slope(recs: &[&Rec], f: impl Fn(&Rec) -> Option<f64>) -> Option<f64> {
    let pts: Vec<(f64, f64)> = recs
        .iter()
        .filter_map(|&r| Some((r.t as f64 / 3600.0, f(r)?)))
        .collect();
    if pts.len() < 3 {
        return None;
    }
    let n = pts.len() as f64;
    let sx: f64 = pts.iter().map(|p| p.0).sum();
    let sy: f64 = pts.iter().map(|p| p.1).sum();
    let sxx: f64 = pts.iter().map(|p| p.0 * p.0).sum();
    let sxy: f64 = pts.iter().map(|p| p.0 * p.1).sum();
    let denom = n * sxx - sx * sx;
    if denom.abs() < 1e-9 {
        return None;
    }
    Some((n * sxy - sx * sy) / denom)
}

fn to_point(r: &Rec) -> HistPoint {
    HistPoint {
        t: r.t,
        growth_pct: r.growth,
        health_pct: pct(r.hp, r.hp_max),
        hunger_pct: pct(r.hunger, r.hunger_max),
        thirst_pct: pct(r.thirst, r.thirst_max),
        stamina_pct: pct(r.stam, r.stam_max),
        prime_done: r.prime_done,
        prime_total: r.prime_total,
    }
}

fn decimate(recs: &[&Rec], max: usize) -> Vec<HistPoint> {
    if recs.len() <= max || max == 0 {
        return recs.iter().copied().map(to_point).collect();
    }
    let stride = recs.len().div_ceil(max).max(1);
    let mut out: Vec<HistPoint> = recs.iter().copied().step_by(stride).map(to_point).collect();
    if let Some(&last) = recs.last() {
        if out.last().map(|p| p.t) != Some(last.t) {
            out.push(to_point(last));
        }
    }
    out
}

fn build_series(recs: &[Rec], range_hours: f64, now: i64) -> HistorySeries {
    let total_records = recs.len();
    let mut ordered: Vec<&Rec> = recs.iter().collect();
    ordered.sort_by_key(|r| r.t);

    let segment = current_segment(&ordered);
    let cutoff = if range_hours <= 0.0 {
        i64::MIN
    } else {
        now - (range_hours * 3600.0) as i64
    };
    let segment: Vec<&Rec> = segment.into_iter().filter(|r| r.t >= cutoff).collect();

    let growth_rate = slope(&segment, |r| r.growth);
    let last_growth = segment.last().and_then(|r| r.growth);
    let eta_adult_h = match (growth_rate, last_growth) {
        (Some(rate), Some(g)) if rate > 0.01 && g < 100.0 => Some((100.0 - g) / rate),
        _ => None,
    };

    let hunger_slope = slope(&segment, |r| pct(r.hunger, r.hunger_max));
    let thirst_slope = slope(&segment, |r| pct(r.thirst, r.thirst_max));
    let drain = |s: Option<f64>| s.map(|v| -v).filter(|d| *d > 0.005);
    let empty_h = |s: Option<f64>, last: Option<f64>| match (s, last) {
        (Some(rate), Some(cur)) if rate < -0.005 => Some(cur / -rate),
        _ => None,
    };
    let last_hunger = segment.last().and_then(|r| pct(r.hunger, r.hunger_max));
    let last_thirst = segment.last().and_then(|r| pct(r.thirst, r.thirst_max));

    let span_h = match (segment.first(), segment.last()) {
        (Some(a), Some(b)) => (b.t - a.t) as f64 / 3600.0,
        _ => 0.0,
    };

    HistorySeries {
        points: decimate(&segment, MAX_POINTS),
        growth_rate_per_h: growth_rate.filter(|r| r.abs() > 1e-6),
        eta_adult_h,
        hunger_drain_per_h: drain(hunger_slope),
        thirst_drain_per_h: drain(thirst_slope),
        hunger_empty_h: empty_h(hunger_slope, last_hunger),
        thirst_empty_h: empty_h(thirst_slope, last_thirst),
        span_h,
        total_records,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(t: i64, server: &str, dino: &str, growth: f64) -> Rec {
        Rec {
            t,
            server: server.into(),
            dino: dino.into(),
            growth: Some(growth),
            hp: None,
            hp_max: None,
            hunger: None,
            hunger_max: None,
            thirst: None,
            thirst_max: None,
            stam: None,
            stam_max: None,
            prime_done: None,
            prime_total: None,
            online: Some(true),
        }
    }

    #[test]
    fn missing_file_is_an_empty_series() {
        let s = build_series(&[], 6.0, 1_000_000);
        assert!(s.points.is_empty());
        assert_eq!(s.total_records, 0);
        assert!(s.growth_rate_per_h.is_none());
    }

    #[test]
    fn skips_corrupt_lines_keeps_the_rest() {
        let text = "{\"t\":1,\"g\":10}\nnot json\n{\"t\":2,\"g\":11}\n";
        let recs = parse_lines(text);
        assert_eq!(recs.len(), 2);
        assert_eq!(recs[1].t, 2);
    }

    #[test]
    fn growth_rate_recovers_a_synthetic_slope() {
        // +2 %/h for 5 hours, sampled every 10 minutes.
        let recs: Vec<Rec> = (0..=30)
            .map(|i| rec(i * 600, "S", "Trike", 10.0 + (i as f64 / 6.0) * 2.0))
            .collect();
        let s = build_series(&recs, 0.0, 30 * 600);
        let rate = s.growth_rate_per_h.expect("a rate");
        assert!((rate - 2.0).abs() < 0.01, "rate was {rate}");
        // 10 -> ~20 over the window; ~40 h left to 100 at 2 %/h.
        let eta = s.eta_adult_h.expect("an eta");
        assert!((eta - 40.0).abs() < 1.0, "eta was {eta}");
    }

    #[test]
    fn segment_breaks_on_death() {
        let recs = vec![
            rec(0, "S", "Trike", 40.0),
            rec(600, "S", "Trike", 41.0),
            rec(1200, "S", "Trike", 2.0), // died, respawned small
            rec(1800, "S", "Trike", 3.0),
        ];
        let s = build_series(&recs, 0.0, 1800);
        assert_eq!(s.points.len(), 2, "only the post-death records");
        assert_eq!(s.points[0].growth_pct, Some(2.0));
    }

    #[test]
    fn segment_breaks_on_server_change() {
        let recs = vec![
            rec(0, "A", "Trike", 30.0),
            rec(600, "A", "Trike", 31.0),
            rec(1200, "B", "Trike", 31.0),
            rec(1800, "B", "Trike", 32.0),
        ];
        let s = build_series(&recs, 0.0, 1800);
        assert_eq!(s.points.len(), 2);
        assert_eq!(s.total_records, 4);
    }

    #[test]
    fn range_filter_trims_old_points() {
        // 12 hours of data, ask for the last 6.
        let recs: Vec<Rec> = (0..=72)
            .map(|i| rec(i * 600, "S", "Trike", 10.0 + i as f64 * 0.1))
            .collect();
        let now = 72 * 600;
        let s = build_series(&recs, 6.0, now);
        assert!(s.points.iter().all(|p| p.t >= now - 6 * 3600));
        assert!((s.span_h - 6.0).abs() < 0.2);
    }

    #[test]
    fn decimation_keeps_first_and_last() {
        let recs: Vec<Rec> = (0..2000).map(|i| rec(i, "S", "Trike", i as f64 * 0.01)).collect();
        let refs: Vec<&Rec> = recs.iter().collect();
        let pts = decimate(&refs, MAX_POINTS);
        assert!(pts.len() <= MAX_POINTS + 1);
        assert_eq!(pts.first().unwrap().t, 0);
        assert_eq!(pts.last().unwrap().t, 1999);
    }

    #[test]
    fn drain_rate_is_positive_when_falling() {
        let recs: Vec<Rec> = (0..=30)
            .map(|i| {
                let mut r = rec(i * 600, "S", "Trike", 20.0);
                r.hunger = Some(100.0 - i as f64 * 2.0); // losing 2/step
                r.hunger_max = Some(100.0);
                r
            })
            .collect();
        let s = build_series(&recs, 0.0, 30 * 600);
        let drain = s.hunger_drain_per_h.expect("a drain rate");
        // 2 per 10 min = 12 %/h.
        assert!((drain - 12.0).abs() < 0.1, "drain was {drain}");
        assert!(s.hunger_empty_h.unwrap() > 0.0);
    }

    #[test]
    fn window_keeps_only_in_range_records_sorted() {
        let recs = vec![
            rec(5000, "S", "Trike", 30.0),
            rec(1000, "S", "Trike", 10.0), // out of order on purpose
            rec(3000, "S", "Trike", 20.0),
            rec(9000, "S", "Trike", 40.0), // past the end
        ];
        let pts = window(recs, 2000, 6000);
        assert_eq!(pts.len(), 2);
        assert_eq!(pts[0].t, 3000);
        assert_eq!(pts[1].t, 5000);
        assert_eq!(pts[0].growth_pct, Some(20.0));
    }

    #[test]
    fn rec_round_trips_through_terse_json() {
        let r = rec(123, "PVN 01", "Tyrannosaurus", 26.5);
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"t\":123"));
        assert!(json.contains("\"g\":26.5"));
        // Absent optionals are not written.
        assert!(!json.contains("\"h\":"));
        let back: Rec = serde_json::from_str(&json).unwrap();
        assert_eq!(back.server, "PVN 01");
        assert_eq!(back.growth, Some(26.5));
    }
}
