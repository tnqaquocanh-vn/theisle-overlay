//! Is Npcap present and usable? Port of IsleLiveMap's `NpcapAvailabilityProbe`
//! (MIT), plus the official download page for the manual-install path.
//!
//! v1.12 does NOT auto-download the installer — the user runs Npcap's own
//! signed installer from npcap.com (its UAC + Authenticode prompt is the
//! trust boundary). Full in-app install (G2) lands in a later build.

use std::path::PathBuf;

use serde::Serialize;

use super::wpcap::Wpcap;

/// Where to send the user to install Npcap. Pinned to the official host.
pub const NPCAP_DOWNLOAD_URL: &str = "https://npcap.com/#download";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NpcapStatus {
    /// `wpcap.dll` loaded AND at least one capture device is visible.
    pub available: bool,
    /// Localised-agnostic short reason when not available (English key-ish
    /// text; the UI shows its own copy and only uses this for logs).
    pub detail: Option<String>,
    pub download_url: &'static str,
}

fn runtime_files_present() -> bool {
    let Ok(root) = std::env::var("SystemRoot") else {
        return false;
    };
    let dir = PathBuf::from(root).join("System32").join("Npcap");
    dir.join("wpcap.dll").exists() && dir.join("Packet.dll").exists()
}

/// Cheap check used by the UI and before starting capture.
pub fn status() -> NpcapStatus {
    // The DLL can also sit on PATH (WinPcap-compat mode) — trust an actual
    // load over the file probe, but the file probe is a fast negative.
    if !runtime_files_present() {
        if let Err(e) = Wpcap::load() {
            return NpcapStatus {
                available: false,
                detail: Some(e),
                download_url: NPCAP_DOWNLOAD_URL,
            };
        }
    }

    match Wpcap::load() {
        Ok(wpcap) => match wpcap.device_names() {
            Ok(names) if !names.is_empty() => NpcapStatus {
                available: true,
                detail: None,
                download_url: NPCAP_DOWNLOAD_URL,
            },
            Ok(_) => NpcapStatus {
                available: false,
                detail: Some("no capture devices".into()),
                download_url: NPCAP_DOWNLOAD_URL,
            },
            Err(e) => NpcapStatus {
                available: false,
                detail: Some(e),
                download_url: NPCAP_DOWNLOAD_URL,
            },
        },
        Err(e) => NpcapStatus {
            available: false,
            detail: Some(e),
            download_url: NPCAP_DOWNLOAD_URL,
        },
    }
}
