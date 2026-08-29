//! Heading helpers. Port of IsleLiveMap's `MapHeading` + `MovementHeading` (MIT).

use std::f64::consts::PI;

/// Gateway map heading from a raw Unreal control-rotation yaw: the marker's
/// neutral pose points up, which is +90° from Unreal yaw. Result in `0..360`.
pub fn map_heading_from_unreal_yaw(yaw_degrees: f64) -> f64 {
    normalize_deg(yaw_degrees + 90.0)
}

fn normalize_deg(degrees: f64) -> f64 {
    let n = degrees % 360.0;
    if n < 0.0 {
        n + 360.0
    } else {
        n
    }
}

/// Clockwise map heading from a world-space move vector, or `None` when the
/// step is too small (stationary jitter) or too large (teleport / respawn).
/// `dx`/`dy` are in the SAME axis convention as the points passed in.
pub fn movement_heading(dx: f64, dy: f64) -> Option<f64> {
    movement_heading_bounded(dx, dy, 100.0, 200_000.0)
}

pub fn movement_heading_bounded(
    dx: f64,
    dy: f64,
    minimum_distance: f64,
    maximum_distance: f64,
) -> Option<f64> {
    let distance = (dx * dx + dy * dy).sqrt();
    if distance < minimum_distance || distance > maximum_distance {
        return None;
    }
    // +X maps to screen-right and +Y to screen-down; neutral pose is up, so
    // atan2(dx, -dy) gives clockwise degrees.
    let mut degrees = dx.atan2(-dy) * 180.0 / PI;
    if degrees < 0.0 {
        degrees += 360.0;
    }
    Some(degrees)
}

/// Circular exponential smoothing that always turns the short way around the
/// compass. `weight` is clamped to `0..1` (0 = hold previous, 1 = snap).
pub fn smooth_heading(previous: f64, current: f64, weight: f64) -> f64 {
    let delta = (current - previous + 540.0).rem_euclid(360.0) - 180.0;
    (previous + delta * weight.clamp(0.0, 1.0) + 360.0).rem_euclid(360.0)
}
