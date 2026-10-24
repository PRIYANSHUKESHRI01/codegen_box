//go:build windows

package main

import (
	"net"
	"strings"
	"syscall"
	"unsafe"
)

// ── adapters (GetAdaptersAddresses) ───────────────────────────────────────────────────────────────────────────────────

// adapter is the part of IP_ADAPTER_ADDRESSES the Guardian reads. Go's net package hides the adapter DESCRIPTION
// ("TAP-Windows Adapter V9", "WireGuard Tunnel"), which is where VPNs give themselves away; the friendly name is just
// "Ethernet 3".
type adapter struct {
	Description string
	Name        string
	IfType      uint32
	Up          bool
	DNS         []string
}

// Offsets within IP_ADAPTER_ADDRESSES_LH on 64-bit Windows.
const (
	offNext        = 8
	offDNSServers  = 48
	offDescription = 64
	offFriendly    = 72
	offIfType      = 100
	offOperStatus  = 104
)

func adapters() []adapter {
	// GAA_FLAG_SKIP_UNICAST | SKIP_ANYCAST | SKIP_MULTICAST — keep the DNS servers (SKIP_DNS_SERVER = 0x8 is NOT set).
	const flags = 0x1 | 0x2 | 0x4
	size := uint32(15 * 1024)
	var buf []byte
	for try := 0; try < 3; try++ {
		buf = make([]byte, size)
		r, _, _ := pGetAdaptersAddresses.Call(0, flags, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))
		if r == 0 {
			break
		}
		if r != 111 { // ERROR_BUFFER_OVERFLOW → grow and retry
			return nil
		}
	}

	var out []adapter
	p := uintptr(unsafe.Pointer(&buf[0]))
	for p != 0 {
		a := adapter{
			IfType: *(*uint32)(unsafe.Pointer(p + offIfType)),
			Up:     *(*uint32)(unsafe.Pointer(p + offOperStatus)) == 1,
		}
		if d := *(*uintptr)(unsafe.Pointer(p + offDescription)); d != 0 {
			a.Description = utf16Z(d)
		}
		if f := *(*uintptr)(unsafe.Pointer(p + offFriendly)); f != 0 {
			a.Name = utf16Z(f)
		}
		for dns := *(*uintptr)(unsafe.Pointer(p + offDNSServers)); dns != 0; dns = *(*uintptr)(unsafe.Pointer(dns + 8)) {
			if sa := *(*uintptr)(unsafe.Pointer(dns + 16)); sa != 0 {
				if ip := sockaddrIP(sa); ip != "" {
					a.DNS = append(a.DNS, ip)
				}
			}
		}
		out = append(out, a)
		p = *(*uintptr)(unsafe.Pointer(p + offNext))
	}
	return out
}

func utf16Z(p uintptr) string {
	var n int
	for *(*uint16)(unsafe.Pointer(p + uintptr(n*2))) != 0 {
		n++
		if n > 1024 {
			break
		}
	}
	return utf16ToString(unsafe.Slice((*uint16)(unsafe.Pointer(p)), n))
}

func sockaddrIP(sa uintptr) string {
	family := *(*uint16)(unsafe.Pointer(sa))
	switch family {
	case syscall.AF_INET:
		return net.IP(unsafe.Slice((*byte)(unsafe.Pointer(sa+4)), 4)).String()
	case syscall.AF_INET6:
		return net.IP(unsafe.Slice((*byte)(unsafe.Pointer(sa+8)), 16)).String()
	}
	return ""
}

var vpnWords = []string{"tap-windows", "wintun", "wireguard", "nordlynx", "openvpn", "vpn", "anyconnect", "fortinet", "forticlient", "zerotier", "tailscale", "proton", "mullvad", "hamachi", "cloudflare warp", "wan miniport (ikev2)", "wan miniport (l2tp)", "wan miniport (pptp)", "wan miniport (sstp)", "cisco", "pulse secure", "globalprotect", "sonicwall", "checkpoint", "softether", "outline"}

// vpnAdapters lists adapters that are up and look like a tunnel. Microsoft's own pseudo-tunnels (Teredo, ISATAP, 6to4)
// are always present on Windows and are not VPNs.
func vpnAdapters(list []adapter) []string {
	var out []string
	for _, a := range list {
		if !a.Up {
			continue
		}
		d := strings.ToLower(a.Description + " " + a.Name)
		if strings.Contains(d, "teredo") || strings.Contains(d, "isatap") || strings.Contains(d, "6to4") || strings.Contains(d, "loopback") || strings.Contains(d, "bluetooth") {
			continue
		}
		matched := a.IfType == 131 && !strings.Contains(d, "microsoft")
		for _, w := range vpnWords {
			if strings.Contains(d, w) {
				matched = true
				break
			}
		}
		if matched {
			out = append(out, strings.TrimSpace(a.Description))
		}
	}
	return out
}

// ── TCP table: is the browser talking to a proxy on this very computer? ───────────────────────────────────────────────

type tcpRow struct {
	State      uint32
	LocalAddr  uint32
	LocalPort  uint16
	RemoteAddr uint32
	RemotePort uint16
	PID        uint32
}

func tcpTable() []tcpRow {
	var size uint32
	pGetExtendedTCPTable.Call(0, uintptr(unsafe.Pointer(&size)), 0, syscall.AF_INET, 5, 0)
	if size == 0 {
		return nil
	}
	buf := make([]byte, size)
	if r, _, _ := pGetExtendedTCPTable.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)), 0, syscall.AF_INET, 5, 0); r != 0 {
		return nil
	}

	n := *(*uint32)(unsafe.Pointer(&buf[0]))
	rows := make([]tcpRow, 0, n)
	for i := uint32(0); i < n; i++ {
		o := 4 + i*24
		if int(o)+24 > len(buf) {
			break
		}
		f := func(k uint32) uint32 { return *(*uint32)(unsafe.Pointer(&buf[o+k*4])) }
		port := func(v uint32) uint16 { return uint16(((v & 0xff) << 8) | ((v >> 8) & 0xff)) }
		rows = append(rows, tcpRow{State: f(0), LocalAddr: f(1), LocalPort: port(f(2)), RemoteAddr: f(3), RemotePort: port(f(4)), PID: f(5)})
	}
	return rows
}

const loopback = 0x0100007F // 127.0.0.1, as the table stores it

// localProxy returns the port of a proxy running on this machine that a browser is connected through, or 0.
func localProxy(rows []tcpRow, isBrowser func(pid uint32) bool) (port uint16, owner uint32) {
	listening := map[uint16]uint32{}
	for _, r := range rows {
		if r.State == 2 && (r.LocalAddr == loopback || r.LocalAddr == 0) && !isBrowser(r.PID) {
			listening[r.LocalPort] = r.PID
		}
	}
	for _, r := range rows {
		if r.State == 5 && r.RemoteAddr == loopback && isBrowser(r.PID) {
			if own, ok := listening[r.RemotePort]; ok && own != r.PID {
				return r.RemotePort, own
			}
		}
	}
	return 0, 0
}

// ── certificates: did something install a trusted root while the exam was on? ─────────────────────────────────────────

type rootCert struct{ Thumb, Subject string }

func rootCerts() []rootCert {
	store, _, _ := pCertOpenSystemStore.Call(0, uintptr(unsafe.Pointer(wide("ROOT"))))
	if store == 0 {
		return nil
	}
	defer pCertCloseStore.Call(store, 0)

	var out []rootCert
	var ctx uintptr
	for {
		ctx, _, _ = pCertEnumCertificates.Call(store, ctx)
		if ctx == 0 {
			break
		}
		var n uint32 = 20
		hash := make([]byte, 20)
		if r, _, _ := pCertGetContextProp.Call(ctx, 3 /* CERT_HASH_PROP_ID */, uintptr(unsafe.Pointer(&hash[0])), uintptr(unsafe.Pointer(&n))); r == 0 {
			continue
		}
		subject := make([]uint16, 256)
		pCertGetNameString.Call(ctx, 4 /* CERT_NAME_SIMPLE_DISPLAY_TYPE */, 0, 0, uintptr(unsafe.Pointer(&subject[0])), uintptr(len(subject)))
		out = append(out, rootCert{Thumb: hexs(hash), Subject: utf16ToString(subject)})
	}
	return out
}

func hexs(b []byte) string {
	const d = "0123456789abcdef"
	out := make([]byte, 0, len(b)*2)
	for _, v := range b {
		out = append(out, d[v>>4], d[v&0xf])
	}
	return string(out)
}
