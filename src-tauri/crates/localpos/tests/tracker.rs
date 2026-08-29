//! Port of IsleLiveMap's `UnrealMovementPacketDecoderTests` — the tracker half
//! (bootstrap lock + `try_continue_track` timestamp handling).

use localpos::{LocalMovementTracker, MovementCandidate};

fn hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex digit"))
        .collect()
}

const STATIONARY_PAYLOAD: &str = "000000000000000000000000000000000000000000000000000000000000000000000000B79D23434900002A6D63F044B54C8970F9D713D44FBFB122080960";
const COMPETING_CANDIDATE_PAYLOAD: &str = "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004ADC1A424168F9F4A4110BA14D30DE832407D71F0006";

fn candidate(x: f64, y: f64, z: f64, timestamp: f32) -> MovementCandidate {
    MovementCandidate {
        ue_x: x,
        ue_y: y,
        ue_z: z,
        unreal_yaw_deg: 0.0,
        client_timestamp: timestamp,
        payload_len: 65,
        location_bit_offset: 380,
        component_bit_count: 26,
    }
}

#[test]
fn tracker_locks_after_stable_bootstrap_window() {
    let mut tracker = LocalMovementTracker::new();
    let payload = hex(STATIONARY_PAYLOAD);

    for index in 0..12 {
        assert!(
            tracker.try_track(&payload, index as f64 * 0.050).is_none(),
            "no lock during bootstrap (tick {index})",
        );
    }

    let sample = tracker.try_track(&payload, 0.600).expect("locks after 600 ms of stable hits");
    assert!((sample.ue_x - 442_020.33).abs() < 0.01, "x = {}", sample.ue_x);
    assert!((sample.ue_y + 162_148.37).abs() < 0.01, "y = {}", sample.ue_y);
}

#[test]
fn tracker_locks_real_world_vector_from_live_payload() {
    let mut tracker = LocalMovementTracker::new();
    let payload = hex(COMPETING_CANDIDATE_PAYLOAD);

    let decoded = localpos::UnrealMovementPacketDecoder::new().decode(&payload);
    assert!(
        decoded
            .iter()
            .any(|c| (c.ue_x - 137_939.16).abs() < 0.01 && (c.ue_y - 285_822.42).abs() < 0.01),
        "the real vector is among the candidates",
    );

    let mut tracked = MovementCandidate {
        ue_x: 0.0,
        ue_y: 0.0,
        ue_z: 0.0,
        unreal_yaw_deg: 0.0,
        client_timestamp: 0.0,
        payload_len: 0,
        location_bit_offset: 0,
        component_bit_count: 0,
    };
    for index in 0..=12 {
        if let Some(sample) = tracker.try_track(&payload, index as f64 * 0.050) {
            tracked = sample;
        }
    }

    assert!((tracked.ue_x - 137_939.16).abs() < 0.01, "x = {}", tracked.ue_x);
    assert!((tracked.ue_y - 285_822.42).abs() < 0.01, "y = {}", tracked.ue_y);
    assert!((tracked.unreal_yaw_deg - 22.38).abs() < 0.01, "yaw = {}", tracked.unreal_yaw_deg);
}

#[test]
fn tracker_rejects_retransmitted_movement_with_older_client_timestamp() {
    let current = candidate(100.0, 100.0, 100.0, 40.0);
    let retransmitted = candidate(450.0, 100.0, 100.0, 39.5);

    let selected =
        LocalMovementTracker::try_continue_track(&[retransmitted], current, -0.050, 0.0);

    assert!(selected.is_none());
}

#[test]
fn tracker_prefers_newest_forward_movement_over_older_saved_move() {
    let current = candidate(100.0, 100.0, 100.0, 40.0);
    let retransmitted = candidate(450.0, 100.0, 100.0, 39.5);
    let newest = candidate(130.0, 110.0, 100.0, 40.05);

    let sample =
        LocalMovementTracker::try_continue_track(&[retransmitted, newest], current, -0.050, 0.0)
            .expect("picks a forward candidate");

    assert_eq!(sample, newest);
}

#[test]
fn tracker_recovers_from_unreliable_timestamp_without_long_position_freeze() {
    let current = candidate(100.0, 100.0, 100.0, 229_678.0);
    let valid_low_timestamp = candidate(140.0, 120.0, 100.0, 134.0);

    let sample =
        LocalMovementTracker::try_continue_track(&[valid_low_timestamp], current, -0.300, 0.0)
            .expect("recovers rather than freezing");

    assert_eq!(sample.ue_x, valid_low_timestamp.ue_x);
    assert_eq!(sample.ue_y, valid_low_timestamp.ue_y);
    assert!(sample.client_timestamp >= current.client_timestamp);
}

#[test]
fn tracker_normalizes_implausible_timestamp_jump_without_dropping_position() {
    let current = candidate(100.0, 100.0, 100.0, 134.0);
    let valid_poisoned_timestamp = candidate(140.0, 120.0, 100.0, 229_678.0);

    let sample =
        LocalMovementTracker::try_continue_track(&[valid_poisoned_timestamp], current, -0.050, 0.0)
            .expect("keeps the position");

    assert_eq!(sample.ue_x, valid_poisoned_timestamp.ue_x);
    assert_eq!(sample.ue_y, valid_poisoned_timestamp.ue_y);
    assert!((134.0..=135.0).contains(&sample.client_timestamp), "ts = {}", sample.client_timestamp);
}

#[test]
fn tracker_reset_drops_the_lock() {
    let mut tracker = LocalMovementTracker::new();
    let payload = hex(STATIONARY_PAYLOAD);
    for index in 0..=12 {
        tracker.try_track(&payload, index as f64 * 0.050);
    }
    tracker.reset();
    // After a reset the next tick starts a fresh bootstrap: no immediate lock.
    assert!(tracker.try_track(&payload, 1.0).is_none());
}
