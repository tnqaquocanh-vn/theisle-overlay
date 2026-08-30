//! A7 — the second-monitor companion window (v1.27). Unlike `bigmap`, this is
//! an ORDINARY top-level window: it has a title bar and a taskbar entry, takes
//! keyboard focus like any app window, and is not anchored to the game or kept
//! topmost. It hosts a dashboard — the shared `<FullMap>` plus compact dino
//! stats, the team roster and the Prime-quest list — for a player who has a
//! second screen and wants the full picture without shrinking the in-game HUD.
//!
//! Anti-cheat: nothing here reads or writes the game process. It is a plain
//! Tauri window rendering data the app already holds; toggled by Ctrl+Alt+D,
//! the "Open companion" button, or its own ✕ (which hides, not closes).

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::settings;
use crate::state::{AppState, LockExt};
use crate::win::vis;

const DEFAULT_W: f64 = 1280.0;
const DEFAULT_H: f64 = 820.0;
const MIN_W: f64 = 760.0;
const MIN_H: f64 = 520.0;

/// Persist the window's current logical geometry so the next open reappears on
/// the same monitor at the same size. Called on blur and on close — infrequent
/// enough to write straight through the settings debouncer.
fn save_geometry(window: &tauri::WebviewWindow) {
    let (Ok(pos), Ok(size), Ok(scale)) = (
        window.outer_position(),
        window.inner_size(),
        window.scale_factor(),
    ) else {
        return;
    };
    // A minimized window reports a 0×0 size and an off-screen sentinel
    // position on Windows — never persist that.
    if size.width < 200 || size.height < 200 || pos.x < -30_000 || pos.y < -30_000 {
        return;
    }
    let s = scale.max(0.1);
    let patch = serde_json::json!({ "companion": {
        "x": (f64::from(pos.x) / s).round(),
        "y": (f64::from(pos.y) / s).round(),
        "w": (f64::from(size.width) / s).round(),
        "h": (f64::from(size.height) / s).round(),
    }});
    let state = window.app_handle().state::<AppState>();
    {
        let mut cfg = state.settings.lock_safe();
        *cfg = settings::merge(&cfg, &patch);
    }
    state.request_settings_save();
}

/// Build the (hidden) companion window. Also the self-heal path if the user
/// force-closed it or a WebView2 crash took it down.
fn build_window(app: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let (w, h, xy) = {
        let state = app.state::<AppState>();
        let s = state.settings.lock_safe();
        let g = |k: &str, d: f64| settings::get_f64(&s, &["companion", k], d);
        let w = g("w", DEFAULT_W).max(MIN_W);
        let h = g("h", DEFAULT_H).max(MIN_H);
        // x / y are null on a first run — center then.
        let has = |k: &str| settings::get_path(&s, &["companion", k]).and_then(serde_json::Value::as_f64);
        let xy = match (has("x"), has("y")) {
            (Some(x), Some(y)) => Some((x, y)),
            _ => None,
        };
        (w, h, xy)
    };

    let mut builder =
        WebviewWindowBuilder::new(app, "companion", WebviewUrl::App("companion.html".into()))
            .title("The Isle Overlay — Companion")
            .inner_size(w, h)
            .min_inner_size(MIN_W, MIN_H)
            .resizable(true)
            .decorations(true)
            .visible(false);
    builder = match xy {
        Some((x, y)) => builder.position(x, y),
        None => builder.center(),
    };
    let window = builder.build()?;

    if let Ok(hwnd) = window.hwnd() {
        vis::register("companion", hwnd.0 as isize);
    }

    // ✕ on the title bar hides the window instead of destroying it, so a
    // reopen is instant and keeps the map's zoom/pan. `toggle` rebuilds only
    // if something else (a crash) actually removed it. Blur / close also
    // persist the window's size + position for the next open.
    let w = window.clone();
    window.on_window_event(move |event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            save_geometry(&w);
            let _ = w.emit("companion://vis", false);
            let _ = w.hide();
            crate::webview_mem::on_hidden(&w);
        }
        tauri::WindowEvent::Focused(false) => save_geometry(&w),
        _ => {}
    });

    Ok(window)
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    build_window(app)?;
    Ok(())
}

/// Ctrl+Alt+D, the "Open companion" button, and `toggle_companion`. Hide when
/// it is the window in front; otherwise bring it up (un-minimise + focus).
pub fn toggle(app: &AppHandle) {
    // Supporter-gated (v1.31). A non-supporter can never open it, so there is
    // nothing on screen to hide — just nudge them to the Settings card.
    if !crate::license::is_supporter() {
        let _ = app.emit("license://required", "companion");
        log::info!("companion: blocked — supporter only");
        return;
    }

    let on_screen = vis::is_visible("companion").unwrap_or(false)
        && !vis::is_minimized("companion").unwrap_or(false)
        && vis::is_foreground("companion");

    if on_screen {
        if let Some(w) = app.get_webview_window("companion") {
            let _ = w.emit("companion://vis", false);
            let _ = w.hide();
            crate::webview_mem::on_hidden(&w);
        }
        log::info!("companion: hide");
        return;
    }

    let window = match app.get_webview_window("companion") {
        Some(w) => {
            crate::webview_mem::on_shown(&w);
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
            w
        }
        None => {
            log::warn!("companion window is gone — recreating");
            match build_window(app) {
                Ok(w) => {
                    let _ = w.show();
                    let _ = w.set_focus();
                    w
                }
                Err(e) => {
                    log::warn!("companion recreate failed: {e}");
                    return;
                }
            }
        }
    };
    crate::pipeline::resync(app);
    // Companion.svelte un-parks its <FullMap> on this.
    let _ = window.emit("companion://vis", true);
    log::info!("companion: show");
}

#[tauri::command]
pub fn toggle_companion(app: AppHandle) {
    toggle(&app);
}
