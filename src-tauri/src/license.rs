//! Supporter license — unlocks a few power-user features (see the license
//! plan). A key is validated against the Worker
//! (`/v1/license/validate`); the result is cached locally, HMAC-signed with a
//! baked salt so casual edits of `license.json` don't grant supporter, and
//! trusted for `CACHE_FRESH_DAYS` offline (then a short grace, then the
//! supporter features lock again — the free core NEVER locks).
//!
//! The salt is obfuscation, not real security: a determined person can patch
//! the binary. The real lever is that the gated features are worthwhile only
//! with a live key, and telemetry surfaces forks that spoof this.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::settings;

type HmacSha256 = Hmac<Sha256>;

/// Must match `API_BASES` in telemetry/client.rs — set both to your deployed
/// `worker/` when you go live.
const LICENSE_BASE: &str = "https://theisle-overlay-api.quocanh.workers.dev";
const FP_SALT: &[u8] = b"tio.fp.v1.bumbum";
const CACHE_SALT: &[u8] = b"tio.license.cache.v1.bumbum";
const CACHE_FRESH_DAYS: i64 = 14;
const CACHE_GRACE_DAYS: i64 = 3;

/// Cheap read for the gate checks (companion toggle, skin preset cap, and
/// whatever v1.31.x adds): mirrors the last `status()` / `activate()` /
/// `refresh()` so a check never touches disk.
static SUPPORTER: AtomicBool = AtomicBool::new(false);

pub fn is_supporter() -> bool {
    SUPPORTER.load(Ordering::Relaxed)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    /// "free" | "supporter"
    pub tier: String,
    /// True while running on a stale-but-within-grace cache.
    pub grace: bool,
    /// Unix seconds of the last successful server validation.
    pub checked_at: i64,
    /// The activated key, masked for display (`BUMBUM-••••-••••-AB12`).
    pub key_masked: Option<String>,
    /// Set on the last activate/refresh attempt when it failed.
    pub error: Option<String>,
}

impl LicenseStatus {
    fn free() -> Self {
        Self { tier: "free".into(), ..Default::default() }
    }
}

#[derive(Serialize, Deserialize)]
struct Cache {
    key: String,
    tier: String,
    checked_at: i64,
    sig: String,
}

fn now_s() -> i64 {
    chrono::Utc::now().timestamp()
}

fn hexs(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn mask(key: &str) -> String {
    match key.rsplit_once('-') {
        Some((_, last)) => format!("BUMBUM-••••-••••-{last}"),
        None => "••••".into(),
    }
}

/// Stable-ish per-machine id. PC/user rename shifts it; the server tolerates
/// two rebinds a month, so that's fine.
pub fn machine_fp() -> String {
    let parts = [
        std::env::var("COMPUTERNAME").unwrap_or_default(),
        std::env::var("USERNAME").unwrap_or_default(),
        std::env::var("PROCESSOR_IDENTIFIER").unwrap_or_default(),
    ]
    .join("|");
    let mut mac = HmacSha256::new_from_slice(FP_SALT).expect("hmac key");
    mac.update(parts.as_bytes());
    hexs(&mac.finalize().into_bytes())[..32].to_string()
}

fn cache_sig(key: &str, tier: &str, checked_at: i64) -> String {
    let mut mac = HmacSha256::new_from_slice(CACHE_SALT).expect("hmac key");
    mac.update(format!("{key}|{tier}|{checked_at}").as_bytes());
    hexs(&mac.finalize().into_bytes())
}

fn cache_path() -> std::path::PathBuf {
    settings::roaming_dir().join("license.json")
}

fn read_cache() -> Option<Cache> {
    let text = std::fs::read_to_string(cache_path()).ok()?;
    let c: Cache = serde_json::from_str(&text).ok()?;
    if c.sig != cache_sig(&c.key, &c.tier, c.checked_at) {
        return None; // tampered / stale format
    }
    Some(c)
}

fn write_cache(key: &str, tier: &str, checked_at: i64) {
    let c = Cache {
        key: key.to_string(),
        tier: tier.to_string(),
        checked_at,
        sig: cache_sig(key, tier, checked_at),
    };
    let _ = std::fs::create_dir_all(settings::roaming_dir());
    if let Ok(text) = serde_json::to_string(&c) {
        let _ = std::fs::write(cache_path(), text);
    }
}

fn clear_cache() {
    let _ = std::fs::remove_file(cache_path());
}

/// Current status from the local cache alone (no network). Applies the
/// freshness / grace / expiry ladder.
pub fn status() -> LicenseStatus {
    let Some(c) = read_cache() else {
        SUPPORTER.store(false, Ordering::Relaxed);
        return LicenseStatus::free();
    };
    let age_days = (now_s() - c.checked_at).max(0) / 86_400;
    let (tier, grace) = if age_days <= CACHE_FRESH_DAYS {
        (c.tier.clone(), false)
    } else if age_days <= CACHE_FRESH_DAYS + CACHE_GRACE_DAYS {
        (c.tier.clone(), true)
    } else {
        ("free".to_string(), false) // supporter locks; free core is untouched
    };
    SUPPORTER.store(tier == "supporter", Ordering::Relaxed);
    LicenseStatus {
        tier,
        grace,
        checked_at: c.checked_at,
        key_masked: Some(mask(&c.key)),
        error: None,
    }
}

fn client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .user_agent(concat!("TheIsleOverlay/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::blocking::Client::new())
}

fn post_validate(key: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "key": key,
        "fp": machine_fp(),
        "appVersion": env!("CARGO_PKG_VERSION"),
    });
    let resp = client()
        .post(format!("{LICENSE_BASE}/v1/license/validate"))
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .map_err(|e| e.to_string())?;
    // reqwest's `json` feature is off in this crate (see telemetry/client.rs) —
    // read the body and parse by hand.
    let text = resp.text().map_err(|e| e.to_string())?;
    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if v.get("valid").and_then(|x| x.as_bool()) == Some(true) {
        Ok(v.get("tier").and_then(|x| x.as_str()).unwrap_or("supporter").to_string())
    } else {
        Err(v.get("reason").and_then(|x| x.as_str()).unwrap_or("invalid").to_string())
    }
}

/// Validate `key` against the server and, on success, persist the cache.
pub fn activate(key: &str) -> LicenseStatus {
    let key = key.trim().to_uppercase();
    match post_validate(&key) {
        Ok(tier) => {
            write_cache(&key, &tier, now_s());
            status()
        }
        Err(e) => {
            let mut s = status();
            s.error = Some(e);
            s
        }
    }
}

/// Re-check the stored key (called on startup / when the tab opens if the
/// cache is stale). Silent — keeps the old cache on a network failure.
pub fn refresh() -> LicenseStatus {
    let Some(c) = read_cache() else {
        return status();
    };
    if let Ok(tier) = post_validate(&c.key) {
        write_cache(&c.key, &tier, now_s());
    } else {
        // leave the cache; status() will grace/expire it by age
    }
    status()
}

pub fn deactivate() -> LicenseStatus {
    clear_cache();
    SUPPORTER.store(false, Ordering::Relaxed);
    LicenseStatus::free()
}

/// Fire a background refresh if the cache is older than a day — cheap to call
/// on startup and on tab focus.
pub fn refresh_if_stale() {
    let stale = read_cache()
        .map(|c| (now_s() - c.checked_at) > 86_400)
        .unwrap_or(false);
    if stale {
        std::thread::spawn(|| {
            let _ = refresh();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_sig_rejects_tamper() {
        let sig = cache_sig("BUMBUM-AAAA-BBBB-CCCC", "supporter", 1_000);
        assert_eq!(sig, cache_sig("BUMBUM-AAAA-BBBB-CCCC", "supporter", 1_000));
        assert_ne!(sig, cache_sig("BUMBUM-AAAA-BBBB-CCCC", "free", 1_000));
        assert_ne!(sig, cache_sig("BUMBUM-AAAA-BBBB-CCCC", "supporter", 2_000));
    }

    #[test]
    fn mask_keeps_only_the_last_group() {
        assert_eq!(mask("BUMBUM-AB12-CD34-EF56"), "BUMBUM-••••-••••-EF56");
    }

    #[test]
    fn machine_fp_is_stable_and_32_hex() {
        let a = machine_fp();
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(a, machine_fp());
    }
}
