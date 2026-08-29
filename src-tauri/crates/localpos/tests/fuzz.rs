//! Robustness guard for the bit-level decoder. `decode` slides a window over
//! every bit offset of an attacker-controlled buffer (anything on the wire can
//! reach it), doing `payload[bit >> 3]` reads at offsets computed from the
//! bytes themselves. These tests only assert it never panics / never reads out
//! of bounds and never emits an out-of-range candidate — correctness of the
//! happy path is covered by `decoder.rs`.
//!
//! Self-contained xorshift RNG so this stays a hermetic, deterministic part of
//! the normal `cargo test` gate (no dev-dependency, no registry fetch).

use localpos::UnrealMovementPacketDecoder;

struct XorShift64(u64);

impl XorShift64 {
    fn new(seed: u64) -> Self {
        // Avoid the all-zero state, which xorshift cannot leave.
        Self(seed | 1)
    }
    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    fn byte(&mut self) -> u8 {
        (self.next_u64() & 0xff) as u8
    }
    fn range(&mut self, lo: usize, hi: usize) -> usize {
        lo + (self.next_u64() as usize) % (hi - lo)
    }
}

/// Every candidate the decoder returns must be inside the plausibility box it
/// claims to enforce — a regression here means a bounds/validation check was
/// weakened.
fn assert_candidates_sane(bytes: &[u8], cands: &[localpos::MovementCandidate]) {
    for c in cands {
        assert!(
            c.ue_x.is_finite() && c.ue_y.is_finite() && c.ue_z.is_finite(),
            "non-finite location from {} bytes: {c:?}",
            bytes.len()
        );
        assert!(
            (-800_000.0..=800_000.0).contains(&c.ue_x)
                && (-800_000.0..=800_000.0).contains(&c.ue_y)
                && (-300_000.0..=300_000.0).contains(&c.ue_z),
            "out-of-box location from {} bytes: {c:?}",
            bytes.len()
        );
        assert!(
            c.unreal_yaw_deg.is_finite() && (0.0..360.0).contains(&c.unreal_yaw_deg),
            "yaw out of range: {c:?}"
        );
        assert!(
            c.client_timestamp.is_finite() && c.client_timestamp >= 0.0,
            "bad timestamp: {c:?}"
        );
        assert!(
            c.location_bit_offset < bytes.len() * 8,
            "offset past end: {c:?}"
        );
    }
}

#[test]
fn decode_survives_arbitrary_bytes() {
    let decoder = UnrealMovementPacketDecoder::new();
    let mut rng = XorShift64::new(0x9E37_79B9_7F4A_7C15);
    for _ in 0..12_000 {
        let len = rng.range(0, 256);
        let bytes: Vec<u8> = (0..len).map(|_| rng.byte()).collect();
        let cands = decoder.decode(&bytes);
        assert_candidates_sane(&bytes, &cands);
    }
}

#[test]
fn decode_survives_sparse_and_dense_bit_patterns() {
    let decoder = UnrealMovementPacketDecoder::new();
    let mut rng = XorShift64::new(0x2545_F491_4F6C_DD1D);
    for _ in 0..8_000 {
        let len = rng.range(8, 220);
        // Mostly-zero or mostly-one buffers with a few flipped bits exercise
        // the offset search far harder than uniform noise.
        let fill = if rng.next_u64() & 1 == 0 { 0x00 } else { 0xff };
        let mut bytes = vec![fill; len];
        for _ in 0..rng.range(1, 40) {
            let bit = rng.range(0, len * 8);
            bytes[bit >> 3] ^= 1 << (bit & 7);
        }
        let cands = decoder.decode(&bytes);
        assert_candidates_sane(&bytes, &cands);
    }
}

#[test]
fn decode_survives_bitflips_of_a_real_payload() {
    // A captured real client move (same hex as decoder.rs); flip 1..6 bits and
    // shift by whole bytes so the bit reader meets every alignment near a
    // structure it would otherwise accept.
    const MOVING: &str = "0000000000000000000000000000000000000000000000000000000000000000000000000022DA49434FFDA3CA0100A0D52153071F18365F8E0F5EE28FD60330";
    let base: Vec<u8> = (0..MOVING.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&MOVING[i..i + 2], 16).unwrap())
        .collect();

    let decoder = UnrealMovementPacketDecoder::new();
    let mut rng = XorShift64::new(0xD1B5_4A32_D192_ED03);
    for _ in 0..8_000 {
        let shift = rng.range(0, 5);
        let mut bytes = vec![0u8; shift];
        bytes.extend_from_slice(&base);
        for _ in 0..rng.range(1, 7) {
            let bit = rng.range(0, bytes.len() * 8);
            bytes[bit >> 3] ^= 1 << (bit & 7);
        }
        let cands = decoder.decode(&bytes);
        assert_candidates_sane(&bytes, &cands);
    }
}
