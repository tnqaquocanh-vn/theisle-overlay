//! Which local UDP ports a process owns. Port of IsleLiveMap's
//! `WindowsUdpPortOwnerResolver` (MIT).
//!
//! `GetExtendedUdpTable(UDP_TABLE_OWNER_PID)` is a read of the OS socket
//! table — the same information `netstat -ano` prints. No handle is opened
//! into the game process. The capture filter is built from these ports so
//! only The Isle's own client→server traffic is ever looked at.

use std::collections::HashSet;

use windows::Win32::NetworkManagement::IpHelper::{GetExtendedUdpTable, UDP_TABLE_OWNER_PID};
use windows::Win32::Networking::WinSock::AF_INET;

const ERROR_INSUFFICIENT_BUFFER: u32 = 122;
/// `MIB_UDPROW_OWNER_PID`: dwLocalAddr, dwLocalPort, dwOwningPid — three u32.
const ROW_SIZE: usize = 12;

/// UDP ports (host order) currently bound by `pid`. Empty on any failure or
/// when the process owns none — the caller treats "no ports" as "not ready".
pub fn owned_udp_ports(pid: u32) -> HashSet<u16> {
    let mut ports = HashSet::new();

    let mut size: u32 = 0;
    // First call: ask for the required buffer size.
    let rc = unsafe {
        GetExtendedUdpTable(
            None,
            &mut size,
            false,
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };
    if rc != ERROR_INSUFFICIENT_BUFFER || (size as usize) <= 4 {
        return ports;
    }

    let mut buffer = vec![0u8; size as usize];
    let rc = unsafe {
        GetExtendedUdpTable(
            Some(buffer.as_mut_ptr() as *mut _),
            &mut size,
            false,
            AF_INET.0 as u32,
            UDP_TABLE_OWNER_PID,
            0,
        )
    };
    if rc != 0 {
        return ports;
    }

    // Layout: u32 dwNumEntries, then dwNumEntries * MIB_UDPROW_OWNER_PID.
    let count = u32::from_ne_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;
    for index in 0..count {
        let base = 4 + index * ROW_SIZE;
        if base + ROW_SIZE > buffer.len() {
            break;
        }
        let local_port = u32::from_ne_bytes([
            buffer[base + 4],
            buffer[base + 5],
            buffer[base + 6],
            buffer[base + 7],
        ]);
        let owning_pid = u32::from_ne_bytes([
            buffer[base + 8],
            buffer[base + 9],
            buffer[base + 10],
            buffer[base + 11],
        ]);
        if owning_pid != pid {
            continue;
        }
        // The low 16 bits hold the port in network byte order.
        let port = u16::from_be((local_port & 0xffff) as u16);
        if port != 0 {
            ports.insert(port);
        }
    }

    ports
}
