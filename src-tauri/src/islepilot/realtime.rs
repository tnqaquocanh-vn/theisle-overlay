//! G5 — IslePilot realtime over WebSocket (`wss://islepilot.eu/ows`).
//!
//! Token mode only. Runs ALONGSIDE the REST poll (`run_token_poll`), which
//! stays as the reliable backstop for everything the live frames don't carry
//! (persona, species, server, prime quests, map POIs) and covers the socket
//! being down. This adds sub-second position + vitals in between.
//!
//! Port of IsleLiveMap's `IslePilotOverlayWebSocket` + `IslePilotReconnectBackoff`
//! (MIT). Blocking `tungstenite` client — fits the existing `std::thread` +
//! `reqwest::blocking` model, no async runtime.

use std::net::TcpStream;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tungstenite::client::IntoClientRequest;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{Message, WebSocket};

use crate::pipeline;
use crate::state::{AppState, LockExt};

use super::api;
use super::parser::{Nutrition, PlayerStats, QuestStatus, StatBar};
use super::token::OverlayToken;
use super::{now_ms, publish, read_config, DinoUpdate, GENERATION, LAST_UPDATE};

const WS_URL: &str = "wss://islepilot.eu/ows";

/// `liveskin` frames the skin editor wants sent on the next socket pass. Kept
/// tiny — a burst while disconnected drops the oldest (the editor debounces,
/// and only the newest colour state matters).
static OUTBOX: Mutex<Vec<String>> = Mutex::new(Vec::new());
const OUTBOX_MAX: usize = 8;

/// Queue `{t:"liveskin", d:<state>}` for the realtime socket. No-op-safe when
/// the socket is down: it flushes on connect, or is cleared on reconnect.
pub fn queue_liveskin(state: Value) {
    if let Ok(mut q) = OUTBOX.lock() {
        if q.len() >= OUTBOX_MAX {
            q.remove(0);
        }
        q.push(serde_json::json!({ "t": "liveskin", "d": state }).to_string());
    }
}

fn drain_outbox(socket: &mut WebSocket<MaybeTlsStream<TcpStream>>) -> Result<(), Exit> {
    let frames: Vec<String> = OUTBOX.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default();
    for frame in frames {
        socket
            .send(Message::Text(frame))
            .map_err(|e| Exit::Transient(e.to_string()))?;
    }
    Ok(())
}
/// Reconnect delays (seconds), same ladder as IsleLiveMap; last value repeats.
const BACKOFF_S: [f64; 5] = [1.0, 2.0, 4.0, 8.0, 15.0];
const READ_TIMEOUT: Duration = Duration::from_secs(1);
const CLIENT_PING_EVERY: Duration = Duration::from_secs(25);

#[derive(Deserialize, Default)]
#[serde(default)]
struct LiveFrame {
    t: Option<String>,
    d: Option<LiveData>,
}

#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
struct LiveData {
    growth: Option<f64>,
    health: Option<f64>,
    max_health: Option<f64>,
    hunger: Option<f64>,
    max_hunger: Option<f64>,
    thirst: Option<f64>,
    max_thirst: Option<f64>,
    stamina: Option<f64>,
    max_stamina: Option<f64>,
    nutrition: Option<api::OverlayNutrition>,
    position: Option<api::OverlayPosition>,
    /// `{skin_body_r: 0.4, …}` — echoed when the account's live skin changes
    /// (skin editor 2-way sync). Passed straight through to the frontend.
    skin: Option<Value>,
}

enum Exit {
    /// Generation bumped or the feature was turned off — stop for good.
    Superseded,
    /// The token was rejected on the socket — stop retrying, let the REST
    /// loop own the "auth expired" prompt.
    Auth,
    /// Anything else — reconnect after a backoff.
    Transient(String),
}

/// Spawn the realtime socket thread for `generation`. Exits on generation
/// change, auth failure, or the `islepilot.realtime` toggle going off.
pub fn spawn(app: AppHandle, generation: u64, tok: OverlayToken) {
    std::thread::spawn(move || {
        let mut backoff_idx = 0usize;
        loop {
            if GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }
            let cfg = read_config(&app);
            if !cfg.enabled || cfg.auth_mode != "token" || !cfg.realtime {
                return;
            }

            match connect_and_pump(&app, generation, &tok) {
                Err(Exit::Superseded) | Err(Exit::Auth) => return,
                Err(Exit::Transient(e)) => {
                    log::debug!("islepilot realtime: {e}; reconnecting");
                    backoff_idx = (backoff_idx + 1).min(BACKOFF_S.len() - 1);
                }
                Ok(()) => backoff_idx = 0,
            }

            // Jittered backoff (0.8x–1.2x), re-checking generation as we wait.
            let base = BACKOFF_S[backoff_idx];
            let jitter = 0.8 + (now_ms() % 400) as f64 / 1000.0;
            let mut left = base * jitter;
            while left > 0.0 {
                if GENERATION.load(Ordering::SeqCst) != generation {
                    return;
                }
                std::thread::sleep(Duration::from_millis(250));
                left -= 0.25;
            }
        }
    });
}

fn connect_and_pump(app: &AppHandle, generation: u64, tok: &OverlayToken) -> Result<(), Exit> {
    let mut request = WS_URL
        .into_client_request()
        .map_err(|e| Exit::Transient(e.to_string()))?;
    let bearer = format!("Bearer {}", tok.token)
        .parse()
        .map_err(|_| Exit::Auth)?;
    request.headers_mut().insert("Authorization", bearer);

    let (mut socket, _resp) = match tungstenite::connect(request) {
        Ok(v) => v,
        Err(tungstenite::Error::Http(r)) if matches!(r.status().as_u16(), 401 | 403) => {
            return Err(Exit::Auth);
        }
        Err(e) => return Err(Exit::Transient(e.to_string())),
    };
    set_read_timeout(&mut socket, READ_TIMEOUT);

    // A fresh connection: drop any `liveskin` frames queued against the old one.
    if let Ok(mut q) = OUTBOX.lock() {
        q.clear();
    }

    // Hello frame ({"t":"hello"}); persona name is optional and the REST /me
    // path already carries it, so send null.
    socket
        .send(Message::Text(r#"{"t":"hello","name":null}"#.to_string()))
        .map_err(|e| Exit::Transient(e.to_string()))?;

    let mut last_ping = Instant::now();
    loop {
        if GENERATION.load(Ordering::SeqCst) != generation {
            return Err(Exit::Superseded);
        }
        let cfg = read_config(app);
        if !cfg.enabled || cfg.auth_mode != "token" || !cfg.realtime {
            return Err(Exit::Superseded);
        }

        if last_ping.elapsed() >= CLIENT_PING_EVERY {
            let _ = socket.send(Message::Ping(Vec::new()));
            last_ping = Instant::now();
        }

        drain_outbox(&mut socket)?;

        match socket.read() {
            Ok(Message::Text(text)) => handle_frame(app, &text, cfg.use_map_position),
            Ok(Message::Close(_)) => return Err(Exit::Transient("closed by server".into())),
            Ok(_) => {} // Binary / Ping / Pong / raw Frame — nothing to do
            Err(tungstenite::Error::Io(e))
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) => {}
            Err(e) => return Err(Exit::Transient(e.to_string())),
        }
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

fn handle_frame(app: &AppHandle, text: &str, use_map_position: bool) {
    let Ok(frame) = serde_json::from_str::<LiveFrame>(text) else {
        return;
    };
    if frame.t.as_deref() != Some("live") {
        return;
    }
    let Some(d) = frame.d else {
        return;
    };

    // Live skin echo — hand it straight to the skin editor (2-way sync).
    if let Some(skin) = &d.skin {
        let _ = app.emit("dino://skin", skin.clone());
    }

    // Position: their x = our y (Long), their y = our x (Lat) — same swap
    // `api::position_cm` uses. Skipped while G1 packet capture owns position.
    if use_map_position {
        let state = app.state::<AppState>();
        if let (Some(pos), false) = (d.position, pipeline::localpos_position_fresh(&state)) {
            if let (Some(x), Some(y)) = (pos.x, pos.y) {
                let heading = pos.yaw.map(localpos::map_heading_from_unreal_yaw);
                pipeline::ingest_sample_with_heading(app, y, x, pos.z.unwrap_or(0.0), heading, false);
                pipeline::mark_realtime_sample(&state);
            }
        }
    }

    // Vitals: merge the fresh numbers onto the last full update so the panel
    // keeps persona / species / quests between REST polls.
    let prev = LAST_UPDATE
        .lock_safe()
        .as_ref()
        .and_then(|u| u.player.clone());
    let live_map_available = LAST_UPDATE
        .lock_safe()
        .as_ref()
        .and_then(|u| u.live_map_available);
    publish(
        app,
        DinoUpdate {
            domain: api::API_ORIGIN.to_string(),
            fetched_at_ms: now_ms(),
            player: Some(live_to_player(&d, prev.as_ref())),
            map: None,
            layout_changed: false,
            live_map_available,
            error: None,
        },
    );
}

fn live_to_player(d: &LiveData, prev: Option<&PlayerStats>) -> PlayerStats {
    let growth_pct = d.growth.map(|g| if g <= 1.5 { g * 100.0 } else { g });
    let bar = |cur: Option<f64>, max: Option<f64>| -> Option<StatBar> {
        Some(StatBar::from_values(cur?, max?))
    };
    let carry_bar = |fresh: Option<StatBar>, prev_bar: Option<&StatBar>| fresh.or_else(|| prev_bar.cloned());

    PlayerStats {
        dino_name: prev.and_then(|p| p.dino_name.clone()),
        online: Some(true),
        growth: growth_pct
            .map(|p| format!("{}%", p.round() as i64))
            .or_else(|| prev.and_then(|p| p.growth.clone())),
        growth_pct: growth_pct.or_else(|| prev.and_then(|p| p.growth_pct)),
        health: carry_bar(bar(d.health, d.max_health), prev.and_then(|p| p.health.as_ref())),
        hunger: carry_bar(bar(d.hunger, d.max_hunger), prev.and_then(|p| p.hunger.as_ref())),
        thirst: carry_bar(bar(d.thirst, d.max_thirst), prev.and_then(|p| p.thirst.as_ref())),
        stamina: carry_bar(bar(d.stamina, d.max_stamina), prev.and_then(|p| p.stamina.as_ref())),
        prime_quests: prev
            .map(|p| p.prime_quests.clone())
            .unwrap_or_default() as Vec<QuestStatus>,
        nutrition: d
            .nutrition
            .map(|n| Nutrition {
                carb: n.carb,
                protein: n.protein,
                lipid: n.lipid,
            })
            .or_else(|| prev.and_then(|p| p.nutrition)),
        server: prev.and_then(|p| p.server.clone()),
        female: prev.and_then(|p| p.female),
        prime_eligible: prev.and_then(|p| p.prime_eligible),
    }
}
