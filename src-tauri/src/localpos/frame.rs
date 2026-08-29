//! Strip Ethernet / IPv4 / UDP headers off a captured frame and return the
//! UDP payload. The BPF filter already narrows capture to
//! `udp and src port <game>`, so this only has to locate the payload.

/// libpcap link types we handle.
const DLT_NULL: i32 = 0;
const DLT_EN10MB: i32 = 1;
const DLT_RAW_A: i32 = 12;
const DLT_RAW_B: i32 = 14;

const ETHERTYPE_IPV4: u16 = 0x0800;
const ETHERTYPE_VLAN: u16 = 0x8100;
const IP_PROTO_UDP: u8 = 17;

/// UDP payload bytes from one captured link-layer frame, or `None` if it is
/// not IPv4/UDP or is truncated.
pub fn udp_payload(frame: &[u8], link_type: i32) -> Option<&[u8]> {
    let ip_start = match link_type {
        DLT_EN10MB => {
            if frame.len() < 14 {
                return None;
            }
            let mut ethertype = u16::from_be_bytes([frame[12], frame[13]]);
            let mut off = 14usize;
            if ethertype == ETHERTYPE_VLAN {
                if frame.len() < 18 {
                    return None;
                }
                ethertype = u16::from_be_bytes([frame[16], frame[17]]);
                off = 18;
            }
            if ethertype != ETHERTYPE_IPV4 {
                return None;
            }
            off
        }
        DLT_NULL => 4,              // 4-byte BSD address family
        DLT_RAW_A | DLT_RAW_B => 0, // bare IP
        _ => return None,
    };

    let ip = frame.get(ip_start..)?;
    if ip.len() < 20 || ip[0] >> 4 != 4 {
        return None;
    }
    let ihl = (ip[0] & 0x0f) as usize * 4;
    if ihl < 20 || ip.len() < ihl + 8 || ip[9] != IP_PROTO_UDP {
        return None;
    }

    let udp = &ip[ihl..];
    let udp_len = u16::from_be_bytes([udp[4], udp[5]]) as usize;
    let end = udp_len.clamp(8, udp.len());
    udp.get(8..end)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eth_ipv4_udp(src_port: u16, dst_port: u16, payload: &[u8]) -> Vec<u8> {
        let mut f = Vec::new();
        f.extend_from_slice(&[0xff; 6]); // dst mac
        f.extend_from_slice(&[0x11; 6]); // src mac
        f.extend_from_slice(&ETHERTYPE_IPV4.to_be_bytes());
        let udp_len = 8 + payload.len();
        let total_len = 20 + udp_len;
        let mut ip = vec![0u8; 20];
        ip[0] = 0x45;
        ip[2..4].copy_from_slice(&(total_len as u16).to_be_bytes());
        ip[9] = IP_PROTO_UDP;
        ip[12..16].copy_from_slice(&[10, 0, 0, 2]);
        ip[16..20].copy_from_slice(&[171, 232, 64, 234]);
        f.extend_from_slice(&ip);
        f.extend_from_slice(&src_port.to_be_bytes());
        f.extend_from_slice(&dst_port.to_be_bytes());
        f.extend_from_slice(&(udp_len as u16).to_be_bytes());
        f.extend_from_slice(&[0, 0]); // checksum
        f.extend_from_slice(payload);
        f
    }

    #[test]
    fn extracts_payload_from_ethernet() {
        let frame = eth_ipv4_udp(7777, 51234, &[1, 2, 3, 4, 5]);
        assert_eq!(udp_payload(&frame, DLT_EN10MB), Some(&[1, 2, 3, 4, 5][..]));
    }

    #[test]
    fn rejects_non_ipv4_and_non_udp() {
        let mut frame = eth_ipv4_udp(7777, 51234, &[9; 4]);
        frame[23] = 6; // protocol -> TCP
        assert!(udp_payload(&frame, DLT_EN10MB).is_none());
        assert!(udp_payload(&[0u8; 10], DLT_EN10MB).is_none());
    }

    #[test]
    fn handles_raw_ip_link_type() {
        let full = eth_ipv4_udp(7777, 1234, &[7, 7]);
        let raw = &full[14..]; // drop the ethernet header
        assert_eq!(udp_payload(raw, DLT_RAW_A), Some(&[7, 7][..]));
    }
}
