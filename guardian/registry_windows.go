//go:build windows

package main

import (
	"syscall"
	"unicode/utf16"
	"unsafe"
)

const keyWow64_64 = 0x0100

func openKey(root syscall.Handle, path string) (syscall.Handle, bool) {
	var h syscall.Handle
	if err := syscall.RegOpenKeyEx(root, wide(path), 0, syscall.KEY_READ|keyWow64_64, &h); err != nil {
		return 0, false
	}
	return h, true
}

// regString reads a REG_SZ / REG_EXPAND_SZ value ("" when missing).
func regString(root syscall.Handle, path, name string) string {
	h, ok := openKey(root, path)
	if !ok {
		return ""
	}
	defer syscall.RegCloseKey(h)

	var typ, size uint32
	if err := syscall.RegQueryValueEx(h, wide(name), nil, &typ, nil, &size); err != nil || size == 0 {
		return ""
	}
	buf := make([]byte, size)
	if err := syscall.RegQueryValueEx(h, wide(name), nil, &typ, &buf[0], &size); err != nil {
		return ""
	}
	if typ != syscall.REG_SZ && typ != syscall.REG_EXPAND_SZ {
		return ""
	}
	u := unsafe.Slice((*uint16)(unsafe.Pointer(&buf[0])), size/2)
	return utf16ToString(u)
}

// regDWORD reads a REG_DWORD value (0 when missing).
func regDWORD(root syscall.Handle, path, name string) uint32 {
	h, ok := openKey(root, path)
	if !ok {
		return 0
	}
	defer syscall.RegCloseKey(h)

	var typ, size uint32 = 0, 4
	var v uint32
	if err := syscall.RegQueryValueEx(h, wide(name), nil, &typ, (*byte)(unsafe.Pointer(&v)), &size); err != nil || typ != syscall.REG_DWORD {
		return 0
	}
	return v
}

func regKeyExists(root syscall.Handle, path string) bool {
	h, ok := openKey(root, path)
	if ok {
		syscall.RegCloseKey(h)
	}
	return ok
}

// regSubkeys lists the names under a key.
func regSubkeys(root syscall.Handle, path string) []string {
	h, ok := openKey(root, path)
	if !ok {
		return nil
	}
	defer syscall.RegCloseKey(h)

	var out []string
	for i := uint32(0); ; i++ {
		buf := make([]uint16, 256)
		n := uint32(len(buf))
		if err := syscall.RegEnumKeyEx(h, i, &buf[0], &n, nil, nil, nil, nil); err != nil {
			break
		}
		out = append(out, string(utf16.Decode(buf[:n])))
	}
	return out
}
