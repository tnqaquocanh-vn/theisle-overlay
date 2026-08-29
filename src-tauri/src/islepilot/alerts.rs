//! Threshold notifications for "your dino".
//!
//! Fed from the same `publish()` chokepoint as the history log. Fires a
//! desktop toast when thirst / hunger / HP drop below a configured percentage,
//! when Prime becomes eligible, or when growth crosses a milestone.
//!
//! Edge-triggered with hysteresis + a per-rule cooldown: a bar that stays
//! under its threshold does NOT re-notify until it has recovered past
//! `threshold + REARM_MARGIN`. Nothing fires on cached / offline data
//! (`online != Some(true)`), and the whole feature is opt-in (default off) —
//! notifications are intrusive.
//!
//! Notification strings are localised in Rust (the `hotkeys::mark_here`
//! precedent); the Settings UI strings live in the i18n JSON as usual.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

use crate::settings;
use crate::state::{AppState, LockExt};

use super::parser::StatBar;
use super::DinoUpdate;

/// Recovery needed above the threshold before a bar rule re-arms.
const REARM_MARGIN: f64 = 10.0;
const BAR_COOLDOWN: Duration = Duration::from_secs(300);
const PRIME_COOLDOWN: Duration = Duration::from_secs(600);
const GROWTH_COOLDOWN: Duration = Duration::from_secs(120);
const MILESTONES: [f64; 4] = [25.0, 50.0, 75.0, 100.0];

// ------------------------------------------------------------------ config ---

struct Config {
    vi: bool,
    enabled: bool,
    /// 0 = rule off.
    thirst_pct: f64,
    hunger_pct: f64,
    hp_pct: f64,
    prime_ready: bool,
    growth_milestones: bool,
}

fn read_config(app: &AppHandle) -> Config {
    let state = app.state::<AppState>();
    let s = state.settings.lock_safe();
    Config {
        vi: settings::get_str(&s, &["language"], "vi") != "en",
        enabled: settings::get_bool(&s, &["islepilot", "alerts", "enabled"], false),
        thirst_pct: settings::get_f64(&s, &["islepilot", "alerts", "thirst_pct"], 15.0),
        hunger_pct: settings::get_f64(&s, &["islepilot", "alerts", "hunger_pct"], 15.0),
        hp_pct: settings::get_f64(&s, &["islepilot", "alerts", "hp_pct"], 25.0),
        prime_ready: settings::get_bool(&s, &["islepilot", "alerts", "prime_ready"], true),
        growth_milestones: settings::get_bool(
            &s,
            &["islepilot", "alerts", "growth_milestones"],
            true,
        ),
    }
}

fn ui_vi(app: &AppHandle) -> bool {
    let state = app.state::<AppState>();
    let s = state.settings.lock_safe();
    settings::get_str(&s, &["language"], "vi") != "en"
}

// ------------------------------------------------------------------- state ---

struct AlertState {
    thirst_armed: bool,
    hunger_armed: bool,
    hp_armed: bool,
    prime_prev: Option<bool>,
    last_growth: Option<f64>,
    thirst_fired: Option<Instant>,
    hunger_fired: Option<Instant>,
    hp_fired: Option<Instant>,
    prime_fired: Option<Instant>,
    growth_fired: Option<Instant>,
}

impl AlertState {
    const fn new() -> Self {
        Self {
            thirst_armed: true,
            hunger_armed: true,
            hp_armed: true,
            prime_prev: None,
            last_growth: None,
            thirst_fired: None,
            hunger_fired: None,
            hp_fired: None,
            prime_fired: None,
            growth_fired: None,
        }
    }
}

static STATE: Mutex<AlertState> = Mutex::new(AlertState::new());

// -------------------------------------------------------------- pure logic ---

fn bar_pct(bar: &Option<StatBar>) -> Option<f64> {
    let b = bar.as_ref()?;
    match (b.current, b.max) {
        (Some(c), Some(m)) if m > 0.0 => Some((c / m * 100.0).clamp(0.0, 100.0)),
        _ => None,
    }
}

/// `(should_fire, new_armed)` for one bar sample — cooldown is the caller's job.
fn bar_decision(p: Option<f64>, threshold: f64, armed: bool) -> (bool, bool) {
    if threshold <= 0.0 {
        return (false, true);
    }
    let Some(p) = p else { return (false, armed) };
    if p >= (threshold + REARM_MARGIN).min(100.0) {
        return (false, true); // recovered -> re-arm
    }
    if p < threshold && armed {
        return (true, false); // fire and disarm
    }
    (false, armed)
}

/// The highest milestone strictly above `prev` and reached by `cur`, if any.
fn crossed_milestone(prev: f64, cur: f64) -> Option<f64> {
    MILESTONES.into_iter().rev().find(|&m| prev < m && cur >= m)
}

// -------------------------------------------------------------- firing side ---

fn notify(app: &AppHandle, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::warn!("notification failed: {e}");
    }
}

/// Fire unless the per-rule cooldown is still running. Returns whether it fired.
fn maybe_fire(
    app: &AppHandle,
    fired: &mut Option<Instant>,
    cooldown: Duration,
    title: &str,
    body: &str,
) -> bool {
    if fired.is_some_and(|t| t.elapsed() < cooldown) {
        return false;
    }
    *fired = Some(Instant::now());
    notify(app, title, body);
    true
}

#[derive(Clone, Copy)]
enum Bar {
    Thirst,
    Hunger,
    Hp,
}

impl Bar {
    fn title(self, vi: bool) -> &'static str {
        match (self, vi) {
            (Bar::Thirst, true) => "Khát thấp",
            (Bar::Thirst, false) => "Thirst low",
            (Bar::Hunger, true) => "Đói",
            (Bar::Hunger, false) => "Hunger low",
            (Bar::Hp, true) => "Máu thấp",
            (Bar::Hp, false) => "Health low",
        }
    }

    fn body(self, vi: bool, pct: f64) -> String {
        let p = pct.round() as i64;
        match (self, vi) {
            (Bar::Thirst, true) => format!("💧 Khát còn {p}% — tìm nước"),
            (Bar::Thirst, false) => format!("💧 Thirst at {p}% — find water"),
            (Bar::Hunger, true) => format!("🍖 Đói còn {p}% — tìm thức ăn"),
            (Bar::Hunger, false) => format!("🍖 Hunger at {p}% — find food"),
            (Bar::Hp, true) => format!("❤️ Máu còn {p}% — cẩn thận"),
            (Bar::Hp, false) => format!("❤️ Health at {p}% — be careful"),
        }
    }
}

fn check_bar(
    app: &AppHandle,
    vi: bool,
    kind: Bar,
    bar: &Option<StatBar>,
    threshold: f64,
    armed: &mut bool,
    fired: &mut Option<Instant>,
) {
    let p = bar_pct(bar);
    let (fire, new_armed) = bar_decision(p, threshold, *armed);
    if fire {
        let body = kind.body(vi, p.unwrap_or(0.0));
        if maybe_fire(app, fired, BAR_COOLDOWN, kind.title(vi), &body) {
            *armed = false;
        }
        // Cooldown blocked it -> stay armed so it fires on the next tick.
    } else {
        *armed = new_armed;
    }
}

fn prime_text(vi: bool) -> (&'static str, &'static str) {
    if vi {
        ("Prime sẵn sàng", "⭐ Khủng long của bạn đã đủ điều kiện Prime")
    } else {
        ("Prime ready", "⭐ Your dino is now eligible for Prime")
    }
}

fn growth_text(vi: bool, milestone: f64) -> (&'static str, String) {
    let m = milestone.round() as i64;
    if vi {
        ("Cột mốc growth", format!("📈 Growth đạt {m}%"))
    } else {
        ("Growth milestone", format!("📈 Growth reached {m}%"))
    }
}

// ----------------------------------------------------------------- entrypt ---

/// Evaluate every rule against one poll update. Called from `publish()`.
pub fn evaluate(app: &AppHandle, update: &DinoUpdate) {
    let cfg = read_config(app);
    if !cfg.enabled {
        // Reset so re-enabling starts from a clean baseline — no stale edge.
        *STATE.lock_safe() = AlertState::new();
        return;
    }
    if update.error.is_some() {
        return;
    }
    let Some(p) = update.player.as_ref() else {
        return;
    };
    // Never alert on cached / offline data.
    if p.online != Some(true) {
        return;
    }

    let mut guard = STATE.lock_safe();
    let st = &mut *guard;

    check_bar(app, cfg.vi, Bar::Thirst, &p.thirst, cfg.thirst_pct, &mut st.thirst_armed, &mut st.thirst_fired);
    check_bar(app, cfg.vi, Bar::Hunger, &p.hunger, cfg.hunger_pct, &mut st.hunger_armed, &mut st.hunger_fired);
    check_bar(app, cfg.vi, Bar::Hp, &p.health, cfg.hp_pct, &mut st.hp_armed, &mut st.hp_fired);

    if cfg.prime_ready {
        let now_eligible = p.prime_eligible;
        if st.prime_prev == Some(false) && now_eligible == Some(true) {
            let (title, body) = prime_text(cfg.vi);
            maybe_fire(app, &mut st.prime_fired, PRIME_COOLDOWN, title, body);
        }
        st.prime_prev = now_eligible;
    }

    if cfg.growth_milestones {
        if let (Some(prev), Some(cur)) = (st.last_growth, p.growth_pct) {
            if let Some(m) = crossed_milestone(prev, cur) {
                let (title, body) = growth_text(cfg.vi, m);
                maybe_fire(app, &mut st.growth_fired, GROWTH_COOLDOWN, title, &body);
            }
        }
        if let Some(g) = p.growth_pct {
            st.last_growth = Some(g);
        }
    }
}

/// The "Send test" button in Settings.
pub fn test_notification(app: &AppHandle) {
    let (title, body) = if ui_vi(app) {
        ("TheIsle Overlay", "🔔 Thông báo thử — cảnh báo đang hoạt động")
    } else {
        ("TheIsle Overlay", "🔔 Test notification — alerts are working")
    };
    notify(app, title, body);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bar_decision_fires_below_threshold_when_armed() {
        assert_eq!(bar_decision(Some(14.0), 15.0, true), (true, false));
    }

    #[test]
    fn bar_decision_quiet_once_disarmed() {
        assert_eq!(bar_decision(Some(8.0), 15.0, false), (false, false));
    }

    #[test]
    fn bar_decision_rearms_only_past_the_margin() {
        // threshold 15 + margin 10 -> need >= 25 to re-arm.
        assert_eq!(bar_decision(Some(20.0), 15.0, false), (false, false));
        assert_eq!(bar_decision(Some(25.0), 15.0, false), (false, true));
    }

    #[test]
    fn bar_decision_zero_threshold_is_off() {
        assert_eq!(bar_decision(Some(1.0), 0.0, true), (false, true));
    }

    #[test]
    fn bar_decision_no_reading_keeps_state() {
        assert_eq!(bar_decision(None, 15.0, true), (false, true));
        assert_eq!(bar_decision(None, 15.0, false), (false, false));
    }

    #[test]
    fn crossed_milestone_takes_the_highest_reached() {
        assert_eq!(crossed_milestone(10.0, 30.0), Some(25.0));
        assert_eq!(crossed_milestone(20.0, 80.0), Some(75.0));
        assert_eq!(crossed_milestone(99.5, 100.0), Some(100.0));
    }

    #[test]
    fn crossed_milestone_none_when_not_crossing() {
        assert_eq!(crossed_milestone(26.0, 40.0), None);
        assert_eq!(crossed_milestone(50.0, 40.0), None); // moving backward
        assert_eq!(crossed_milestone(25.0, 25.0), None); // already there
    }

    #[test]
    fn bar_pct_reads_the_ratio() {
        let b = Some(StatBar::from_values(30.0, 60.0));
        assert_eq!(bar_pct(&b), Some(50.0));
        assert_eq!(bar_pct(&None), None);
    }

    #[test]
    fn bar_body_is_localised_and_rounded() {
        assert_eq!(Bar::Thirst.body(true, 14.6), "💧 Khát còn 15% — tìm nước");
        assert_eq!(Bar::Hunger.body(false, 9.2), "🍖 Hunger at 9% — find food");
    }
}
