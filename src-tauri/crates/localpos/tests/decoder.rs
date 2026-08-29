//! Port of IsleLiveMap's `UnrealMovementPacketDecoderTests` — the decode half.
//! The hex payloads are captured real client moves; the expected values are
//! from the original C# suite.

use localpos::UnrealMovementPacketDecoder;

fn hex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).expect("hex digit"))
        .collect()
}

const MOVING_PAYLOAD: &str = "0000000000000000000000000000000000000000000000000000000000000000000000000022DA49434FFDA3CA0100A0D52153071F18365F8E0F5EE28FD60330";
const STATIONARY_PAYLOAD: &str = "000000000000000000000000000000000000000000000000000000000000000000000000B79D23434900002A6D63F044B54C8970F9D713D44FBFB122080960";

#[test]
fn decode_finds_real_movement_location_and_control_yaw() {
    let decoder = UnrealMovementPacketDecoder::new();
    let candidates = decoder.decode(&hex(MOVING_PAYLOAD));

    let matches: Vec<_> = candidates
        .iter()
        .filter(|c| (c.ue_x - 153_610.82).abs() < 0.01 && (c.ue_y - 283_609.52).abs() < 0.01)
        .collect();
    assert_eq!(matches.len(), 1, "exactly one candidate at the real location");

    let m = matches[0];
    assert!((m.ue_z - 20_389.74).abs() < 0.01, "z = {}", m.ue_z);
    assert!((m.unreal_yaw_deg - 172.71).abs() < 0.01, "yaw = {}", m.unreal_yaw_deg);
    assert!((m.map_heading_deg() - 262.71).abs() < 0.01, "map heading = {}", m.map_heading_deg());
    assert_eq!(m.location_bit_offset, 380);
    assert_eq!(m.component_bit_count, 26);
}

#[test]
fn decode_rejects_overlapping_stable_false_vector() {
    let decoder = UnrealMovementPacketDecoder::new();
    let candidates = decoder.decode(&hex(STATIONARY_PAYLOAD));

    assert!(
        candidates.iter().any(|c| (c.ue_x - 442_020.33).abs() < 0.01
            && (c.ue_y + 162_148.37).abs() < 0.01
            && (c.ue_z - 26_009.46).abs() < 0.01),
        "keeps the real stationary vector",
    );
    assert!(
        !candidates
            .iter()
            .any(|c| (c.ue_x - 180_719.49).abs() < 0.01 && (c.ue_y - 89_980.69).abs() < 0.01),
        "drops the overlapping false vector",
    );
}

#[test]
fn decode_reads_yaw_while_player_is_stationary() {
    let decoder = UnrealMovementPacketDecoder::new();
    let matches: Vec<_> = decoder
        .decode(&hex(STATIONARY_PAYLOAD))
        .into_iter()
        .filter(|c| (c.ue_x - 442_020.33).abs() < 0.01)
        .collect();
    assert_eq!(matches.len(), 1);
    assert!((matches[0].unreal_yaw_deg - 60.62).abs() < 0.01, "yaw = {}", matches[0].unreal_yaw_deg);
    assert!((matches[0].map_heading_deg() - 150.62).abs() < 0.01);
}

#[test]
fn decode_ignores_short_and_empty_payloads() {
    let decoder = UnrealMovementPacketDecoder::new();
    assert!(decoder.decode(&[]).is_empty());
    assert!(decoder.decode(&[0u8; 4]).is_empty());
}
