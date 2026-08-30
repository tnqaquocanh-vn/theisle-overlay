// Supporter license — a tiny reactive wrapper over the Rust license client.
// Shared by the Settings "Người ủng hộ" card and by feature gates
// (`isSupporter()`), so every screen reads one source of truth.
//
// The free core is NEVER gated. Only the extras listed in the license plan
// check `isSupporter()`. Rust keeps its own authoritative flag for the
// window-toggle commands; this store just mirrors it for the UI.
import {
  licenseActivate,
  licenseClear,
  licenseRefresh,
  licenseStatus,
  type LicenseStatus,
} from "$lib/api";

export type LicensePhase = "idle" | "checking" | "ok" | "error";

export const license = $state({
  tier: "free" as LicenseStatus["tier"],
  grace: false,
  checkedAt: 0,
  keyMasked: null as string | null,
  phase: "idle" as LicensePhase,
  /** Last activate/refresh error slug from Rust ("unknown" | "revoked" | …). */
  error: null as string | null,
});

function apply(s: LicenseStatus): void {
  license.tier = s.tier;
  license.grace = s.grace;
  license.checkedAt = s.checkedAt;
  license.keyMasked = s.keyMasked;
  license.error = s.error;
}

/** True when the supporter tier is active (incl. the offline grace window). */
export function isSupporter(): boolean {
  return license.tier === "supporter";
}

/** Load the cached status — call once on app mount. Never throws. */
export async function loadLicense(): Promise<void> {
  try {
    apply(await licenseStatus());
  } catch {
    /* leave the defaults (free) */
  }
}

/** Activate a pasted key. Returns true on success. */
export async function activate(key: string): Promise<boolean> {
  license.phase = "checking";
  license.error = null;
  try {
    const s = await licenseActivate(key.trim());
    apply(s);
    license.phase = s.error ? "error" : "ok";
    return !s.error && s.tier === "supporter";
  } catch (e) {
    license.error = String(e);
    license.phase = "error";
    return false;
  }
}

/** Re-check the stored key against the server (the "Kiểm tra lại" button). */
export async function refresh(): Promise<void> {
  license.phase = "checking";
  license.error = null;
  try {
    apply(await licenseRefresh());
    license.phase = "ok";
  } catch (e) {
    license.error = String(e);
    license.phase = "error";
  }
}

/** Forget the key — back to free immediately. */
export async function clearLicense(): Promise<void> {
  try {
    apply(await licenseClear());
  } catch {
    /* ignore */
  }
  license.phase = "idle";
  license.error = null;
}
