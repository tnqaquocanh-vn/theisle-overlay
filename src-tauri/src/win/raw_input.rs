//! G7 — global `Alt+wheel` (zoom) and `Alt+middle-click` (show/hide) for the
//! minimap, via **Raw Input** with `RIDEV_INPUTSINK`.
//!
//! NOT a low-level hook: `SetWindowsHookEx` is forbidden in this codebase
//! (EAC has flagged tools for it — see `hotkeys.rs`). Raw Input is the API
//! games themselves use to read the mouse; it injects nothing and touches no
//! other process. A hidden message-only window receives `WM_INPUT`; a
//! dedicated thread pumps its queue and idles at 0 % CPU.
//!
//! Opt-in: only runs while `settings.minimap.mouse_gestures` is on.

use std::sync::atomic::{AtomicIsize, Ordering};
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use std::thread::JoinHandle;

use tauri::{AppHandle, Manager};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_MENU};
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE,
    RAWINPUTHEADER, RID_INPUT, RIDEV_INPUTSINK,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
    PostThreadMessageW, RegisterClassW, HWND_MESSAGE, MSG, WINDOW_EX_STYLE, WINDOW_STYLE, WM_APP,
    WM_INPUT, WNDCLASSW,
};

use crate::settings;
use crate::state::{AppState, LockExt};

const RI_MOUSE_WHEEL: u16 = 0x0400;
const RI_MOUSE_MIDDLE_BUTTON_DOWN: u16 = 0x0010;
const RIM_TYPEMOUSE: u32 = 0;
const HID_USAGE_PAGE_GENERIC: u16 = 0x01;
const HID_USAGE_GENERIC_MOUSE: u16 = 0x02;
const WM_STOP: u32 = WM_APP + 1;

static HANDLE: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
static THREAD_ID: AtomicIsize = AtomicIsize::new(0);
/// Gestures decoded on the message-pump thread are sent here; a dedicated
/// worker thread runs the actual action so the pump never blocks (see `run`).
static WORK_TX: Mutex<Option<Sender<&'static str>>> = Mutex::new(None);

/// Start or stop the Raw Input listener to match `minimap.mouse_gestures`.
pub fn apply_settings(app: &AppHandle) {
    let on = {
        let state = app.state::<AppState>();
        let s = state.settings.lock_safe();
        settings::get_bool(&s, &["minimap", "mouse_gestures"], false)
    };
    let mut slot = HANDLE.lock_safe();
    match (on, slot.is_some()) {
        (true, false) => {
            THREAD_ID.store(0, Ordering::SeqCst);
            let app = app.clone();
            let handle = std::thread::Builder::new()
                .name("raw-input".into())
                .spawn(move || run(app))
                .expect("spawn raw-input");
            *slot = Some(handle);
        }
        (false, true) => stop(&mut slot),
        _ => {}
    }
}

fn stop(slot: &mut Option<JoinHandle<()>>) {
    if let Some(handle) = slot.take() {
        let tid = THREAD_ID.load(Ordering::SeqCst) as u32;
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_STOP, WPARAM(0), LPARAM(0));
            }
        }
        let _ = handle.join();
    }
}

/// App is exiting — tear the listener down like `mouse_gestures` → off, so the
/// message-only window is destroyed (see `crate::shutdown`).
pub fn shutdown() {
    let mut slot = HANDLE.lock_safe();
    stop(&mut slot);
}

fn run(app: AppHandle) {
    unsafe {
        let hinstance = match GetModuleHandleW(None) {
            Ok(h) => h,
            Err(_) => return,
        };
        let class_name: Vec<u16> = "IsleOverlayRawInput\0".encode_utf16().collect();
        let wc = WNDCLASSW {
            lpfnWndProc: Some(wndproc),
            hInstance: hinstance.into(),
            lpszClassName: PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        RegisterClassW(&wc); // benign if already registered

        let hwnd = match CreateWindowExW(
            WINDOW_EX_STYLE(0),
            PCWSTR(class_name.as_ptr()),
            PCWSTR(class_name.as_ptr()),
            WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None,
            Some(hinstance.into()),
            None,
        ) {
            Ok(h) => h,
            Err(e) => {
                log::warn!("raw-input: CreateWindow failed: {e}");
                return;
            }
        };

        let rid = RAWINPUTDEVICE {
            usUsagePage: HID_USAGE_PAGE_GENERIC,
            usUsage: HID_USAGE_GENERIC_MOUSE,
            dwFlags: RIDEV_INPUTSINK,
            hwndTarget: hwnd,
        };
        if RegisterRawInputDevices(&[rid], std::mem::size_of::<RAWINPUTDEVICE>() as u32).is_err() {
            log::warn!("raw-input: RegisterRawInputDevices failed");
            let _ = DestroyWindow(hwnd);
            return;
        }

        THREAD_ID.store(GetCurrentThreadId() as isize, Ordering::SeqCst);

        // Gesture actions run on their OWN thread. `crate::hotkeys::trigger`
        // reaches `apply_settings_patch`, which takes tauri locks and — on a
        // `mouse_gestures` change — calls back into `apply_settings` here.
        // Doing that on this (the message-pump) thread deadlocks a concurrent
        // teardown that holds HANDLE while joining this thread. The pump must
        // only ever do a non-blocking channel send. Same lesson as hotkeys.rs.
        let (work_tx, work_rx) = std::sync::mpsc::channel::<&'static str>();
        *WORK_TX.lock_safe() = Some(work_tx);
        let worker_app = app.clone();
        let worker = std::thread::Builder::new()
            .name("raw-input-act".into())
            .spawn(move || {
                while let Ok(action) = work_rx.recv() {
                    crate::hotkeys::trigger(&worker_app, action);
                }
            })
            .ok();

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            if msg.message == WM_STOP {
                break;
            }
            let _ = DispatchMessageW(&msg);
        }

        *WORK_TX.lock_safe() = None; // drops the sole Sender -> worker ends
        if let Some(worker) = worker {
            let _ = worker.join();
        }
        let _ = DestroyWindow(hwnd);
    }
}

extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if msg == WM_INPUT {
        handle_input(LPARAM(lparam.0));
        return LRESULT(0);
    }
    unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
}

fn handle_input(lparam: LPARAM) {
    // Only act while Alt is held — nothing else is intercepted, and normal
    // scrolling / middle-click pass straight through (INPUTSINK does not
    // swallow input).
    let alt_down = unsafe { (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0 };
    if !alt_down {
        return;
    }

    let mut raw = RAWINPUT::default();
    let mut size = std::mem::size_of::<RAWINPUT>() as u32;
    let header = std::mem::size_of::<RAWINPUTHEADER>() as u32;
    let read = unsafe {
        GetRawInputData(
            HRAWINPUT(lparam.0 as *mut _),
            RID_INPUT,
            Some(&mut raw as *mut _ as *mut _),
            &mut size,
            header,
        )
    };
    if read == u32::MAX || raw.header.dwType != RIM_TYPEMOUSE {
        return;
    }

    let mouse = unsafe { raw.data.mouse };
    let flags = unsafe { mouse.Anonymous.Anonymous.usButtonFlags };
    let action = if flags & RI_MOUSE_WHEEL != 0 {
        let delta = unsafe { mouse.Anonymous.Anonymous.usButtonData } as i16;
        if delta > 0 {
            "zoom_in"
        } else if delta < 0 {
            "zoom_out"
        } else {
            return;
        }
    } else if flags & RI_MOUSE_MIDDLE_BUTTON_DOWN != 0 {
        "toggle_minimap"
    } else {
        return;
    };

    if let Some(tx) = WORK_TX.lock_safe().as_ref() {
        let _ = tx.send(action);
    }
}
