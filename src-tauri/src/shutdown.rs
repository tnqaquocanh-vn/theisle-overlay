//! Best-effort graceful teardown on app exit.
//!
//! The OS reclaims every handle and socket the instant the process dies, so
//! nothing here is *required*. It just lets the workers that hold real OS
//! resources — the Npcap capture (`localpos`), the Raw Input message-only
//! window (`win::raw_input`), the team WebSocket (`team`) — unwind first, so
//! an immediate relaunch never trips a transient "device busy" / "address in
//! use". Runs on `RunEvent::Exit`, which is terminal: teardown here is pure
//! upside.

/// Called once from the `RunEvent::Exit` handler in `lib.rs`.
pub fn on_exit() {
    crate::localpos::shutdown();
    crate::win::raw_input::shutdown();
    crate::team::shutdown();
}
