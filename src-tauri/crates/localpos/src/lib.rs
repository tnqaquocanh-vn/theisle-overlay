//! localpos — decode The Isle client's movement packets and lock onto the
//! real position stream.
//!
//! This is a faithful Rust port of IsleLiveMap's `TheIsleOverlay.LocalTelemetry`
//! (MIT, klong-dev/IsleLiveMap 1.3.1). It is deliberately free of I/O, OS calls
//! and packet capture — exactly like `overlay-core`. The capture loop
//! (Npcap/`pcap`), the game-process UDP-port lookup and the Npcap installer all
//! live in the tauri crate under `src/localpos/`.
//!
//! Pipeline:
//!
//! ```text
//!   UDP payload  --decoder-->  [MovementCandidate ...]  --tracker-->  locked Sample
//! ```
//!
//! The decoder brute-forces every plausible bit offset in a
//! `FCharacterNetworkMoveData` payload and returns each location vector plus
//! compressed control-yaw it finds; the tracker keeps a short bootstrap window
//! and only emits a position once one layout has been continuous for several
//! packets in a row, so noise and re-sent saved moves never move the marker.
//!
//! AXIS NOTE: the decoder returns RAW Unreal `FVector` components. On Gateway
//! the Unreal X axis is longitude (east/west) and Unreal Y is latitude
//! (north/south) — the same swap the IslePilot markers API needs. The caller
//! maps `game_lat = ue_y`, `game_long = ue_x` when handing a sample to the
//! overlay pipeline.

mod decoder;
mod heading;
mod tracker;

pub use decoder::{MovementCandidate, UnrealMovementPacketDecoder};
pub use heading::{map_heading_from_unreal_yaw, movement_heading, smooth_heading};
pub use tracker::LocalMovementTracker;
