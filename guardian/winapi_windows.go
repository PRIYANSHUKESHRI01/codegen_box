//go:build windows

package main

import (
	"syscall"
	"unicode/utf16"
	"unsafe"
)

// The handful of Win32 calls the Guardian needs, bound by hand (no cgo, no third-party packages: the program is one
// static executable that anyone can read and rebuild).

var (
	kernel32   = syscall.NewLazyDLL("kernel32.dll")
	user32     = syscall.NewLazyDLL("user32.dll")
	crypt32    = syscall.NewLazyDLL("crypt32.dll")
	iphlpapi   = syscall.NewLazyDLL("iphlpapi.dll")
	versionDLL = syscall.NewLazyDLL("version.dll")
	advapi32   = syscall.NewLazyDLL("advapi32.dll")

	pQueryFullProcessImageName = kernel32.NewProc("QueryFullProcessImageNameW")
	pOpenProcess               = kernel32.NewProc("OpenProcess")
	pIsDebuggerPresent         = kernel32.NewProc("IsDebuggerPresent")
	pCheckRemoteDebugger       = kernel32.NewProc("CheckRemoteDebuggerPresent")
	pGetCurrentProcess         = kernel32.NewProc("GetCurrentProcess")
	pGetLogicalDrives          = kernel32.NewProc("GetLogicalDrives")
	pGetDriveType              = kernel32.NewProc("GetDriveTypeW")
	pGetTickCount64            = kernel32.NewProc("GetTickCount64")
	pCreateMutex               = kernel32.NewProc("CreateMutexW")

	pGetForegroundWindow      = user32.NewProc("GetForegroundWindow")
	pGetWindowText            = user32.NewProc("GetWindowTextW")
	pGetWindowTextLength      = user32.NewProc("GetWindowTextLengthW")
	pGetWindowThreadProcID    = user32.NewProc("GetWindowThreadProcessId")
	pEnumWindows              = user32.NewProc("EnumWindows")
	pIsWindowVisible          = user32.NewProc("IsWindowVisible")
	pIsIconic                 = user32.NewProc("IsIconic")
	pGetWindowLong            = user32.NewProc("GetWindowLongW")
	pGetWindowRect            = user32.NewProc("GetWindowRect")
	pGetClassName             = user32.NewProc("GetClassNameW")
	pGetWindowDisplayAffinity = user32.NewProc("GetWindowDisplayAffinity")
	pGetSystemMetrics         = user32.NewProc("GetSystemMetrics")
	pEnumDisplayMonitors      = user32.NewProc("EnumDisplayMonitors")
	pEnumDisplayDevices       = user32.NewProc("EnumDisplayDevicesW")
	pSetProcessDPIAware       = user32.NewProc("SetProcessDPIAware")
	pGetClipboardSequence     = user32.NewProc("GetClipboardSequenceNumber")
	pGetRawInputDeviceList    = user32.NewProc("GetRawInputDeviceList")
	pSetWindowsHookEx         = user32.NewProc("SetWindowsHookExW")
	pCallNextHookEx           = user32.NewProc("CallNextHookEx")
	pGetMessage               = user32.NewProc("GetMessageW")
	pUnhookWindowsHookEx      = user32.NewProc("UnhookWindowsHookEx")

	pCryptProtectData     = crypt32.NewProc("CryptProtectData")
	pCryptUnprotectData   = crypt32.NewProc("CryptUnprotectData")
	pCertOpenSystemStore  = crypt32.NewProc("CertOpenSystemStoreW")
	pCertEnumCertificates = crypt32.NewProc("CertEnumCertificatesInStore")
	pCertGetContextProp   = crypt32.NewProc("CertGetCertificateContextProperty")
	pCertGetNameString    = crypt32.NewProc("CertGetNameStringW")
	pCertCloseStore       = crypt32.NewProc("CertCloseStore")

	pGetAdaptersAddresses = iphlpapi.NewProc("GetAdaptersAddresses")
	pGetExtendedTCPTable  = iphlpapi.NewProc("GetExtendedTcpTable")

	pGetFileVersionInfoSize = versionDLL.NewProc("GetFileVersionInfoSizeW")
	pGetFileVersionInfo     = versionDLL.NewProc("GetFileVersionInfoW")
	pVerQueryValue          = versionDLL.NewProc("VerQueryValueW")
)

const (
	processQueryLimited = 0x1000
	gwlExStyle          = -20
	wsExTopmost         = 0x00000008
	wsExTransparent     = 0x00000020
	wsExLayered         = 0x00080000
	wsExToolWindow      = 0x00000080
	wsExNoActivate      = 0x08000000

	smCMonitors     = 80
	smRemoteSession = 0x1000
	smCXScreen      = 0
	smCYScreen      = 1

	whKeyboardLL  = 13
	whMouseLL     = 14
	llkhfInjected = 0x10
	llmhfInjected = 0x01

	driveRemovable = 2
)

type rect struct{ Left, Top, Right, Bottom int32 }

func utf16ToString(p []uint16) string {
	for i, v := range p {
		if v == 0 {
			return string(utf16.Decode(p[:i]))
		}
	}
	return string(utf16.Decode(p))
}

func wide(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

func foregroundWindow() uintptr {
	h, _, _ := pGetForegroundWindow.Call()
	return h
}

func windowText(hwnd uintptr) string {
	n, _, _ := pGetWindowTextLength.Call(hwnd)
	if n == 0 {
		return ""
	}
	buf := make([]uint16, n+1)
	pGetWindowText.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return utf16ToString(buf)
}

func windowClass(hwnd uintptr) string {
	buf := make([]uint16, 256)
	pGetClassName.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	return utf16ToString(buf)
}

func windowPID(hwnd uintptr) uint32 {
	var pid uint32
	pGetWindowThreadProcID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	return pid
}

func windowExStyle(hwnd uintptr) uint32 {
	v, _, _ := pGetWindowLong.Call(hwnd, uintptr(0xFFFFFFEC)) // GWL_EXSTYLE (-20) as an unsigned argument
	return uint32(v)
}

func windowRect(hwnd uintptr) rect {
	var r rect
	pGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	return r
}

func windowAffinity(hwnd uintptr) uint32 {
	var a uint32
	ret, _, _ := pGetWindowDisplayAffinity.Call(hwnd, uintptr(unsafe.Pointer(&a)))
	if ret == 0 {
		return 0
	}
	return a
}

func isVisible(hwnd uintptr) bool   { r, _, _ := pIsWindowVisible.Call(hwnd); return r != 0 }
func isMinimised(hwnd uintptr) bool { r, _, _ := pIsIconic.Call(hwnd); return r != 0 }

// enumWindows calls fn for every top-level window until fn returns false.
func enumWindows(fn func(hwnd uintptr) bool) {
	cb := syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
		if fn(hwnd) {
			return 1
		}
		return 0
	})
	pEnumWindows.Call(cb, 0)
}

// imagePath returns the full path of a process's executable ("" when it cannot be opened, e.g. a protected system process).
func imagePath(pid uint32) string {
	h, _, _ := pOpenProcess.Call(processQueryLimited, 0, uintptr(pid))
	if h == 0 {
		return ""
	}
	defer syscall.CloseHandle(syscall.Handle(h))
	buf := make([]uint16, 1024)
	size := uint32(len(buf))
	ret, _, _ := pQueryFullProcessImageName.Call(h, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))
	if ret == 0 {
		return ""
	}
	return syscall.UTF16ToString(buf[:size])
}

func systemMetric(i int) int {
	v, _, _ := pGetSystemMetrics.Call(uintptr(i))
	return int(int32(v))
}

// ── version resources: ProductName / OriginalFilename / FileDescription ───────────────────────────────────────────────

func fileStrings(path string) []string {
	if path == "" {
		return nil
	}
	p := wide(path)
	size, _, _ := pGetFileVersionInfoSize.Call(uintptr(unsafe.Pointer(p)), 0)
	if size == 0 {
		return nil
	}
	data := make([]byte, size)
	if r, _, _ := pGetFileVersionInfo.Call(uintptr(unsafe.Pointer(p)), 0, size, uintptr(unsafe.Pointer(&data[0]))); r == 0 {
		return nil
	}

	// Translation table: language + codepage pairs.
	var trans uintptr
	var tlen uint32
	sub := wide(`\VarFileInfo\Translation`)
	if r, _, _ := pVerQueryValue.Call(uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(sub)), uintptr(unsafe.Pointer(&trans)), uintptr(unsafe.Pointer(&tlen))); r == 0 || tlen < 4 {
		trans = 0
	}
	langs := []string{"040904b0", "040904e4", "000004b0"}
	if trans != 0 {
		l := *(*uint16)(unsafe.Pointer(trans))
		c := *(*uint16)(unsafe.Pointer(trans + 2))
		langs = append([]string{sprintfHex(l, c)}, langs...)
	}

	var out []string
	for _, lang := range langs {
		for _, field := range []string{"ProductName", "OriginalFilename", "FileDescription", "InternalName"} {
			var val uintptr
			var vlen uint32
			q := wide(`\StringFileInfo\` + lang + `\` + field)
			if r, _, _ := pVerQueryValue.Call(uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(q)), uintptr(unsafe.Pointer(&val)), uintptr(unsafe.Pointer(&vlen))); r != 0 && vlen > 0 && val != 0 {
				out = append(out, utf16PtrToString(val, int(vlen)))
			}
		}
		if len(out) > 0 {
			break
		}
	}
	return out
}

func sprintfHex(lang, codepage uint16) string {
	const hexd = "0123456789abcdef"
	b := []byte{hexd[lang>>12&0xf], hexd[lang>>8&0xf], hexd[lang>>4&0xf], hexd[lang&0xf], hexd[codepage>>12&0xf], hexd[codepage>>8&0xf], hexd[codepage>>4&0xf], hexd[codepage&0xf]}
	return string(b)
}

func utf16PtrToString(p uintptr, n int) string {
	if p == 0 || n <= 0 {
		return ""
	}
	s := unsafe.Slice((*uint16)(unsafe.Pointer(p)), n)
	return utf16ToString(s)
}
