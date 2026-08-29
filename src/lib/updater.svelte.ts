// In-app auto-update. Wraps @tauri-apps/plugin-updater in a small reactive
// state machine shared by the startup check (App.svelte banner) and the
// "Check for updates" card in Settings.
//
// The feed is a signed `latest.json` on GitHub Releases (see
// tauri.conf.json → plugins.updater). Nothing here talks to the game.
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdatePhase =
  | "idle" // nothing to show
  | "checking" // a check() is in flight
  | "available" // an update is waiting for the user to accept
  | "downloading" // downloadAndInstall() running
  | "ready" // installed; relaunching
  | "uptodate" // explicit check found nothing (shown only for manual checks)
  | "error";

export const updater = $state({
  phase: "idle" as UpdatePhase,
  /** Target version, once known (e.g. "1.28.0"). */
  version: null as string | null,
  /** Release notes / changelog body, if the feed carried one. */
  notes: null as string | null,
  /** 0..1 during "downloading". */
  progress: 0,
  /** Last error text, for the "error" phase. */
  error: null as string | null,
});

let pending: Update | null = null;

/**
 * Check the release feed. `silent` swallows the "no update" and any
 * network/parse error so a failed startup poll never nags — the manual
 * button passes `silent = false` to surface both outcomes.
 * Returns true when an update is available.
 */
export async function checkForUpdate(silent = false): Promise<boolean> {
  if (updater.phase === "checking" || updater.phase === "downloading") {
    return false; // a check/download is already in flight
  }
  updater.phase = "checking";
  updater.error = null;
  try {
    const found = await check();
    if (!found) {
      updater.phase = silent ? "idle" : "uptodate";
      return false;
    }
    pending = found;
    updater.version = found.version;
    updater.notes = found.body?.trim() || null;
    updater.phase = "available";
    return true;
  } catch (e) {
    updater.error = String(e);
    updater.phase = silent ? "idle" : "error";
    return false;
  }
}

/** Download + run the installer for the pending update, then restart. */
export async function installUpdate(): Promise<void> {
  if (!pending) return;
  updater.phase = "downloading";
  updater.progress = 0;
  updater.error = null;
  try {
    let total = 0;
    let got = 0;
    await pending.downloadAndInstall((ev) => {
      if (ev.event === "Started") {
        total = ev.data.contentLength ?? 0;
      } else if (ev.event === "Progress") {
        got += ev.data.chunkLength;
        updater.progress = total > 0 ? Math.min(1, got / total) : 0;
      } else if (ev.event === "Finished") {
        updater.progress = 1;
      }
    });
    updater.phase = "ready";
    await relaunch();
  } catch (e) {
    updater.error = String(e);
    updater.phase = "error";
  }
}

/** User dismissed the banner / notice — back to idle (a later check re-raises it). */
export function dismissUpdate(): void {
  if (updater.phase === "available" || updater.phase === "uptodate" || updater.phase === "error") {
    updater.phase = "idle";
  }
}
