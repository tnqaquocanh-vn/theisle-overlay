//! Minimal runtime binding to Npcap's `wpcap.dll` (the WinPcap-compatible
//! API). Loaded with `libloading` so the app builds with no packet-capture
//! SDK and starts fine when Npcap is absent — the feature is opt-in and
//! offers to install it (see `npcap.rs`).
//!
//! Only the handful of `pcap_*` entry points the capture loop needs are
//! bound. Everything here is read-only sniffing; nothing writes to a device.

use std::ffi::{c_char, c_int, c_long, c_void, CStr, CString};
use std::path::PathBuf;
use std::sync::Arc;

use libloading::Library;

const PCAP_ERRBUF_SIZE: usize = 256;
/// `pcap_if_t` flag bits (libpcap). We skip loopback and links the OS reports
/// as physically disconnected — opening those just burns a thread and a
/// handle, and on a box with a dozen virtual adapters it made switching ports
/// stutter for seconds.
const PCAP_IF_LOOPBACK: u32 = 0x0000_0001;
const PCAP_IF_CONNECTION_STATUS: u32 = 0x0000_0030;
const PCAP_IF_CONNECTION_STATUS_DISCONNECTED: u32 = 0x0000_0020;
/// `LOAD_WITH_ALTERED_SEARCH_PATH` — resolve `Packet.dll` from beside the
/// full path we hand `LoadLibraryEx`, not the app directory.
const LOAD_WITH_ALTERED_SEARCH_PATH: u32 = 0x0000_0008;

#[repr(C)]
struct PcapIf {
    next: *mut PcapIf,
    name: *const c_char,
    description: *const c_char,
    addresses: *mut c_void,
    flags: u32,
}

#[repr(C)]
pub struct PcapPktHdr {
    pub tv_sec: c_long,
    pub tv_usec: c_long,
    pub caplen: u32,
    pub len: u32,
}

#[repr(C)]
struct BpfProgram {
    bf_len: u32,
    bf_insns: *mut c_void,
}

type FnFindAllDevs = unsafe extern "C" fn(*mut *mut PcapIf, *mut c_char) -> c_int;
type FnFreeAllDevs = unsafe extern "C" fn(*mut PcapIf);
type FnOpenLive =
    unsafe extern "C" fn(*const c_char, c_int, c_int, c_int, *mut c_char) -> *mut c_void;
type FnClose = unsafe extern "C" fn(*mut c_void);
type FnCompile =
    unsafe extern "C" fn(*mut c_void, *mut BpfProgram, *const c_char, c_int, u32) -> c_int;
type FnSetFilter = unsafe extern "C" fn(*mut c_void, *mut BpfProgram) -> c_int;
type FnFreeCode = unsafe extern "C" fn(*mut BpfProgram);
type FnNextEx = unsafe extern "C" fn(*mut c_void, *mut *mut PcapPktHdr, *mut *const u8) -> c_int;
type FnDatalink = unsafe extern "C" fn(*mut c_void) -> c_int;

pub struct Wpcap {
    _lib: Library,
    findalldevs: FnFindAllDevs,
    freealldevs: FnFreeAllDevs,
    open_live: FnOpenLive,
    close: FnClose,
    compile: FnCompile,
    setfilter: FnSetFilter,
    freecode: FnFreeCode,
    next_ex: FnNextEx,
    datalink: FnDatalink,
}

fn candidate_paths() -> Vec<PathBuf> {
    let mut out = vec![PathBuf::from("wpcap.dll")];
    if let Ok(root) = std::env::var("SystemRoot") {
        out.push(PathBuf::from(&root).join("System32").join("Npcap").join("wpcap.dll"));
        out.push(PathBuf::from(&root).join("SysWOW64").join("Npcap").join("wpcap.dll"));
    }
    out
}

impl Wpcap {
    /// Load `wpcap.dll`, trying the default search path then Npcap's install
    /// directory. `Err` means Npcap is not installed / not usable.
    pub fn load() -> Result<Arc<Self>, String> {
        let mut last_err = String::from("wpcap.dll not found");
        for path in candidate_paths() {
            let lib = unsafe {
                libloading::os::windows::Library::load_with_flags(
                    &path,
                    LOAD_WITH_ALTERED_SEARCH_PATH,
                )
            };
            match lib {
                Ok(lib) => {
                    let lib: Library = lib.into();
                    match unsafe { Self::bind(lib) } {
                        Ok(w) => return Ok(Arc::new(w)),
                        Err(e) => last_err = e,
                    }
                }
                Err(e) => last_err = e.to_string(),
            }
        }
        Err(last_err)
    }

    unsafe fn bind(lib: Library) -> Result<Self, String> {
        macro_rules! sym {
            ($name:literal) => {{
                let s: libloading::Symbol<_> =
                    lib.get($name).map_err(|e| format!("{}: {e}", stringify!($name)))?;
                *s
            }};
        }
        Ok(Self {
            findalldevs: sym!(b"pcap_findalldevs"),
            freealldevs: sym!(b"pcap_freealldevs"),
            open_live: sym!(b"pcap_open_live"),
            close: sym!(b"pcap_close"),
            compile: sym!(b"pcap_compile"),
            setfilter: sym!(b"pcap_setfilter"),
            freecode: sym!(b"pcap_freecode"),
            next_ex: sym!(b"pcap_next_ex"),
            datalink: sym!(b"pcap_datalink"),
            _lib: lib,
        })
    }

    /// Names of the capture devices worth opening — every adapter that is not
    /// loopback, not reported disconnected, and has at least one bound address
    /// (the game's traffic could be on any of the rest). Falls back to the
    /// full list if that leaves nothing, so an unusual setup never loses
    /// capture. Also the cheap "capture actually works" probe.
    pub fn device_names(&self) -> Result<Vec<CString>, String> {
        let mut alldevs: *mut PcapIf = std::ptr::null_mut();
        let mut errbuf = [0i8; PCAP_ERRBUF_SIZE];
        let rc = unsafe {
            (self.findalldevs)(&mut alldevs, errbuf.as_mut_ptr() as *mut c_char)
        };
        if rc != 0 {
            return Err(errbuf_to_string(&errbuf));
        }
        let mut all = Vec::new();
        let mut usable = Vec::new();
        let mut cur = alldevs;
        while !cur.is_null() {
            let dev = unsafe { &*cur };
            if !dev.name.is_null() {
                let name = unsafe { CStr::from_ptr(dev.name) }.to_owned();
                let loopback = dev.flags & PCAP_IF_LOOPBACK != 0;
                let disconnected = dev.flags & PCAP_IF_CONNECTION_STATUS
                    == PCAP_IF_CONNECTION_STATUS_DISCONNECTED;
                if !loopback && !disconnected && !dev.addresses.is_null() {
                    usable.push(name.clone());
                }
                all.push(name);
            }
            cur = dev.next;
        }
        unsafe { (self.freealldevs)(alldevs) };
        Ok(if usable.is_empty() { all } else { usable })
    }

    /// Open one device for live capture, non-promiscuous, `to_ms` read
    /// timeout so the loop can poll for shutdown. Takes `Arc<Self>` so the
    /// returned `Capture` can live on its own capture thread.
    pub fn open(self: &Arc<Self>, device: &CStr, snaplen: i32, to_ms: i32) -> Result<Capture, String> {
        let mut errbuf = [0i8; PCAP_ERRBUF_SIZE];
        let handle = unsafe {
            (self.open_live)(
                device.as_ptr(),
                snaplen,
                0, // promiscuous off: our own machine's traffic is enough
                to_ms,
                errbuf.as_mut_ptr() as *mut c_char,
            )
        };
        if handle.is_null() {
            return Err(errbuf_to_string(&errbuf));
        }
        Ok(Capture {
            wpcap: Arc::clone(self),
            handle,
        })
    }
}

fn errbuf_to_string(buf: &[i8]) -> String {
    let bytes: Vec<u8> = buf
        .iter()
        .take_while(|&&c| c != 0)
        .map(|&c| c as u8)
        .collect();
    String::from_utf8_lossy(&bytes).into_owned()
}

/// One open capture handle. Closes on drop. Not `Send` — build and drive it
/// on a single thread (each capture thread opens its own).
pub struct Capture {
    wpcap: Arc<Wpcap>,
    handle: *mut c_void,
}

pub enum Packet<'a> {
    /// Link-layer frame captured this tick (valid until the next `next` call).
    Frame(&'a [u8]),
    /// Read timeout — no packet, loop again.
    Timeout,
}

impl Capture {
    /// libpcap link type. 1 = `DLT_EN10MB` (Ethernet), 12 = `DLT_RAW`.
    pub fn datalink(&self) -> i32 {
        unsafe { (self.wpcap.datalink)(self.handle) }
    }

    /// Compile + install a BPF filter string (e.g. `udp and src port 7777`).
    pub fn set_filter(&mut self, filter: &str) -> Result<(), String> {
        let program = BpfProgram {
            bf_len: 0,
            bf_insns: std::ptr::null_mut(),
        };
        let mut program = program;
        let c_filter = CString::new(filter).map_err(|_| "filter has NUL".to_string())?;
        let rc = unsafe {
            (self.wpcap.compile)(
                self.handle,
                &mut program,
                c_filter.as_ptr(),
                1,          // optimize
                0xffff_ffff, // netmask unknown
            )
        };
        if rc != 0 {
            return Err(format!("pcap_compile failed for `{filter}`"));
        }
        let rc = unsafe { (self.wpcap.setfilter)(self.handle, &mut program) };
        unsafe { (self.wpcap.freecode)(&mut program) };
        if rc != 0 {
            return Err("pcap_setfilter failed".into());
        }
        Ok(())
    }

    /// Next frame, or `Timeout`. `Err` is a real capture error (device gone).
    pub fn next(&mut self) -> Result<Packet<'_>, String> {
        let mut header: *mut PcapPktHdr = std::ptr::null_mut();
        let mut data: *const u8 = std::ptr::null();
        let rc = unsafe { (self.wpcap.next_ex)(self.handle, &mut header, &mut data) };
        match rc {
            1 => {
                if header.is_null() || data.is_null() {
                    return Ok(Packet::Timeout);
                }
                let caplen = unsafe { (*header).caplen } as usize;
                let slice = unsafe { std::slice::from_raw_parts(data, caplen) };
                Ok(Packet::Frame(slice))
            }
            0 => Ok(Packet::Timeout),
            _ => Err(format!("pcap_next_ex returned {rc}")),
        }
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        unsafe { (self.wpcap.close)(self.handle) };
    }
}
