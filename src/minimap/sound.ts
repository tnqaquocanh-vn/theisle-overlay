// A10 — opt-in HUD sound cues. Synthesised with the Web Audio API: no bundled
// asset, no extra CSP surface, a few hundred bytes of code. Each cue is a
// short two-tone chirp. The AudioContext is created lazily on the first cue
// (by then the user has interacted with something) and resumed if suspended.
//
// Off by default (settings.sound.enabled). Failures — no output device, a
// browser autoplay block — are swallowed; a missing beep must never matter.

let ctx: AudioContext | null = null;

function beep(freq: number, startS: number, durS: number, peak: number): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + startS;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durS);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durS + 0.03);
}

export type Cue = "ping" | "lowhp" | "lost";

export function cue(kind: Cue): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "ping") {
      // teammate contact ping — bright, rising
      beep(880, 0, 0.09, 0.18);
      beep(1320, 0.1, 0.11, 0.16);
    } else if (kind === "lowhp") {
      // teammate in trouble — lower, falling
      beep(440, 0, 0.12, 0.16);
      beep(370, 0.14, 0.16, 0.16);
    } else {
      // position signal lost — soft, descending
      beep(600, 0, 0.14, 0.12);
      beep(420, 0.16, 0.2, 0.12);
    }
  } catch {
    /* no audio device / autoplay blocked — stay silent */
  }
}
