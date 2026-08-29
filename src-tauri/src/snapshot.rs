//! B5 — map snapshot to the Windows clipboard.
//!
//! The in-game minimap webview has no focus, so `navigator.clipboard.write`
//! throws there. Instead the webview reads its own canvas pixels
//! (`getImageData`) on the map-snapshot hotkey and hands the raw RGBA frame to
//! this module, which packs it as a top-down 32-bpp `CF_DIBV5` (alpha kept, so
//! the transparent ring around the disc pastes as transparency) and puts it on
//! the clipboard. Windows synthesises `CF_DIB` / `CF_BITMAP` from it, so Discord
//! / Paint / Office all accept the paste.
//!
//! This is OUR canvas — nothing is read from or written to the game process.

use windows::Win32::Foundation::{GlobalFree, HANDLE};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

const CF_DIBV5: u32 = 17;
const BI_BITFIELDS: u32 = 3;
/// 'sRGB' — `LCS_sRGB`, so consumers colour-manage the paste correctly.
const LCS_SRGB: u32 = 0x7352_4742;
/// A frame larger than this is a malformed IPC payload, not a HUD.
const MAX_PIXELS: usize = 16_000_000; // e.g. 4000 × 4000

/// Byte-for-byte `BITMAPV5HEADER` (124 bytes). Hand-rolled rather than pulled
/// from `windows` so the field types don't drift with the crate version.
#[repr(C)]
struct BitmapV5Header {
    size: u32,
    width: i32,
    height: i32,
    planes: u16,
    bit_count: u16,
    compression: u32,
    size_image: u32,
    x_pels_per_meter: i32,
    y_pels_per_meter: i32,
    clr_used: u32,
    clr_important: u32,
    red_mask: u32,
    green_mask: u32,
    blue_mask: u32,
    alpha_mask: u32,
    cs_type: u32,
    endpoints: [u8; 36], // CIEXYZTRIPLE
    gamma_red: u32,
    gamma_green: u32,
    gamma_blue: u32,
    intent: u32,
    profile_data: u32,
    profile_size: u32,
    reserved: u32,
}

/// `[BITMAPV5HEADER ++ BGRA pixels]`, top-down (negative height). Pure byte
/// packing — no Win32 — so it can be unit-tested.
fn build_dibv5(width: i32, height: i32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    if width <= 0 || height <= 0 {
        return Err(format!("bad size {width}×{height}"));
    }
    let px = width as usize * height as usize;
    if px > MAX_PIXELS {
        return Err(format!("frame too large ({px} px)"));
    }
    if rgba.len() != px * 4 {
        return Err(format!("expected {} bytes, got {}", px * 4, rgba.len()));
    }

    // SAFETY: BitmapV5Header is repr(C) plain-old-data — an all-zero bit
    // pattern is valid for every field; we then set the ones that matter.
    let mut header: BitmapV5Header = unsafe { std::mem::zeroed() };
    header.size = 124;
    header.width = width;
    header.height = -height; // negative => rows top-to-bottom, matching a canvas
    header.planes = 1;
    header.bit_count = 32;
    header.compression = BI_BITFIELDS;
    header.size_image = (px * 4) as u32;
    header.x_pels_per_meter = 2835; // 72 dpi
    header.y_pels_per_meter = 2835;
    // Little-endian 0xAARRGGBB => bytes land as B,G,R,A.
    header.red_mask = 0x00FF_0000;
    header.green_mask = 0x0000_FF00;
    header.blue_mask = 0x0000_00FF;
    header.alpha_mask = 0xFF00_0000;
    header.cs_type = LCS_SRGB;

    let mut out = Vec::with_capacity(124 + rgba.len());
    // SAFETY: BitmapV5Header is repr(C), all-POD, exactly 124 bytes.
    out.extend_from_slice(unsafe {
        std::slice::from_raw_parts((&header as *const BitmapV5Header).cast::<u8>(), 124)
    });
    // len was checked to be exactly px·4, so the remainder is empty.
    let (pixels, _) = rgba.as_chunks::<4>();
    for px in pixels {
        out.extend_from_slice(&[px[2], px[1], px[0], px[3]]); // RGBA -> BGRA
    }
    Ok(out)
}

/// Pack `rgba` (width·height·4, row-major, top-down) and put it on the
/// clipboard as `CF_DIBV5`. `Err` on a busy clipboard or a bad frame — the
/// caller shows a brief toast either way.
pub fn copy_rgba_to_clipboard(width: i32, height: i32, rgba: &[u8]) -> Result<(), String> {
    let buf = build_dibv5(width, height, rgba)?;
    unsafe { write_clipboard(CF_DIBV5, &buf) }
}

unsafe fn write_clipboard(format: u32, bytes: &[u8]) -> Result<(), String> {
    let hglobal = GlobalAlloc(GMEM_MOVEABLE, bytes.len()).map_err(|e| format!("GlobalAlloc: {e}"))?;
    let ptr = GlobalLock(hglobal);
    if ptr.is_null() {
        let _ = GlobalFree(Some(hglobal));
        return Err("GlobalLock failed".into());
    }
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr.cast::<u8>(), bytes.len());
    let _ = GlobalUnlock(hglobal);

    if OpenClipboard(None).is_err() {
        let _ = GlobalFree(Some(hglobal));
        return Err("clipboard busy".into());
    }
    let res = (|| {
        EmptyClipboard().map_err(|e| format!("EmptyClipboard: {e}"))?;
        // On success the SYSTEM owns hglobal — must not free it afterwards.
        SetClipboardData(format, Some(HANDLE(hglobal.0)))
            .map_err(|e| format!("SetClipboardData: {e}"))?;
        Ok::<(), String>(())
    })();
    let _ = CloseClipboard();
    if res.is_err() {
        let _ = GlobalFree(Some(hglobal));
    }
    res
}

#[cfg(test)]
mod tests {
    use super::build_dibv5;

    #[test]
    fn packs_header_and_swaps_channels() {
        // 2×1: red pixel, then semi-transparent green.
        let rgba = [255, 0, 0, 255, 0, 255, 0, 128];
        let buf = build_dibv5(2, 1, &rgba).unwrap();
        assert_eq!(buf.len(), 124 + 8);
        assert_eq!(&buf[0..4], &124u32.to_le_bytes()); // bV5Size
        assert_eq!(&buf[4..8], &2i32.to_le_bytes()); // width
        assert_eq!(&buf[8..12], &(-1i32).to_le_bytes()); // top-down height
        // pixels: BGRA
        assert_eq!(&buf[124..128], &[0, 0, 255, 255]);
        assert_eq!(&buf[128..132], &[0, 255, 0, 128]);
    }

    #[test]
    fn rejects_bad_frames() {
        assert!(build_dibv5(0, 4, &[]).is_err());
        assert!(build_dibv5(2, 2, &[0; 8]).is_err()); // want 16 bytes
        assert!(build_dibv5(100_000, 100_000, &[]).is_err()); // pixel cap
    }
}
