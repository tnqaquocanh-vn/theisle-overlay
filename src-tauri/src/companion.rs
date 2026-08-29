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

use crate::win::vis;

/// Build the (hidden) companion window. Also the self-heal path if the user
/// force-closed it or a WebView2 crash took it down.
fn build_window(app: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let window =
        WebviewWindowBuilder::new(app, "companion", WebviewUrl::App("companion.html".into()))
            .title("The Isle Overlay — Companion")
            .inner_size(1280.0, 820.0)
            .min_inner_size(760.0, 520.0)
            .resizable(true)
            .decorations(true)
            .visible(false)
            .center()
            .build()?;

    if let Ok(hwnd) = window.hwnd() {
        vis::register("companion", hwnd.0 as isize);
    }

    // ✕ on the title bar hides the window instead of destroying it, so a
    // reopen is instant and keeps the map's zoom/pan. `toggle` rebuilds only
    // if something else (a crash) actually removed it.
    let w = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w.emit("companion://vis", false);
            let _ = w.hide();
            crate::webview_mem::on_hidden(&w);
        }
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
