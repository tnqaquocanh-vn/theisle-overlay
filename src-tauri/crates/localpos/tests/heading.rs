//! Port of IsleLiveMap's `MovementHeadingTests` + the `MapHeading` cases from
//! `UnrealMovementPacketDecoderTests`.

use localpos::{map_heading_from_unreal_yaw, movement_heading, smooth_heading};

#[test]
fn map_heading_is_unreal_yaw_plus_ninety() {
    assert!((map_heading_from_unreal_yaw(172.71) - 262.71).abs() < 1e-9);
    assert!((map_heading_from_unreal_yaw(60.62) - 150.62).abs() < 1e-9);
    assert!((map_heading_from_unreal_yaw(300.0) - 30.0).abs() < 1e-9);
    assert!((map_heading_from_unreal_yaw(-10.0) - 80.0).abs() < 1e-9);
}

#[test]
fn movement_heading_maps_world_move_to_clockwise_heading() {
    for (dx, dy, expected) in [
        (0.0, -1000.0, 0.0),
        (1000.0, 0.0, 90.0),
        (0.0, 1000.0, 180.0),
        (-1000.0, 0.0, 270.0),
    ] {
        let h = movement_heading(dx, dy).expect("valid step");
        assert!((h - expected).abs() < 1e-8, "dx={dx} dy={dy} -> {h}, want {expected}");
    }
}

#[test]
fn movement_heading_ignores_stationary_jitter() {
    assert!(movement_heading(20.0, 10.0).is_none());
}

#[test]
fn movement_heading_ignores_teleport_sized_delta() {
    assert!(movement_heading(500_000.0, 500_000.0).is_none());
}

#[test]
fn smooth_heading_takes_the_short_way_across_north() {
    assert!((smooth_heading(350.0, 10.0, 0.5) - 0.0).abs() < 1e-8);
    // Hold vs snap.
    assert!((smooth_heading(100.0, 200.0, 0.0) - 100.0).abs() < 1e-8);
    assert!((smooth_heading(100.0, 200.0, 1.0) - 200.0).abs() < 1e-8);
}
