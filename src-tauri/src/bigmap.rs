//! v1.25 — the in-game big map. A third overlay window (after `main` and
//! `minimap`) that hosts the SAME `<FullMap>` Leaflet surface the main window
//! uses, anchored over the game's client area so a player can pull up the whole
//! island without Alt-Tab.
//!
//! Focus model (Rust-style): the window carries `WS_EX_NOACTIVATE`, so showing
//! it never pulls focus off the game — you keep walking while you
//! read the map. It is NOT click-through, so the mouse still pans / zooms
//! Leaflet; the keyboard stays with the game. Toggle with Ctrl+Alt+G.
//!
//! One supervisor thread (250 ms tick) owns the ONLY show/hide path — same
//! shape as the minimap's. `WANTED` is the pure user intent (the hotkey / ✕
//! flips it); the supervisor shows the window only while `WANTED` AND the game
//! is the foreground window (so an Alt-Tab away hides it, and tabbing back
//! brings it straight back), follows the game's client rect live, and keeps
//! the window topmost.
//!
//! Anti-cheat: this only ever reads the game window's client rectangle
//! (`GetClientRect` + `ClientToScreen`, the same calls the minimap anchor
//! uses) and positions our OWN window. Nothing reads or writes the game
//! process.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

use crate::minimap::GamePresence;
use crate::settings::{self, GAME_PROCESS_NAME};
use crate::state::{AppState, LockExt};
use crate::win::{game_window, overlay, vis};

/// Pure user intent: flipped by the hotkey / header ✕, read by the supervisor.
/// Not persisted — relaunching the app never re-opens the big map.
static WANTED: AtomicBool = AtomicBool::new(false);

/// "Pin" state (header 📌). Pinned clears WS_EX_NOACTIVATE so the window can
/// hold keyboard focus (Leaflet shortcuts, typing a waypoint name); the game
/// then loses focus, so it is off by default and reset every time the map hides.
static PINNED: AtomicBool = AtomicBool::new(false);

/// Build the (hidden) big-map window. Also the self-heal path if a WebView2
/// crash closed it mid-session.
fn build_window(app: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, "bigmap", WebviewUrl::App("bigmap.html".into()))
        .title("bigmap")
        // Placeholder size — the supervisor resizes it to the game's client
        // area on every show.
        .inner_size(1280.0, 800.0)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        // NOT `.focusable(false)` — that sets WS_EX_NOACTIVATE permanently, and
        // the "pin" toggle needs to clear it. `assert_overlay_styles` sets
        // NOACTIVATE below (the unpinned default); the mouse still reaches
        // Leaflet either way.
        .visible(false)
        .build()?;

    if let Ok(hwnd) = window.hwnd() {
        let raw = hwnd.0 as isize;
        vis::register("bigmap", raw);
        // NOACTIVATE + TOOLWINDOW — never takes keyboard focus, never in the
        // taskbar. (Same assertion the minimap uses; NOT click-through — the
        // mouse must reach Leaflet.)
        overlay::assert_overlay_styles(raw);
    }
    Ok(window)
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    build_window(app)?;
    spawn_supervisor(app.clone());
    Ok(())
}

/// Ctrl+Alt+G, and the header ✕ (which calls `toggle_bigmap`). Only flips the
/// intent — the supervisor does the actual show/hide within one tick.
pub fn toggle(_app: &AppHandle) {
    let now = WANTED.fetch_xor(true, Ordering::SeqCst);
    log::info!("bigmap: {}", if now { "close" } else { "open" });
}

#[tauri::command]
pub fn toggle_bigmap(app: AppHandle) {
    toggle(&app);
}

/// Header 📌. Pinned -> clear WS_EX_NOACTIVATE + focus the window (keyboard
/// works, game loses focus). Unpinned -> restore NOACTIVATE.
#[tauri::command]
pub fn bigmap_set_pinned(app: AppHandle, pinned: bool) {
    PINNED.store(pinned, Ordering::SeqCst);
    if let Some(h) = vis::hwnd("bigmap") {
        overlay::set_no_activate(h, !pinned);
    }
    if pinned {
        if let Some(w) = app.get_webview_window("bigmap") {
            let _ = w.set_focus();
        }
    }
    log::info!("bigmap: {}", if pinned { "pinned" } else { "unpinned" });
}

/// `poll.game_rect_ms` / `poll.topmost_ms`, same knobs the minimap uses.
fn poll_intervals(app: &AppHandle) -> (u64, u64) {
    let state = app.state::<AppState>();
    let s = state.settings.lock_safe();
    (
        settings::get_f64(&s, &["poll", "game_rect_ms"], 1000.0) as u64,
        settings::get_f64(&s, &["poll", "topmost_ms"], 2000.0) as u64,
    )
}

fn position_to(window: &tauri::WebviewWindow, rect: (i32, i32, i32, i32)) {
    let (x, y, w, h) = rect;
    let _ = window.set_position(PhysicalPosition::new(x, y));
    let _ = window.set_size(PhysicalSize::new(w.max(200) as u32, h.max(200) as u32));
}

fn spawn_supervisor(app: AppHandle) {
    std::thread::spawn(move || {
        const TICK_MS: u64 = 250;
        const RECREATE_MS: u64 = 5000;
        let mut presence = GamePresence::new();
        let mut unfocused_ticks: u8 = 0;
        let mut shown = false;
        let mut last_rect: Option<(i32, i32, i32, i32)> = None;
        let mut since_rect: u64 = u64::MAX / 2; // poll immediately
        let mut since_topmost: u64 = 0;
        let mut since_recreate: u64 = u64::MAX / 2;

        loop {
            std::thread::sleep(Duration::from_millis(TICK_MS));
            let (game_rect_ms, topmost_ms) = poll_intervals(&app);

            let Some(window) = app.get_webview_window("bigmap") else {
                since_recreate = since_recreate.saturating_add(TICK_MS);
                if since_recreate >= RECREATE_MS {
                    since_recreate = 0;
                    log::warn!("bigmap window is gone — recreating");
                    if let Err(e) = build_window(&app) {
                        log::warn!("bigmap recreate failed: {e}");
                    }
                    shown = false;
                    last_rect = None;
                }
                continue;
            };
            since_recreate = u64::MAX / 2;
            since_rect += TICK_MS;
            since_topmost += TICK_MS;

            if since_rect >= game_rect_ms {
                since_rect = 0;
                presence.observe(game_window::find_game_window(GAME_PROCESS_NAME));
            }
            let game_present = presence
                .hwnd()
                .is_some_and(|h| !game_window::is_iconic(h));
            if game_present && presence.hwnd().is_some_and(game_window::is_foreground) {
                unfocused_ticks = 0;
            } else {
                unfocused_ticks = unfocused_ticks.saturating_add(1);
            }
            // The auto-hide is for "user Alt-Tabbed to another app", NOT "user
            // is interacting with the pinned big map" — which itself is now the
            // foreground window and would otherwise trip the unfocused count.
            let bigmap_front = vis::is_foreground("bigmap");
            let game_focused = game_present && (unfocused_ticks < 2 || bigmap_front);

            // Show while the user wants it AND either the game is the window in
            // front (normal case), there is no game at all (look around outside
            // a session), or the big map is pinned/front. An Alt-Tab away to a
            // third app hides it; tabbing back shows it again next tick.
            let effective = WANTED.load(Ordering::SeqCst)
                && (!game_present || game_focused || PINNED.load(Ordering::SeqCst));

            if effective != shown {
                if effective {
                    crate::webview_mem::on_shown(&window);
                    if let Some(game) = presence.hwnd() {
                        if let Some(rect) = game_window::client_rect_on_screen(game) {
                            position_to(&window, rect);
                            last_rect = Some(rect);
                        }
                    }
                    if window.show().is_ok() {
                        shown = true;
                        if let Some(h) = vis::hwnd("bigmap") {
                            overlay::force_topmost(h);
                        }
                        crate::pipeline::resync(&app);
                        // BigMap.svelte fades the panel in on this.
                        let _ = window.emit("bigmap://vis", true);
                    }
                } else {
                    // Drop pin state so the next open starts non-activating.
                    if PINNED.swap(false, Ordering::SeqCst) {
                        if let Some(h) = vis::hwnd("bigmap") {
                            overlay::set_no_activate(h, true);
                        }
                    }
                    let _ = window.emit("bigmap://vis", false);
                    if window.hide().is_ok() {
                        shown = false;
                        crate::webview_mem::on_hidden(&window);
                    }
                }
                // A failed show/hide leaves `shown` unchanged — retried next tick.
            }

            if !shown {
                continue;
            }

            // Follow the game as it moves / resizes (windowed, monitor switch).
            if let Some(game) = presence.hwnd() {
                if let Some(rect) = game_window::client_rect_on_screen(game) {
                    if last_rect != Some(rect) {
                        last_rect = Some(rect);
                        position_to(&window, rect);
                    }
                }
            }

            if since_topmost >= topmost_ms {
                since_topmost = 0;
                if let Some(h) = vis::hwnd("bigmap") {
                    overlay::ensure_topmost(h);
                }
            }
        }
    });
}
