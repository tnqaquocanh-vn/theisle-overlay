//! Lock tracker over decoded movement candidates. Port of IsleLiveMap's
//! `LocalMovementTracker` (MIT).
//!
//! Every packet yields several plausible candidates (see [`crate::decoder`]).
//! This picks the real position stream and holds onto it:
//!
//!   - **Bootstrap**: group candidates by bit layout; a layout must repeat,
//!     spatially continuous, `REQUIRED_CONSECUTIVE_HITS` times across at least
//!     `MIN_BOOTSTRAP_S` before it can lock.
//!   - **Locked**: follow the same stream by continuity + a forward-moving UE
//!     client timestamp, so re-sent "saved moves" (spatially valid but stale)
//!     never rewind the marker. A poisoned timestamp is normalised, not
//!     dropped — the marker must not freeze.
//!   - Lock is released after `LOCK_LIFETIME_S` with no continuous candidate.
//!
//! Time is passed in as seconds on any monotonic-enough clock; only
//! differences matter (same contract as `overlay-core`'s tracker).

use std::collections::HashMap;

use crate::decoder::{MovementCandidate, UnrealMovementPacketDecoder};

const HYPOTHESIS_LIFETIME_S: f64 = 1.0;
const LOCK_LIFETIME_S: f64 = 2.0;
const MIN_BOOTSTRAP_S: f64 = 0.600;
const MAX_READY_AGE_S: f64 = 0.250;
const REQUIRED_CONSECUTIVE_HITS: u32 = 8;
const TIMESTAMP_REGRESSION_TOLERANCE: f32 = 0.002;
const TIMESTAMP_ADVANCE_ALLOWANCE_S: f32 = 2.0;
const TIMESTAMP_WALLCLOCK_MULTIPLIER: f32 = 4.0;
const TIMESTAMP_RECOVERY_AGE_S: f64 = 0.250;
const MAX_BASE_DELTA: f64 = 5_000.0;
const MAX_UNITS_PER_SECOND: f64 = 100_000.0;

#[derive(Debug, Clone, Copy)]
struct Hypothesis {
    candidate: MovementCandidate,
    first_seen_s: f64,
    last_seen_s: f64,
    consecutive_hits: u32,
}

#[derive(Default)]
pub struct LocalMovementTracker {
    decoder: UnrealMovementPacketDecoder,
    hypotheses: HashMap<(usize, usize, u32), Hypothesis>,
    current: Option<MovementCandidate>,
    last_lock_update_s: f64,
}

impl LocalMovementTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_decoder(decoder: UnrealMovementPacketDecoder) -> Self {
        Self {
            decoder,
            ..Self::default()
        }
    }

    /// Drop the lock and every bootstrap hypothesis (game process changed,
    /// endpoint changed, capture restarted).
    pub fn reset(&mut self) {
        self.current = None;
        self.hypotheses.clear();
        self.last_lock_update_s = 0.0;
    }

    /// Feed one UDP payload observed at `observed_at_s`. Returns the locked
    /// position when there is one this tick, else `None`.
    pub fn try_track(&mut self, payload: &[u8], observed_at_s: f64) -> Option<MovementCandidate> {
        let candidates = self.decoder.decode(payload);

        if let Some(current) = self.current {
            if observed_at_s - self.last_lock_update_s <= LOCK_LIFETIME_S {
                if let Some(sample) = Self::try_continue_track(
                    &candidates,
                    current,
                    self.last_lock_update_s,
                    observed_at_s,
                ) {
                    self.current = Some(sample);
                    self.last_lock_update_s = observed_at_s;
                    return Some(sample);
                }

                // UE resends saved moves while airborne: spatially plausible
                // but older than what is already drawn. Never let bootstrap
                // reacquire one of them.
                if candidates
                    .iter()
                    .any(|c| is_continuous(&current, self.last_lock_update_s, c, observed_at_s))
                {
                    return None;
                }
            }
        }

        if self.current.is_some() && observed_at_s - self.last_lock_update_s > LOCK_LIFETIME_S {
            self.current = None;
            self.hypotheses.clear();
        }

        self.prune_hypotheses(observed_at_s);
        for candidate in &candidates {
            match self.hypotheses.get(&candidate.layout()) {
                Some(h)
                    if observed_at_s - h.last_seen_s <= HYPOTHESIS_LIFETIME_S
                        && is_continuous(&h.candidate, h.last_seen_s, candidate, observed_at_s) =>
                {
                    let hits = h.consecutive_hits + 1;
                    self.hypotheses.insert(
                        candidate.layout(),
                        Hypothesis {
                            candidate: *candidate,
                            first_seen_s: h.first_seen_s,
                            last_seen_s: observed_at_s,
                            consecutive_hits: hits,
                        },
                    );
                }
                _ => {
                    self.hypotheses.insert(
                        candidate.layout(),
                        Hypothesis {
                            candidate: *candidate,
                            first_seen_s: observed_at_s,
                            last_seen_s: observed_at_s,
                            consecutive_hits: 1,
                        },
                    );
                }
            }
        }

        let mut ready: Vec<&Hypothesis> = self
            .hypotheses
            .values()
            .filter(|h| {
                h.consecutive_hits >= REQUIRED_CONSECUTIVE_HITS
                    && observed_at_s - h.first_seen_s >= MIN_BOOTSTRAP_S
                    && observed_at_s - h.last_seen_s <= MAX_READY_AGE_S
            })
            .collect();
        ready.sort_by(|a, b| {
            b.consecutive_hits
                .cmp(&a.consecutive_hits)
                .then(b.candidate.component_bit_count.cmp(&a.candidate.component_bit_count))
                .then(
                    (b.candidate.ue_x.abs() + b.candidate.ue_y.abs())
                        .partial_cmp(&(a.candidate.ue_x.abs() + a.candidate.ue_y.abs()))
                        .unwrap_or(std::cmp::Ordering::Equal),
                )
        });

        if let Some(best) = ready.first() {
            let locked = best.candidate;
            self.current = Some(locked);
            self.last_lock_update_s = observed_at_s;
            self.hypotheses.clear();
            return Some(locked);
        }

        None
    }

    /// Follow the locked stream: keep the newest spatially-continuous
    /// candidate whose UE client timestamp has not gone backwards. Exposed
    /// for tests. Returns the sample to render, or `None` to hold.
    pub fn try_continue_track(
        candidates: &[MovementCandidate],
        current: MovementCandidate,
        last_update_s: f64,
        observed_at_s: f64,
    ) -> Option<MovementCandidate> {
        let elapsed_s = (observed_at_s - last_update_s).max(0.0);

        let mut ranked: Vec<(MovementCandidate, bool)> = candidates
            .iter()
            .filter(|c| is_continuous(&current, last_update_s, c, observed_at_s))
            .map(|c| (*c, is_plausible_forward_timestamp(&current, c, elapsed_s)))
            .filter(|(c, plausible)| {
                *plausible
                    || c.client_timestamp + TIMESTAMP_REGRESSION_TOLERANCE >= current.client_timestamp
                    || elapsed_s >= TIMESTAMP_RECOVERY_AGE_S
            })
            .collect();

        ranked.sort_by(|(a, ap), (b, bp)| {
            use std::cmp::Ordering;
            // plausible first
            bp.cmp(ap)
                // then newest plausible timestamp first (non-plausible tie at -inf)
                .then_with(|| {
                    let ak = if *ap { a.client_timestamp } else { f32::MIN };
                    let bk = if *bp { b.client_timestamp } else { f32::MIN };
                    bk.partial_cmp(&ak).unwrap_or(Ordering::Equal)
                })
                // then closest to current
                .then_with(|| {
                    distance(&current, a)
                        .partial_cmp(&distance(&current, b))
                        .unwrap_or(Ordering::Equal)
                })
                // then lowest bit offset
                .then_with(|| a.location_bit_offset.cmp(&b.location_bit_offset))
        });

        let (candidate, plausible) = *ranked.first()?;
        Some(if plausible {
            candidate
        } else {
            MovementCandidate {
                client_timestamp: current.client_timestamp + elapsed_s as f32,
                ..candidate
            }
        })
    }

    fn prune_hypotheses(&mut self, observed_at_s: f64) {
        self.hypotheses
            .retain(|_, h| observed_at_s - h.last_seen_s <= HYPOTHESIS_LIFETIME_S);
    }
}

fn is_plausible_forward_timestamp(
    current: &MovementCandidate,
    candidate: &MovementCandidate,
    elapsed_s: f64,
) -> bool {
    let delta = candidate.client_timestamp - current.client_timestamp;
    let maximum_advance =
        TIMESTAMP_ADVANCE_ALLOWANCE_S + elapsed_s as f32 * TIMESTAMP_WALLCLOCK_MULTIPLIER;
    delta >= -TIMESTAMP_REGRESSION_TOLERANCE && delta <= maximum_advance
}

fn is_continuous(
    previous: &MovementCandidate,
    previous_at_s: f64,
    current: &MovementCandidate,
    current_at_s: f64,
) -> bool {
    let elapsed_s = (current_at_s - previous_at_s).max(0.0);
    let maximum_delta = MAX_BASE_DELTA + MAX_UNITS_PER_SECOND * elapsed_s;
    distance(previous, current) <= maximum_delta
}

fn distance(left: &MovementCandidate, right: &MovementCandidate) -> f64 {
    let dx = right.ue_x - left.ue_x;
    let dy = right.ue_y - left.ue_y;
    let dz = right.ue_z - left.ue_z;
    (dx * dx + dy * dy + dz * dz).sqrt()
}
