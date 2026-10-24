//go:build windows

package main

import (
	"crypto/sha256"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

// moduleEntry32 is MODULEENTRY32W (Go's syscall package has no binding for it).
type moduleEntry32 struct {
	Size         uint32
	ModuleID     uint32
	ProcessID    uint32
	GlblcntUsage uint32
	ProccntUsage uint32
	ModBaseAddr  uintptr
	ModBaseSize  uint32
	HModule      uintptr
	Module       [256]uint16
	ExePath      [260]uint16
}

var (
	pModule32First = kernel32.NewProc("Module32FirstW")
	pModule32Next  = kernel32.NewProc("Module32NextW")
)

type winProc struct {
	PID  uint32
	Name string // "chrome.exe"
}

// winSensors is the Windows implementation of Sensors.
type winSensors struct {
	flagCache map[uint32][]string // browser PID → risky start-up flags (a process's command line never changes)
	selfMods  map[string]bool     // modules of the Guardian's own process already seen
	hid       struct {
		ready     bool
		keyboards int
		mice      int
	}
	tlsAt     time.Time
	tlsBad    bool
	tlsSeen   []string
	apiBase   string
	input     *injectedCounters
	apiHost   string
	sysRoot   string
	started   time.Time
	metaCache map[string][]string // exe path → version-resource strings
	vm        vmInfo
	vmChecked bool
	baseline  struct {
		ready bool
		hosts string
		dns   string
		ca    map[string]bool
	}
	slowAt    time.Time
	slowState map[string]any
	slowFinds []Finding
}

type vmInfo struct {
	Detected bool
	Signals  []string
}

func newSensors(apiBase string) Sensors {
	pSetProcessDPIAware.Call() // a console exe is DPI-unaware by default; this makes screen sizes physical pixels
	host := ""
	if u, err := url.Parse(apiBase); err == nil {
		host = strings.ToLower(u.Hostname())
	}
	return &winSensors{
		input:     startInputHooks(),
		apiHost:   host,
		sysRoot:   strings.ToLower(os.Getenv("SystemRoot")),
		started:   time.Now(),
		metaCache: map[string][]string{},
		flagCache: map[uint32][]string{},
		selfMods:  map[string]bool{},
		apiBase:   apiBase,
	}
}

func (s *winSensors) Close() {}

func (s *winSensors) Foreground() Foreground {
	h := foregroundWindow()
	if h == 0 {
		return Foreground{}
	}
	pid := windowPID(h)
	return Foreground{PID: pid, Process: filepath.Base(imagePath(pid)), Title: windowText(h)}
}

func (s *winSensors) ExamWindowPresent(marker string) bool {
	if marker == "" {
		return true
	}
	m := strings.ToLower(marker)
	found := false
	enumWindows(func(h uintptr) bool {
		if isVisible(h) && strings.Contains(strings.ToLower(windowText(h)), m) {
			found = true
			return false
		}
		return true
	})
	return found
}

func (s *winSensors) InjectedInput() (uint64, uint64) {
	return s.input.keys.Load(), s.input.mouse.Load()
}

func (s *winSensors) ClipboardSeq() uint32 {
	n, _, _ := pGetClipboardSequence.Call()
	return uint32(n)
}

func (s *winSensors) RemovableDrives() int {
	mask, _, _ := pGetLogicalDrives.Call()
	n := 0
	for i := 0; i < 26; i++ {
		if mask&(1<<uint(i)) == 0 {
			continue
		}
		root := string(rune('A'+i)) + `:\`
		if t, _, _ := pGetDriveType.Call(uintptr(unsafe.Pointer(wide(root)))); t == driveRemovable {
			n++
		}
	}
	return n
}

// isSystemImage is true for files that ship with Windows (or its Store apps). They are never reported as overlays or
// as capture-excluded windows: Windows itself uses both.
func (s *winSensors) isSystemImage(path string) bool {
	p := strings.ToLower(path)
	return p == "" || (s.sysRoot != "" && strings.HasPrefix(p, s.sysRoot+`\`)) ||
		strings.HasPrefix(p, `c:\program files\windowsapps\microsoft.`)
}

func (s *winSensors) strings(path string) []string {
	if v, ok := s.metaCache[path]; ok {
		return v
	}
	v := fileStrings(path)
	s.metaCache[path] = v
	return v
}

// Scan is the thorough look. Cheap parts run every time; the registry / certificate / hosts parts at most every 10 s.
func (s *winSensors) Scan(m *Matcher, marker string) Snapshot {
	var finds []Finding
	state := map[string]any{}
	// ── processes ──
	procs := processes()
	names := make(map[uint32]string, len(procs))
	for _, p := range procs {
		names[p.PID] = p.Name
	}
	state["procs"] = len(procs)

	for _, p := range procs {
		if r, ok := m.Process(p.Name); ok {
			finds = append(finds, Finding{Key: "proc:" + ProcName(p.Name), Type: "forbidden_process", Blocker: true,
				Data: map[string]any{"category": r.Category, "name": p.Name}})
		}
		if m.IsBrowser(p.Name) {
			flags, seen := s.flagCache[p.PID]
			if !seen {
				flags = riskyBrowserFlags(commandLine(p.PID))
				s.flagCache[p.PID] = flags
			}
			for _, f := range flags {
				finds = append(finds, Finding{Key: "bflag:" + f, Type: "browser_flag", Blocker: true,
					Data: map[string]any{"name": p.Name + " " + f}})
			}
		}
		switch ProcName(p.Name) {
		case "vmtoolsd", "vboxservice", "vboxtray", "qemu-ga", "vmwaretray", "vmwareuser", "vmacthlp":
			finds = append(finds, Finding{Key: "vmproc:" + ProcName(p.Name), Type: "vm_detected", Blocker: true, Data: map[string]any{"name": p.Name, "via": "guest tools"}})
		case "rdpclip":
			finds = append(finds, Finding{Key: "remote:rdpclip", Type: "remote_session", Blocker: true, Data: map[string]any{"name": "Remote Desktop"}})
		}
	}

	// ── windows ──
	screenW, screenH := systemMetric(smCXScreen), systemMetric(smCYScreen)
	state["monitors"] = map[string]any{"count": systemMetric(smCMonitors), "primary": map[string]any{"w": screenW, "h": screenH}}
	examFound, examVisible, examMin := false, false, false
	lowerMarker := strings.ToLower(marker)

	seenPID := map[uint32]bool{}
	enumWindows(func(h uintptr) bool {
		if !isVisible(h) {
			return true
		}
		title := windowText(h)
		pid := windowPID(h)
		isExam := lowerMarker != "" && strings.Contains(strings.ToLower(title), lowerMarker)
		if isExam {
			examFound, examVisible, examMin = true, true, isMinimised(h)
			return true
		}

		path := imagePath(pid)
		name := filepath.Base(path)
		if path == "" {
			name = names[pid]
		}
		sys := s.isSystemImage(path)
		browser := m.IsBrowser(name)

		// A window titled like an AI chat / answer site, in ANY program.
		if r, ok := m.Title(title); ok && !sys {
			finds = append(finds, Finding{Key: "title:" + r.Pattern, Type: "forbidden_process", Blocker: true,
				Data: map[string]any{"category": r.Category, "name": truncate(title, 60), "via": "title"}})
		}

		if !sys && !seenPID[pid] {
			seenPID[pid] = true
			// A renamed executable still carries its real name inside.
			if !browser {
				if r, ok := m.Metadata(s.strings(path)...); ok {
					finds = append(finds, Finding{Key: "meta:" + r.Pattern, Type: "forbidden_process", Blocker: true,
						Data: map[string]any{"category": r.Category, "name": name, "via": "metadata"}})
				}
			}
			if !browser && !m.OverlayAllowed(name) && name != "" && !strings.EqualFold(filepath.Base(os.Args[0]), name) {
				finds = append(finds, Finding{Key: "win:" + ProcName(name), Type: "unknown_window_process", Data: map[string]any{"name": name}})
			}
		}

		// A window that hides itself from screen capture is built to be invisible to the exam's own screen share.
		if aff := windowAffinity(h); aff != 0 && !sys && !browser {
			finds = append(finds, Finding{Key: "capture:" + ProcName(name), Type: "capture_excluded_window", Blocker: true,
				Data: map[string]any{"name": name, "affinity": aff, "title": truncate(title, 40)}})
		}

		// A transparent, always-on-top, click-through window over the screen is an overlay (an "assistant" painted on top).
		ex := windowExStyle(h)
		if ex&wsExTopmost != 0 && ex&(wsExLayered|wsExTransparent) != 0 && !isMinimised(h) && !sys && !browser && !m.OverlayAllowed(name) {
			r := windowRect(h)
			area := int64(r.Right-r.Left) * int64(r.Bottom-r.Top)
			if screenW > 0 && screenH > 0 && area*4 >= int64(screenW)*int64(screenH) {
				finds = append(finds, Finding{Key: "overlay:" + ProcName(name), Type: "overlay_window", Blocker: true,
					Data: map[string]any{"name": name, "title": truncate(title, 40)}})
			}
		}
		return true
	})
	state["exam_window"] = map[string]any{"found": examFound, "visible": examVisible, "minimized": examMin}

	// ── screens ──
	if n := systemMetric(smCMonitors); n > 1 {
		finds = append(finds, Finding{Key: "monitors", Type: "multi_monitor_os", Blocker: true, Data: map[string]any{"count": n}})
	}
	virtual := virtualDisplay()
	if virtual != "" {
		finds = append(finds, Finding{Key: "vdisplay:" + virtual, Type: "virtual_display", Blocker: true, Data: map[string]any{"name": virtual}})
	}
	state["monitors"].(map[string]any)["virtual"] = virtual != ""

	// ── keyboards and mice: a second one plugged in mid-exam is how a hardware typing device would appear ──
	kb, ms := inputDevices()
	state["input_devices"] = map[string]any{"keyboards": kb, "mice": ms}
	if !s.hid.ready {
		s.hid.ready, s.hid.keyboards, s.hid.mice = true, kb, ms
	} else if kb > s.hid.keyboards || ms > s.hid.mice {
		finds = append(finds, Finding{Key: "hid:" + itoa(kb) + "/" + itoa(ms), Type: "input_device_added",
			Data: map[string]any{"name": itoa(kb) + " keyboards, " + itoa(ms) + " mice (was " + itoa(s.hid.keyboards) + "/" + itoa(s.hid.mice) + ")"}})
	}

	// ── remote desktop ──
	if systemMetric(smRemoteSession) != 0 {
		finds = append(finds, Finding{Key: "remote:session", Type: "remote_session", Blocker: true, Data: map[string]any{"name": "Remote Desktop session"}})
	}
	state["remote"] = map[string]any{"session": systemMetric(smRemoteSession) != 0}

	// ── a library from a user folder loaded into the Guardian itself: how a program would hook its checks to hide things ──
	for _, mod := range s.suspiciousModules() {
		finds = append(finds, Finding{Key: "mod:" + strings.ToLower(mod), Type: "injected_module", Blocker: true, Data: map[string]any{"name": filepath.Base(mod)}})
	}

	// ── debugger ──
	if debuggerAttached() {
		finds = append(finds, Finding{Key: "debugger", Type: "debugger_attached", Blocker: true, Data: map[string]any{"name": "debugger"}})
	}

	// ── the slow part ──
	if !s.vmChecked {
		s.vm, s.vmChecked = detectVM(), true
	}
	state["vm"] = map[string]any{"detected": s.vm.Detected, "signals": s.vm.Signals}
	if s.vm.Detected {
		finds = append(finds, Finding{Key: "vm", Type: "vm_detected", Blocker: true, Data: map[string]any{"name": strings.Join(s.vm.Signals, ", "), "via": "hardware"}})
	}

	if s.slowState == nil || time.Since(s.slowAt) > 10*time.Second {
		s.slowAt = time.Now()
		s.slowState, s.slowFinds = s.slowScan(m, procs, names)
	}
	for k, v := range s.slowState {
		state[k] = v
	}
	finds = append(finds, s.slowFinds...)

	state["drives"] = s.RemovableDrives()
	state["uptime_s"] = int(time.Since(s.started).Seconds())
	state["os"] = map[string]any{"build": regString(syscall.HKEY_LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, "CurrentBuild")}

	return Snapshot{State: state, Findings: finds}
}

// slowScan covers things that change rarely and cost more to read: proxy settings, VPN adapters, the hosts file, the
// trusted-root store and the TCP table.
func (s *winSensors) slowScan(m *Matcher, procs []winProc, names map[uint32]string) (map[string]any, []Finding) {
	state := map[string]any{}
	var finds []Finding
	net := map[string]any{}

	// proxy
	const inet = `Software\Microsoft\Windows\CurrentVersion\Internet Settings`
	proxyOn := regDWORD(syscall.HKEY_CURRENT_USER, inet, "ProxyEnable") == 1
	proxyServer := regString(syscall.HKEY_CURRENT_USER, inet, "ProxyServer")
	pac := regString(syscall.HKEY_CURRENT_USER, inet, "AutoConfigURL")
	if !proxyOn {
		proxyServer = ""
	}
	for _, v := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY"} {
		if e := os.Getenv(v); e != "" && proxyServer == "" {
			proxyServer = e
		}
	}
	if proxyServer != "" || pac != "" {
		shown := proxyServer
		if shown == "" {
			shown = "auto-config script"
		}
		finds = append(finds, Finding{Key: "proxy:system", Type: "proxy_detected", Blocker: true, Data: map[string]any{"name": truncate(shown, 60), "via": "system settings"}})
	}
	net["proxy"] = proxyServer != "" || pac != ""
	net["proxy_server"] = truncate(proxyServer, 80)

	// a proxy running on this very machine that the browser is connected through (mitmproxy, Fiddler, Burp, Charles …)
	browserPID := func(pid uint32) bool { return m.IsBrowser(names[pid]) }
	if port, owner := localProxy(tcpTable(), browserPID); port != 0 {
		finds = append(finds, Finding{Key: "proxy:local", Type: "proxy_detected", Blocker: true,
			Data: map[string]any{"name": "local proxy on port " + itoa(int(port)) + " (" + names[owner] + ")", "via": "loopback"}})
		net["proxy"] = true
	}

	// HTTPS to AptRun being read by something in the middle (a certificate that is not ours in the chain)
	if len(m.Pins) > 0 && time.Since(s.tlsAt) > time.Minute {
		s.tlsAt = time.Now()
		s.tlsBad, s.tlsSeen = tlsIntercepted(s.apiBase, m.Pins)
	}
	if s.tlsBad {
		finds = append(finds, Finding{Key: "proxy:tls", Type: "proxy_detected", Blocker: true,
			Data: map[string]any{"name": "HTTPS to AptRun is being intercepted", "via": "tls_pin"}})
		net["proxy"] = true
	}

	// VPN / tunnel adapters, DNS servers
	ads := adapters()
	vpns := vpnAdapters(ads)
	for _, v := range vpns {
		finds = append(finds, Finding{Key: "vpn:" + strings.ToLower(v), Type: "vpn_detected", Blocker: true, Data: map[string]any{"name": truncate(v, 60)}})
	}
	net["vpn"] = len(vpns) > 0
	var dns []string
	adNames := []string{}
	for _, a := range ads {
		if !a.Up {
			continue
		}
		adNames = append(adNames, truncate(a.Description, 50))
		dns = append(dns, a.DNS...)
	}
	sort.Strings(dns)
	dns = uniq(dns)
	net["adapters"] = adNames
	net["dns"] = dns
	dnsHash := shortHash(strings.Join(dns, ","))

	// the hosts file: an entry for the exam's own host, or any change since the Guardian started
	hostsHash, mapsAPI := hostsInfo(s.apiHost)
	net["hosts_hash"] = hostsHash
	if mapsAPI {
		finds = append(finds, Finding{Key: "hosts:api", Type: "hosts_modified", Blocker: true, Data: map[string]any{"name": "an entry for " + s.apiHost}})
	}

	// trusted root certificates: a new one appearing is how an intercepting proxy gets to read HTTPS
	certs := rootCerts()
	thumbs := make([]string, 0, len(certs))
	set := make(map[string]bool, len(certs))
	for _, c := range certs {
		thumbs = append(thumbs, c.Thumb)
		set[c.Thumb] = true
	}
	sort.Strings(thumbs)
	net["root_cas"] = len(certs)
	net["root_cas_hash"] = shortHash(strings.Join(thumbs, ","))

	if !s.baseline.ready {
		s.baseline.ready, s.baseline.hosts, s.baseline.dns, s.baseline.ca = true, hostsHash, dnsHash, set
	} else {
		if hostsHash != s.baseline.hosts {
			finds = append(finds, Finding{Key: "hosts:" + hostsHash, Type: "hosts_modified", Blocker: true, Data: map[string]any{"name": "hosts file"}})
		}
		if dnsHash != s.baseline.dns {
			finds = append(finds, Finding{Key: "dns:" + dnsHash, Type: "dns_changed", Data: map[string]any{"name": strings.Join(dns, ", ")}})
		}
		for _, c := range certs {
			if !s.baseline.ca[c.Thumb] {
				finds = append(finds, Finding{Key: "ca:" + c.Thumb, Type: "root_ca_added", Blocker: true, Data: map[string]any{"name": truncate(c.Subject, 60)}})
			}
		}
	}

	state["network"] = net
	return state, finds
}

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────

// inputDevices counts the keyboards and mice Windows knows about (Raw Input), physical and virtual alike. The count is only
// ever compared with itself: an increase after the Guardian started means a device was connected.
func inputDevices() (keyboards, mice int) {
	var n uint32
	const size = 16 // sizeof(RAWINPUTDEVICELIST) on 64-bit
	pGetRawInputDeviceList.Call(0, uintptr(unsafe.Pointer(&n)), size)
	if n == 0 {
		return 0, 0
	}
	buf := make([]byte, uintptr(n)*size)
	got, _, _ := pGetRawInputDeviceList.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&n)), size)
	if int32(got) <= 0 {
		return 0, 0
	}
	for i := uintptr(0); i < uintptr(got); i++ {
		switch *(*uint32)(unsafe.Pointer(&buf[i*size+8])) { // dwType follows the 8-byte device handle
		case 0:
			mice++
		case 1:
			keyboards++
		}
	}
	return keyboards, mice
}

// suspiciousModules lists libraries loaded into THIS process from folders a normal install never uses (the user's profile,
// temp, downloads, desktop, a shared public folder). Antivirus and graphics-overlay libraries live under Program Files or
// Windows and are not listed — they would otherwise flag half the students.
func (s *winSensors) suspiciousModules() []string {
	snap, err := syscall.CreateToolhelp32Snapshot(0x8|0x10 /* SNAPMODULE | SNAPMODULE32 */, uint32(os.Getpid()))
	if err != nil {
		return nil
	}
	defer syscall.CloseHandle(snap)

	self, _ := os.Executable()
	var e moduleEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	if r, _, _ := pModule32First.Call(uintptr(snap), uintptr(unsafe.Pointer(&e))); r == 0 {
		return nil
	}

	var out []string
	for {
		path := syscall.UTF16ToString(e.ExePath[:])
		low := strings.ToLower(path)
		s.selfMods[low] = true
		if suspiciousModulePath(low, strings.ToLower(self)) {
			out = append(out, path)
		}
		if r, _, _ := pModule32Next.Call(uintptr(snap), uintptr(unsafe.Pointer(&e))); r == 0 {
			break
		}
	}
	return out
}

func processes() []winProc {
	snap, err := syscall.CreateToolhelp32Snapshot(syscall.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil
	}
	defer syscall.CloseHandle(snap)

	var e syscall.ProcessEntry32
	e.Size = uint32(unsafe.Sizeof(e))
	var out []winProc
	if err := syscall.Process32First(snap, &e); err != nil {
		return nil
	}
	for {
		out = append(out, winProc{PID: e.ProcessID, Name: syscall.UTF16ToString(e.ExeFile[:])})
		if err := syscall.Process32Next(snap, &e); err != nil {
			break
		}
	}
	return out
}

func debuggerAttached() bool {
	if r, _, _ := pIsDebuggerPresent.Call(); r != 0 {
		return true
	}
	self, _, _ := pGetCurrentProcess.Call()
	var remote int32
	pCheckRemoteDebugger.Call(self, uintptr(unsafe.Pointer(&remote)))
	return remote != 0
}

type displayDevice struct {
	Cb           uint32
	DeviceName   [32]uint16
	DeviceString [128]uint16
	StateFlags   uint32
	DeviceID     [128]uint16
	DeviceKey    [128]uint16
}

var virtualDisplayWords = []string{"virtual", "indirect display", "spacedesk", "duet", "parsec", "usb mobile monitor", "remote display", "vnc", "splashtop", "idd", "iddsample"}

// virtualDisplay returns the name of an attached display adapter that is software.
func virtualDisplay() string {
	for i := uint32(0); i < 16; i++ {
		var d displayDevice
		d.Cb = uint32(unsafe.Sizeof(d))
		if r, _, _ := pEnumDisplayDevices.Call(0, uintptr(i), uintptr(unsafe.Pointer(&d)), 0); r == 0 {
			break
		}
		if d.StateFlags&1 == 0 { // DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
			continue
		}
		name := utf16ToString(d.DeviceString[:])
		lower := strings.ToLower(name)
		// Microsoft's "Basic Display Adapter" / the hypervisor's own adapters appear on real PCs without a vendor driver.
		if strings.Contains(lower, "microsoft basic") {
			continue
		}
		for _, w := range virtualDisplayWords {
			if strings.Contains(lower, w) {
				return name
			}
		}
	}
	return ""
}

var vmBIOSWords = []string{"vmware", "virtualbox", "innotek", "qemu", "kvm", "xen", "parallels", "bochs", "bhyve", "proxmox", "red hat", "amazon ec2", "google compute", "virtual machine", "hvm domu"}

// detectVM looks at the machine's OWN description (BIOS strings) and for drivers / programs that only exist INSIDE a
// guest. It deliberately ignores the hypervisor CPU bit and virtual network cards: a normal Windows 11 PC with core
// isolation (VBS) or WSL2 reports both, and flagging them would lock out honest students.
func detectVM() vmInfo {
	signals := []string{}
	const bios = `HARDWARE\DESCRIPTION\System\BIOS`
	for _, v := range []string{"SystemManufacturer", "SystemProductName", "BIOSVendor", "BaseBoardManufacturer", "BaseBoardProduct", "SystemFamily"} {
		val := strings.ToLower(regString(syscall.HKEY_LOCAL_MACHINE, bios, v))
		for _, w := range vmBIOSWords {
			if val != "" && strings.Contains(val, w) {
				signals = append(signals, "BIOS "+v+": "+truncate(val, 40))
				break
			}
		}
	}
	for _, svc := range []string{"VBoxGuest", "VBoxMouse", "VBoxVideo", "vm3dmp", "vmmouse", "vmhgfs", "vmrawdsk", "VMTools", "vioscsi", "netkvm", "xenbus", "xenvif", "qemu-ga"} {
		if regKeyExists(syscall.HKEY_LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Services\`+svc) {
			signals = append(signals, "guest driver "+svc)
		}
	}
	return vmInfo{Detected: len(signals) > 0, Signals: signals}
}

func hostsInfo(apiHost string) (hash string, mapsAPI bool) {
	path := filepath.Join(os.Getenv("SystemRoot"), `System32\drivers\etc\hosts`)
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", false
	}
	var lines []string
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if i := strings.Index(line, "#"); i >= 0 {
			line = strings.TrimSpace(line[:i])
		}
		if line == "" {
			continue
		}
		lines = append(lines, strings.Join(strings.Fields(line), " "))
		if apiHost != "" && apiHost != "localhost" && apiHost != "127.0.0.1" {
			for _, f := range strings.Fields(strings.ToLower(line))[1:] {
				if f == apiHost {
					mapsAPI = true
				}
			}
		}
	}
	sort.Strings(lines)
	return shortHash(strings.Join(lines, "\n")), mapsAPI
}

func shortHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hexs(sum[:6])
}

func uniq(in []string) []string {
	var out []string
	for i, v := range in {
		if i == 0 || v != in[i-1] {
			out = append(out, v)
		}
	}
	return out
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}
