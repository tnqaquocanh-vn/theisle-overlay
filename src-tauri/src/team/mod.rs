//! G6 — ad-hoc team via a self-hosted relay (a Cloudflare Durable Object in
//! `worker/`, one room per 6-char invite code). Unlike the F7 server-map
//! party this works on EVERY server and telemetry source, because the
//! position it shares is whatever the pipeline currently has (G1 capture,
//! IslePilot, or a manual copy).
//!
//! ANTI-CHEAT: nothing new — this only sends the position the overlay already
//! shows, to a relay the user configures, over WSS. No game process contact.
//!
//! Wire (JSON text frames): see `worker/src/team.ts`. Relay `x` = game
//! latitude cm, `y` = game longitude cm (our internal convention).

use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use overlay_core::world_to_pixel;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tungstenite::client::IntoClientRequest;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Message, WebSocket};

use crate::pipeline;
use crate::settings;
use crate::state::{AppState, LockExt};

pub const TEAM_STATUS: &str = "team://status";
/// A teammate dropped a contact ping (P3). Payload: `{ from, xCm, yCm, px, py }`.
pub const TEAM_MARK: &str = "team://mark";
/// A teammate shared a waypoint (P4). Payload: `{ from, name }` (the pin is
/// already added locally by the time this fires).
pub const TEAM_WAYPOINT: &str = "team://waypoint";

/// Hosted relay used when the user has not set their own — so end users just
/// click "Create team", like IsleLiveMap's public relay. This is our own
/// deploy of `worker/wrangler.team.jsonc` (`npm run deploy:team`). Override
/// per-install with `settings.team.relay_base`.
pub const DEFAULT_RELAY_BASE: &str = "https://isle-team-relay.quocanh.workers.dev";

const BACKOFF_S: [f64; 5] = [1.0, 2.0, 4.0, 8.0, 15.0];
/// How often the pump *checks* whether a tele frame is worth sending.
const PUBLISH_EVERY: Duration = Duration::from_millis(250);
/// ...but it only actually sends when the player moved / turned this much, or
/// the keepalive is due, or HP jumped. A still player on the hosted relay
/// otherwise burns ~4 requests/s each — enough to exhaust a free Cloudflare
/// account in under an hour with a 4-person team. Watchers see a party dot,
/// not a self-marker, so a couple of metres of lag is invisible.
const PUBLISH_MIN_MOVE_CM: f64 = 200.0;
const PUBLISH_MIN_TURN_DEG: f64 = 3.0;
const PUBLISH_KEEPALIVE: Duration = Duration::from_secs(2);
const PING_EVERY: Duration = Duration::from_secs(9);
const READ_TIMEOUT: Duration = Duration::from_millis(500);
const CODE_ALPHABET: &str = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

static GENERATION: AtomicU64 = AtomicU64::new(0);
/// Frames queued by `ping_here` for the live socket to send. `None` between
/// connections.
static OUTBOX: Mutex<Option<Sender<String>>> = Mutex::new(None);
static ACTIVE: AtomicBool = AtomicBool::new(false);
static STATUS: Mutex<TeamStatus> = Mutex::new(TeamStatus::empty());
static OWN_ID: Mutex<String> = Mutex::new(String::new());

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TeamStatus {
    pub active: bool,
    pub connected: bool,
    pub code: String,
    pub name: String,
    pub members: u32,
    pub error: Option<String>,
    /// Everyone in the room (including self), with vitals. Empty until the
    /// first roster frame.
    pub roster: Vec<TeamMemberInfo>,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TeamMemberInfo {
    pub name: String,
    pub online: bool,
    pub is_self: bool,
    pub hp: Option<f64>,
    pub hunger: Option<f64>,
    pub thirst: Option<f64>,
    pub species: Option<String>,
    pub server: Option<String>,
}

impl TeamStatus {
    const fn empty() -> Self {
        Self {
            active: false,
            connected: false,
            code: String::new(),
            name: String::new(),
            members: 0,
            error: None,
            roster: Vec::new(),
        }
    }
}

/// True while a team session is up — F7's server-map party yields to it.
pub fn is_active() -> bool {
    ACTIVE.load(Ordering::SeqCst)
}

/// How many teammate rows the in-game minimap panel should reserve (everyone
/// in the roster except yourself). The minimap window is sized from this.
pub fn overlay_rows() -> usize {
    STATUS.lock_safe().roster.iter().filter(|m| !m.is_self).count()
}

pub fn status() -> TeamStatus {
    STATUS.lock_safe().clone()
}

fn set_status(app: &AppHandle, mutate: impl FnOnce(&mut TeamStatus)) {
    let snapshot = {
        let mut s = STATUS.lock_safe();
        mutate(&mut s);
        ACTIVE.store(s.active, Ordering::SeqCst);
        s.clone()
    };
    let _ = app.emit(TEAM_STATUS, snapshot);
}

fn relay_base(app: &AppHandle) -> String {
    let state = app.state::<AppState>();
    let s = state.settings.lock_safe();
    let set = settings::get_str(&s, &["team", "relay_base"], "").trim().to_string();
    let base = if set.is_empty() { DEFAULT_RELAY_BASE } else { &set };
    base.trim_end_matches('/').to_string()
}

fn valid_code(code: &str) -> bool {
    code.len() == 6 && code.chars().all(|c| CODE_ALPHABET.contains(c))
}

/// Create a new room: ask the relay for a fresh code, then join it.
pub fn create(app: &AppHandle, name: &str) -> Result<TeamStatus, String> {
    let base = relay_base(app);
    let client = crate::islepilot::http_client()?;
    let body = client
        .post(format!("{base}/v1/team/new"))
        .send()
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.text())
        .map_err(|e| e.to_string())?;
    let code = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|v| v.get("code").and_then(|c| c.as_str()).map(String::from))
        .filter(|c| valid_code(c))
        .ok_or("relay returned no code")?;
    start(app, code, name.trim());
    Ok(status())
}

/// Join an existing room by its invite code.
pub fn join(app: &AppHandle, code: &str, name: &str) -> Result<TeamStatus, String> {
    let code = code.trim().to_uppercase();
    if !valid_code(&code) {
        return Err("bad_code".into());
    }
    start(app, code, name.trim());
    Ok(status())
}

pub fn leave(app: &AppHandle) {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    *OWN_ID.lock_safe() = String::new();
    *OUTBOX.lock_safe() = None;
    set_status(app, |s| *s = TeamStatus::empty());
    crate::islepilot::emit_party_markers(app, Vec::new());
}

/// App is exiting — supersede the socket thread so it drops its WebSocket
/// (no event emits; the windows are already gone). See `crate::shutdown`.
pub fn shutdown() {
    GENERATION.fetch_add(1, Ordering::SeqCst);
    ACTIVE.store(false, Ordering::SeqCst);
    *OUTBOX.lock_safe() = None;
}

/// P3 — drop a contact ping at the player's current position for the whole
/// team. No-op when not in a team or before the first position sample.
pub fn ping_here(app: &AppHandle) {
    if !is_active() {
        return;
    }
    let Some((lat, long, _z, _h)) = pipeline::current_world(&app.state::<AppState>()) else {
        return;
    };
    if let Some(tx) = OUTBOX.lock_safe().as_ref() {
        let _ = tx.send(json!({ "op": "mark", "x": lat, "y": long }).to_string());
    }
    // The relay does not echo to the sender — surface our own ping locally.
    emit_mark(app, &status().name, lat, long);
}

/// P4 — share one waypoint (world cm) with the whole team.
pub fn share_waypoint(app: &AppHandle, name: &str, x_cm: f64, y_cm: f64) {
    if !is_active() {
        return;
    }
    let name = name.chars().take(40).collect::<String>();
    if let Some(tx) = OUTBOX.lock_safe().as_ref() {
        let _ = tx.send(
            json!({ "op": "wp", "name": name, "x": x_cm, "y": y_cm }).to_string(),
        );
    }
    let _ = app.emit(TEAM_WAYPOINT, json!({ "from": status().name, "name": name, "own": true }));
}

fn emit_mark(app: &AppHandle, from: &str, lat_cm: f64, long_cm: f64) {
    let cal = app.state::<AppState>().active_calibration();
    let (px, py) = world_to_pixel(lat_cm, long_cm, cal);
    let _ = app.emit(
        TEAM_MARK,
        json!({ "from": from, "xCm": lat_cm, "yCm": long_cm, "px": px, "py": py }),
    );
}

fn start(app: &AppHandle, code: String, name: &str) {
    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    *OWN_ID.lock_safe() = String::new();
    let name = if name.is_empty() { "Player".to_string() } else { name.to_string() };
    set_status(app, |s| {
        *s = TeamStatus {
            active: true,
            connected: false,
            code: code.clone(),
            name: name.clone(),
            members: 0,
            error: None,
            roster: Vec::new(),
        };
    });
    let base = relay_base(app);
    let app = app.clone();
    std::thread::Builder::new()
        .name("team".into())
        .spawn(move || run(app, generation, base, code, name))
        .expect("spawn team thread");
}

fn superseded(generation: u64) -> bool {
    GENERATION.load(Ordering::SeqCst) != generation
}

fn run(app: AppHandle, generation: u64, base: String, code: String, name: String) {
    let ws_url = format!(
        "{}/v1/team/ws?code={code}",
        base.replacen("https://", "wss://", 1)
            .replacen("http://", "ws://", 1)
    );
    let mut backoff_idx = 0usize;

    while !superseded(generation) {
        match connect_pump(&app, generation, &ws_url, &name) {
            Ok(()) => return, // clean supersede
            Err(e) => {
                log::debug!("team: {e}; reconnecting");
                set_status(&app, |s| {
                    s.connected = false;
                    s.error = Some(e);
                });
                backoff_idx = (backoff_idx + 1).min(BACKOFF_S.len() - 1);
            }
        }
        let mut left = BACKOFF_S[backoff_idx];
        while left > 0.0 && !superseded(generation) {
            std::thread::sleep(Duration::from_millis(250));
            left -= 0.25;
        }
    }
    // Superseded while looping — clear any pins we own.
    crate::islepilot::emit_party_markers(&app, Vec::new());
}

fn connect_pump(
    app: &AppHandle,
    generation: u64,
    ws_url: &str,
    name: &str,
) -> Result<(), String> {
    let request = ws_url
        .into_client_request()
        .map_err(|e| e.to_string())?;
    let (mut socket, _resp) =
        tungstenite::connect(request).map_err(|e| e.to_string())?;
    set_read_timeout(&mut socket, READ_TIMEOUT);

    socket
        .send(Message::Text(json!({ "op": "hello", "name": name }).to_string()))
        .map_err(|e| e.to_string())?;
    set_status(app, |s| {
        s.connected = true;
        s.error = None;
    });

    // Outbound queue for pings / shared waypoints raised from other threads.
    let (tx, rx) = mpsc::channel::<String>();
    *OUTBOX.lock_safe() = Some(tx);

    let mut seq: u64 = 0;
    let mut last_publish = Instant::now()
        .checked_sub(PUBLISH_EVERY)
        .unwrap_or_else(Instant::now);
    let mut last_ping = Instant::now();
    // Gate for the tele send (see PUBLISH_* consts): last sent lat/long/heading
    // (NaN = unknown) and when, plus last sent HP so a hit still shows fast.
    let mut sent_at = Instant::now()
        .checked_sub(PUBLISH_KEEPALIVE)
        .unwrap_or_else(Instant::now);
    let mut sent_pos: Option<(f64, f64, f64)> = None;
    let mut sent_hp: Option<f64> = None;

    loop {
        if superseded(generation) {
            return Ok(());
        }

        while let Ok(frame) = rx.try_recv() {
            socket
                .send(Message::Text(frame))
                .map_err(|e| e.to_string())?;
        }

        if last_ping.elapsed() >= PING_EVERY {
            socket
                .send(Message::Text(r#"{"op":"ping"}"#.to_string()))
                .map_err(|e| e.to_string())?;
            last_ping = Instant::now();
        }

        if last_publish.elapsed() >= PUBLISH_EVERY {
            last_publish = Instant::now();
            if let Some((lat, long, z, heading)) =
                pipeline::current_world(&app.state::<AppState>())
            {
                let h = heading.unwrap_or(f64::NAN);
                let moved = match sent_pos {
                    Some((plat, plong, ph)) => {
                        let dist = ((lat - plat).powi(2) + (long - plong).powi(2)).sqrt();
                        let turned = if ph.is_nan() || h.is_nan() {
                            ph.is_nan() != h.is_nan()
                        } else {
                            let d = (h - ph).rem_euclid(360.0);
                            d.min(360.0 - d) >= PUBLISH_MIN_TURN_DEG
                        };
                        dist >= PUBLISH_MIN_MOVE_CM || turned
                    }
                    None => true,
                };
                let v = crate::islepilot::last_vitals();
                let hp_jumped = match (sent_hp, v.hp_pct) {
                    (Some(a), Some(b)) => (a - b).abs() >= 5.0,
                    (None, Some(_)) => true,
                    _ => false,
                };
                if moved || hp_jumped || sent_at.elapsed() >= PUBLISH_KEEPALIVE {
                    seq += 1;
                    let frame = json!({
                        "op": "tele", "seq": seq,
                        "x": lat, "y": long, "z": z, "heading": heading,
                        "hp": v.hp_pct, "hunger": v.hunger_pct, "thirst": v.thirst_pct,
                        "species": v.species, "server": v.server,
                    });
                    socket
                        .send(Message::Text(frame.to_string()))
                        .map_err(|e| e.to_string())?;
                    sent_pos = Some((lat, long, h));
                    sent_hp = v.hp_pct;
                    sent_at = Instant::now();
                }
            }
        }

        match socket.read() {
            Ok(Message::Text(text)) => handle_frame(app, &text),
            Ok(Message::Close(_)) => return Err("closed by relay".into()),
            Ok(_) => {}
            Err(tungstenite::Error::Io(e))
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(e) => return Err(e.to_string()),
        }
    }
}

fn handle_frame(app: &AppHandle, text: &str) {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        return;
    };
    match v.get("op").and_then(|o| o.as_str()) {
        Some("welcome") => {
            if let Some(id) = v.get("memberId").and_then(|m| m.as_str()) {
                *OWN_ID.lock_safe() = id.to_string();
            }
        }
        Some("mark") => {
            let from = v.get("from").and_then(|s| s.as_str()).unwrap_or("?");
            if let (Some(lat), Some(long)) = (
                v.get("x").and_then(Value::as_f64),
                v.get("y").and_then(Value::as_f64),
            ) {
                emit_mark(app, from, lat, long);
            }
        }
        Some("wp") => {
            let from = v.get("from").and_then(|s| s.as_str()).unwrap_or("?").to_string();
            let name = v
                .get("name")
                .and_then(|s| s.as_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("?")
                .to_string();
            if let (Some(lat), Some(long)) = (
                v.get("x").and_then(Value::as_f64),
                v.get("y").and_then(Value::as_f64),
            ) {
                crate::commands::add_shared_waypoint(app, &name, lat, long);
                let _ = app.emit(TEAM_WAYPOINT, json!({ "from": from, "name": name, "own": false }));
            }
        }
        Some("roster") => {
            let own = OWN_ID.lock_safe().clone();
            let empty = Vec::new();
            let members = v.get("members").and_then(|m| m.as_array()).unwrap_or(&empty);

            let mut roster = Vec::with_capacity(members.len());
            let mut markers = Vec::new();
            for m in members {
                let is_self = m.get("memberId").and_then(|i| i.as_str()) == Some(own.as_str());
                let name = m
                    .get("name")
                    .and_then(|n| n.as_str())
                    .filter(|s| !s.is_empty())
                    .unwrap_or("?")
                    .to_string();
                let online = m.get("online").and_then(Value::as_bool).unwrap_or(true);
                let tele = m.get("tele").filter(|t| !t.is_null());
                let f = |k: &str| tele.and_then(|t| t.get(k)).and_then(Value::as_f64);
                let s = |k: &str| {
                    tele.and_then(|t| t.get(k))
                        .and_then(Value::as_str)
                        .map(String::from)
                };

                roster.push(crate::team::TeamMemberInfo {
                    name: name.clone(),
                    online,
                    is_self,
                    hp: f("hp"),
                    hunger: f("hunger"),
                    thirst: f("thirst"),
                    species: s("species"),
                    server: s("server"),
                });

                // Map pins: everyone except self who has a position.
                if !is_self {
                    if let (Some(lat), Some(long)) = (f("x"), f("y")) {
                        markers.push(crate::islepilot::PartyMember {
                            label: name,
                            lat_cm: lat,
                            long_cm: long,
                            hp: f("hp"),
                            hunger: f("hunger"),
                            thirst: f("thirst"),
                            heading: f("heading"),
                        });
                    }
                }
            }

            let count = members.len() as u32;
            set_status(app, move |st| {
                st.members = count;
                st.roster = roster;
            });
            crate::islepilot::emit_party_markers(app, markers);
        }
        _ => {}
    }
}

fn set_read_timeout(socket: &mut WebSocket<MaybeTlsStream<TcpStream>>, timeout: Duration) {
    match socket.get_ref() {
        MaybeTlsStream::Plain(s) => {
            let _ = s.set_read_timeout(Some(timeout));
        }
        MaybeTlsStream::NativeTls(s) => {
            let _ = s.get_ref().set_read_timeout(Some(timeout));
        }
        _ => {}
    }
}
