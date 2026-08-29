//! Decoder for UE 5.5 `FCharacterNetworkMoveData` client→server payloads:
//! the `FVector_NetQuantize100` location and the compressed control yaw.
//!
//! Faithful port of IsleLiveMap's `UnrealMovementPacketDecoder` (MIT). The
//! wire format has no framing we can rely on, so `decode` slides a window
//! across every bit offset and keeps the offsets whose three quantised
//! components, backward-looking acceleration+timestamp prefix and forward
//! compressed rotation all validate. Several candidates per packet is normal;
//! the [`crate::LocalMovementTracker`] picks the real one over time.

/// `FVector_NetQuantize` serialises a 7-bit header before the components.
const QUANTIZED_VECTOR_HEADER_BITS: u32 = 7;
const FLOAT_BITS: u32 = 32;
/// Even at Gateway's origin, terrain altitude keeps the absolute location
/// wider than tiny gameplay values. Starting at 18 bits avoids reading flags
/// and zero padding as world positions.
const MIN_LOCATION_COMPONENT_BITS: u32 = 18;
const MIN_COMPONENT_BITS: u32 = 1;
const MAX_COMPONENT_BITS: u32 = 31;

/// Gateway's playable texture covers roughly X -505k..607k and Y -607k..509k.
/// The margin tolerates map revisions and world rebasing.
const MIN_WORLD_X: f64 = -800_000.0;
const MAX_WORLD_X: f64 = 800_000.0;
const MIN_WORLD_Y: f64 = -800_000.0;
const MAX_WORLD_Y: f64 = 800_000.0;
const MIN_WORLD_Z: f64 = -300_000.0;
const MAX_WORLD_Z: f64 = 300_000.0;
const MAX_ACCELERATION: f64 = 100_000.0;
const MAX_CLIENT_TIMESTAMP: f32 = 10_000_000.0;

/// One decoded location + control yaw, plus the bit layout it was found at
/// (the tracker keys its bootstrap hypotheses on the layout).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MovementCandidate {
    /// RAW Unreal `FVector` components in world units (cm). On Gateway,
    /// `ue_x` is longitude and `ue_y` is latitude — the caller swaps.
    pub ue_x: f64,
    pub ue_y: f64,
    pub ue_z: f64,
    /// Control rotation yaw, degrees, straight off the wire (0..360).
    pub unreal_yaw_deg: f64,
    /// UE client move timestamp — monotonic per connection, used to reject
    /// re-sent saved moves.
    pub client_timestamp: f32,
    pub payload_len: usize,
    pub location_bit_offset: usize,
    pub component_bit_count: u32,
}

impl MovementCandidate {
    /// Gateway map heading: the marker's neutral pose is +90° off Unreal yaw.
    pub fn map_heading_deg(&self) -> f64 {
        crate::heading::map_heading_from_unreal_yaw(self.unreal_yaw_deg)
    }

    /// Bootstrap-hypothesis key: same packet size, same offset, same width.
    pub(crate) fn layout(&self) -> (usize, usize, u32) {
        (self.payload_len, self.location_bit_offset, self.component_bit_count)
    }
}

#[derive(Default)]
pub struct UnrealMovementPacketDecoder;

impl UnrealMovementPacketDecoder {
    pub fn new() -> Self {
        Self
    }

    pub fn decode(&self, payload: &[u8]) -> Vec<MovementCandidate> {
        if payload.is_empty() {
            return Vec::new();
        }

        let payload_bits = payload.len() * 8;
        let minimum_move_bits =
            (QUANTIZED_VECTOR_HEADER_BITS + MIN_LOCATION_COMPONENT_BITS * 3 + 3) as usize;
        if payload_bits < minimum_move_bits {
            return Vec::new();
        }

        let mut candidates = Vec::new();
        for location_offset in 0..=(payload_bits - minimum_move_bits) {
            let header = read_bits(payload, location_offset, QUANTIZED_VECTOR_HEADER_BITS) as u32;
            let component_bits = header & 63;
            let uses_scale = header & 64 != 0;
            if !uses_scale
                || !(MIN_LOCATION_COMPONENT_BITS..=MAX_COMPONENT_BITS).contains(&component_bits)
                || location_offset
                    + (QUANTIZED_VECTOR_HEADER_BITS + component_bits * 3 + 3) as usize
                    > payload_bits
            {
                continue;
            }

            let base = location_offset + QUANTIZED_VECTOR_HEADER_BITS as usize;
            let cb = component_bits as usize;
            let raw_x = read_signed(payload, base, component_bits);
            let raw_y = read_signed(payload, base + cb, component_bits);
            let raw_z = read_signed(payload, base + cb * 2, component_bits);
            if !uses_canonical_bit_count(raw_x, raw_y, raw_z, component_bits) {
                continue;
            }

            let x = raw_x as f64 / 100.0;
            let y = raw_y as f64 / 100.0;
            let z = raw_z as f64 / 100.0;
            if !is_plausible_world_location(x, y, z) {
                continue;
            }

            let Some(client_timestamp) = try_read_move_prefix(payload, location_offset) else {
                continue;
            };

            let rotation_offset = location_offset
                + (QUANTIZED_VECTOR_HEADER_BITS + component_bits * 3) as usize;
            let Some(yaw) = try_read_yaw(payload, rotation_offset) else {
                continue;
            };

            candidates.push(MovementCandidate {
                ue_x: x,
                ue_y: y,
                ue_z: z,
                unreal_yaw_deg: yaw,
                client_timestamp,
                payload_len: payload.len(),
                location_bit_offset: location_offset,
                component_bit_count: component_bits,
            });
        }

        candidates
    }
}

/// Walk backward from the location for the acceleration vector, then the
/// 32-bit client move timestamp that precedes it. Returns the timestamp.
fn try_read_move_prefix(payload: &[u8], location_offset: usize) -> Option<f32> {
    for acceleration_bits in MIN_COMPONENT_BITS..=MAX_COMPONENT_BITS {
        let acceleration_offset = location_offset as i64
            - QUANTIZED_VECTOR_HEADER_BITS as i64
            - acceleration_bits as i64 * 3;
        let timestamp_offset = acceleration_offset - FLOAT_BITS as i64;
        if timestamp_offset < 0 {
            continue;
        }
        let acceleration_offset = acceleration_offset as usize;
        let timestamp_offset = timestamp_offset as usize;

        let header = read_bits(payload, acceleration_offset, QUANTIZED_VECTOR_HEADER_BITS) as u32;
        if header & 63 != acceleration_bits {
            continue;
        }

        let base = acceleration_offset + QUANTIZED_VECTOR_HEADER_BITS as usize;
        let ab = acceleration_bits as usize;
        let raw_x = read_signed(payload, base, acceleration_bits);
        let raw_y = read_signed(payload, base + ab, acceleration_bits);
        let raw_z = read_signed(payload, base + ab * 2, acceleration_bits);
        if !uses_canonical_bit_count(raw_x, raw_y, raw_z, acceleration_bits) {
            continue;
        }

        let scale = if header & 64 != 0 { 10.0 } else { 1.0 };
        if (raw_x as f64 / scale).abs() > MAX_ACCELERATION
            || (raw_y as f64 / scale).abs() > MAX_ACCELERATION
            || (raw_z as f64 / scale).abs() > MAX_ACCELERATION
        {
            continue;
        }

        let timestamp_bits = read_bits(payload, timestamp_offset, FLOAT_BITS) as u32;
        let timestamp = f32::from_bits(timestamp_bits);
        if !timestamp.is_finite() || timestamp < 0.0 || timestamp > MAX_CLIENT_TIMESTAMP {
            continue;
        }

        return Some(timestamp);
    }

    None
}

/// The control rotation is three optional 16-bit axes (pitch, yaw, roll),
/// each prefixed by a "present" bit. Only yaw is needed.
fn try_read_yaw(payload: &[u8], mut bit_offset: usize) -> Option<f64> {
    read_compressed_axis(payload, &mut bit_offset)?; // pitch
    let yaw = read_compressed_axis(payload, &mut bit_offset)?;
    read_compressed_axis(payload, &mut bit_offset)?; // roll
    Some(yaw)
}

fn read_compressed_axis(payload: &[u8], bit_offset: &mut usize) -> Option<f64> {
    let payload_bits = payload.len() * 8;
    if *bit_offset >= payload_bits {
        return None;
    }
    let present = read_bits(payload, *bit_offset, 1) != 0;
    *bit_offset += 1;
    if !present {
        return Some(0.0);
    }
    if *bit_offset + 16 > payload_bits {
        return None;
    }
    let compressed = read_bits(payload, *bit_offset, 16);
    *bit_offset += 16;
    Some(compressed as f64 * 360.0 / 65_536.0)
}

fn is_plausible_world_location(x: f64, y: f64, z: f64) -> bool {
    (MIN_WORLD_X..=MAX_WORLD_X).contains(&x)
        && (MIN_WORLD_Y..=MAX_WORLD_Y).contains(&y)
        && (MIN_WORLD_Z..=MAX_WORLD_Z).contains(&z)
}

fn uses_canonical_bit_count(x: i64, y: i64, z: i64, component_bits: u32) -> bool {
    bits_needed(x).max(bits_needed(y)).max(bits_needed(z)) == component_bits
}

/// Signed-magnitude bit width, sign bit included (`0` -> 1, `1` -> 2, `3` -> 3).
fn bits_needed(value: i64) -> u32 {
    let massaged = (value ^ (value >> 63)) as u64;
    65 - massaged.leading_zeros()
}

/// Read `bit_count` bits LSB-first within each byte, as UE's bit writer packs
/// them. Caller guarantees `bit_offset + bit_count <= payload.len() * 8`.
fn read_bits(payload: &[u8], bit_offset: usize, bit_count: u32) -> u64 {
    let mut value: u64 = 0;
    for bit in 0..bit_count as usize {
        let source_bit = bit_offset + bit;
        if payload[source_bit >> 3] & (1 << (source_bit & 7)) != 0 {
            value |= 1u64 << bit;
        }
    }
    value
}

fn read_signed(payload: &[u8], bit_offset: usize, bit_count: u32) -> i64 {
    let value = read_bits(payload, bit_offset, bit_count);
    let sign_bit = 1u64 << (bit_count - 1);
    (value ^ sign_bit).wrapping_sub(sign_bit) as i64
}
