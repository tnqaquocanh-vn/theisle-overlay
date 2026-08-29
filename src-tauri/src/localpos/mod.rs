//! G1 — automatic own-position from passive UDP capture (opt-in, default off).
//!
//! ANTI-CHEAT NOTE: this never touches the game process. It reads packets at
//! the NIC (Npcap) and asks the OS which UDP ports the game owns
//! (`GetExtendedUdpTable`) so the capture filter only ever sees The Isle's
//! own client→server movement traffic. No process handle, no memory read, no
//! injection, no synthetic input. It stays behind `settings.localpos.enabled`
//! and the UI shows a disclaimer before it can be turned on.
//!
//! Flow: supervisor thread → find game PID + ports → open every capture
//! device with a BPF filter → per-device threads push payloads → decode +
//! lock ([`localpos`] crate) → `pipeline::ingest_sample_with_heading`, which
//! is the exact same path the clipboard uses, so trail / fog-of-war /
//! minimap / waypoint arrow all work unchanged.

mod frame;
mod npcap;
mod udp_ports;
mod wpcap;

use std::collections::BTreeSet;
use std::ffi::CString;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

use localpos::{smooth_heading, LocalMovementTracker};

use crate::settings;
use crate::state::{AppState, LockExt};

pub use npcap::{status as npcap_status, NpcapStatus};

/// Game client image name (see `settings::GAME_PROCESS_NAME`).
const SNAPLEN: i32 = 2048;
const READ_TIMEOUT_MS: i32 = 250;
/// Bounded queue from the capture threads; oldest dropped on overflow so a
/// burst of re-sent saved moves cannot make the marker replay them.
const QUEUE_DEPTH: usize = 8;
/// Push at most one position update every ~this often (≈22 Hz). Packets
/// arrive faster and burstier than that; coalescing to the newest keeps the
/// marker current without flooding the UI.
const MIN_INGEST_INTERVAL: Duration = Duration::from_millis(45);
/// Circular-EMA weight for the control yaw. Raw per-packet yaw is jittery
/// (mouse micro-movement); at the ingest rate above this glides the arrow
/// without feeling laggy. Movement-derived heading (the fallback) is left
/// alone.
const HEADING_SMOOTHING: f64 = 0.4;

struct Supervisor {
    stop: Arc<AtomicBool>,
    handle: JoinHandle<()>,
}

static SUPERVISOR: Mutex<Option<Supervisor>> = Mutex::new(None);

/// Start or stop capture to match `settings.localpos.enabled`. Called once at
/// startup and again on every `settings://changed`.
pub fn apply_settings(app: &AppHandle) {
    let enabled = {
        let state = app.state::<AppState>();
        let guard = state.settings.lock_safe();
        settings::get_bool(&guard, &["localpos", "enabled"], false)
    };

    let mut slot = SUPERVISOR.lock_safe();
    match (enabled, slot.is_some()) {
        (true, false) => {
            let stop = Arc::new(AtomicBool::new(false));
            let app = app.clone();
            let thread_stop = Arc::clone(&stop);
            let handle = std::thread::Builder::new()
                .name("localpos".into())
                .spawn(move || supervise(app, thread_stop))
                .expect("spawn localpos supervisor");
            *slot = Some(Supervisor { stop, handle });
        }
        (false, true) => stop_supervisor(&mut slot, app),
        _ => {}
    }
}

fn stop_supervisor(slot: &mut Option<Supervisor>, app: &AppHandle) {
    if let Some(sup) = slot.take() {
        sup.stop.store(true, Ordering::SeqCst);
        let _ = sup.handle.join();
        *app.state::<AppState>().last_exact_heading.lock_safe() = None;
    }
}

/// App is exiting — stop the supervisor + capture threads so every `pcap_close`
/// runs before the process dies (see `crate::shutdown`).
pub fn shutdown() {
    let mut slot = SUPERVISOR.lock_safe();
    if let Some(sup) = slot.take() {
        sup.stop.store(true, Ordering::SeqCst);
        let _ = sup.handle.join();
    }
}

fn sleep_interruptible(stop: &AtomicBool, total: Duration) {
    let step = Duration::from_millis(100);
    let mut left = total;
    while left > Duration::ZERO && !stop.load(Ordering::SeqCst) {
        let this = step.min(left);
        std::thread::sleep(this);
        left = left.saturating_sub(this);
    }
}

fn supervise(app: AppHandle, stop: Arc<AtomicBool>) {
    let started = Instant::now();
    let mut tracker = LocalMovementTracker::new();
    let mut workers: Vec<CaptureWorker> = Vec::new();
    let mut current_ports: Option<BTreeSet<u16>> = None;
    let mut smoothed_heading: Option<f64> = None;
    let (tx, rx) = sync_channel::<Vec<u8>>(QUEUE_DEPTH);

    while !stop.load(Ordering::SeqCst) {
        let ports = game_udp_ports();

        if ports.is_empty() {
            if !workers.is_empty() {
                stop_all(&mut workers);
                current_ports = None;
                tracker.reset();
                smoothed_heading = None;
                drain(&rx);
            }
            sleep_interruptible(&stop, Duration::from_secs(1));
            continue;
        }

        if current_ports.as_ref() != Some(&ports) {
            stop_all(&mut workers);
            tracker.reset();
            smoothed_heading = None;
            drain(&rx);
            match spawn_workers(&ports, &tx) {
                Ok(spawned) => {
                    workers = spawned;
                    current_ports = Some(ports.clone());
                    log::info!("localpos: capturing on {} device(s), ports {:?}", workers.len(), ports);
                }
                Err(e) => {
                    log::warn!("localpos: capture unavailable ({e}); retrying");
                    current_ports = None;
                    sleep_interruptible(&stop, Duration::from_secs(3));
                    continue;
                }
            }
        }

        // Pump for ~1 s, then loop back to re-check the game / ports.
        // Newly-locked samples are held in `pending` and flushed to the
        // pipeline at MIN_INGEST_INTERVAL, coalescing packet bursts.
        let until = Instant::now() + Duration::from_secs(1);
        let mut pending: Option<(f64, f64, f64, f64)> = None; // lat, long, z, raw heading
        let mut last_ingest = Instant::now()
            .checked_sub(MIN_INGEST_INTERVAL)
            .unwrap_or_else(Instant::now);
        while Instant::now() < until && !stop.load(Ordering::SeqCst) {
            match rx.recv_timeout(Duration::from_millis(25)) {
                Ok(mut payload) => {
                    while let Ok(newer) = rx.try_recv() {
                        payload = newer;
                    }
                    let now_s = started.elapsed().as_secs_f64();
                    if let Some(s) = tracker.try_track(&payload, now_s) {
                        // Axis swap: Unreal X is longitude, Unreal Y is
                        // latitude; the pipeline wants (game_lat, game_long).
                        pending = Some((s.ue_y, s.ue_x, s.ue_z, s.map_heading_deg()));
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => break,
            }

            if let Some((lat, long, z, raw_heading)) = pending {
                if last_ingest.elapsed() >= MIN_INGEST_INTERVAL {
                    let heading = smoothed_heading
                        .map_or(raw_heading, |prev| {
                            smooth_heading(prev, raw_heading, HEADING_SMOOTHING)
                        });
                    smoothed_heading = Some(heading);
                    crate::pipeline::ingest_sample_with_heading(
                        &app, lat, long, z, Some(heading), true,
                    );
                    pending = None;
                    last_ingest = Instant::now();
                }
            }
        }
    }

    stop_all(&mut workers);
}

fn drain(rx: &Receiver<Vec<u8>>) {
    while rx.try_recv().is_ok() {}
}

/// Signal every capture thread first, THEN let `Drop` join them. Dropping the
/// vec element-by-element would pay up to `READ_TIMEOUT_MS` per device in
/// series; with the pre-filter this list is short, but a burst of adapters
/// still shouldn't stall a port switch.
fn stop_all(workers: &mut Vec<CaptureWorker>) {
    for w in workers.iter() {
        w.stop.store(true, Ordering::SeqCst);
    }
    workers.clear();
}

/// UDP ports every running game client owns, as one sorted set.
fn game_udp_ports() -> BTreeSet<u16> {
    let image = settings::GAME_PROCESS_NAME;
    crate::win::game_window::pids_for_image(image)
        .into_iter()
        .flat_map(udp_ports::owned_udp_ports)
        .collect()
}

/// One capture thread per Npcap device. `Drop` signals + joins it.
struct CaptureWorker {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

impl Drop for CaptureWorker {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn spawn_workers(ports: &BTreeSet<u16>, tx: &SyncSender<Vec<u8>>) -> Result<Vec<CaptureWorker>, String> {
    let wpcap = wpcap::Wpcap::load()?;
    let devices = wpcap.device_names()?;
    if devices.is_empty() {
        return Err("no capture devices".into());
    }

    let filter = format!(
        "udp and ({})",
        ports
            .iter()
            .map(|p| format!("src port {p}"))
            .collect::<Vec<_>>()
            .join(" or ")
    );

    let mut workers = Vec::new();
    for device in devices {
        let stop = Arc::new(AtomicBool::new(false));
        let wpcap = Arc::clone(&wpcap);
        let tx = tx.clone();
        let filter = filter.clone();
        let thread_stop = Arc::clone(&stop);
        let handle = std::thread::Builder::new()
            .name("localpos-cap".into())
            .spawn(move || capture_device(wpcap, device, filter, tx, thread_stop))
            .map_err(|e| e.to_string())?;
        workers.push(CaptureWorker {
            stop,
            handle: Some(handle),
        });
    }
    Ok(workers)
}

fn capture_device(
    wpcap: Arc<wpcap::Wpcap>,
    device: CString,
    filter: String,
    tx: SyncSender<Vec<u8>>,
    stop: Arc<AtomicBool>,
) {
    let mut capture = match wpcap.open(&device, SNAPLEN, READ_TIMEOUT_MS) {
        Ok(c) => c,
        Err(e) => {
            log::debug!("localpos: open {device:?} failed: {e}");
            return;
        }
    };
    if let Err(e) = capture.set_filter(&filter) {
        log::debug!("localpos: filter on {device:?} failed: {e}");
        return;
    }
    let link_type = capture.datalink();

    while !stop.load(Ordering::SeqCst) {
        match capture.next() {
            Ok(wpcap::Packet::Frame(frame)) => {
                if let Some(payload) = frame::udp_payload(frame, link_type) {
                    if !payload.is_empty() {
                        // Drop on overflow — newest matters, not completeness.
                        let _ = tx.try_send(payload.to_vec());
                    }
                }
            }
            Ok(wpcap::Packet::Timeout) => {}
            Err(e) => {
                log::debug!("localpos: capture on {device:?} ended: {e}");
                return;
            }
        }
    }
}
