//go:build windows

package main

import (
	"errors"
	"os"
	"syscall"
	"unsafe"
)

// The "Open Guardian" button on an exam page is a link to aptrun-guardian://pair?code=…; registering the scheme under
// HKCU (no administrator rights, only this Windows user) makes the browser hand that link to this program.
const protoKey = `Software\Classes\aptrun-guardian`

// installProtocol keeps a copy of this program in the Guardian's own folder and registers the link to start that copy.
// It returns the program the link now starts.
func installProtocol() (string, error) {
	self, err := os.Executable()
	if err != nil {
		return "", err
	}
	target := placeProgram(self)
	return target, writeProtocol(target)
}

func writeProtocol(exe string) error {
	for _, kv := range []struct{ path, name, value string }{
		{protoKey, "", "URL:AptRun Guardian"},
		{protoKey, "URL Protocol", ""},
		{protoKey + `\DefaultIcon`, "", exe + ",0"},
		{protoKey + `\shell\open\command`, "", `"` + exe + `" "%1"`},
	} {
		if err := setRegString(kv.path, kv.name, kv.value); err != nil {
			return err
		}
	}
	return nil
}

func uninstallProtocol() error {
	for _, p := range []string{protoKey + `\shell\open\command`, protoKey + `\shell\open`, protoKey + `\shell`, protoKey + `\DefaultIcon`, protoKey} {
		_ = deleteRegKey(p)
	}
	// The program's own copy, if it is not the one running right now (Windows will not let a program delete itself).
	if self, err := os.Executable(); err != nil || !samePath(self, installedExe()) {
		_ = os.Remove(installedExe())
	}
	return nil
}

func setRegString(path, name, value string) error {
	var h syscall.Handle
	var disp uint32
	pRegCreate := advapi32.NewProc("RegCreateKeyExW")
	r, _, _ := pRegCreate.Call(uintptr(syscall.HKEY_CURRENT_USER), uintptr(unsafe.Pointer(wide(path))), 0, 0, 0, uintptr(syscall.KEY_WRITE), 0, uintptr(unsafe.Pointer(&h)), uintptr(unsafe.Pointer(&disp)))
	if r != 0 {
		return errors.New("could not write the registry: " + syscall.Errno(r).Error())
	}
	defer syscall.RegCloseKey(h)

	v := syscall.StringToUTF16(value)
	pRegSet := advapi32.NewProc("RegSetValueExW")
	rr, _, _ := pRegSet.Call(uintptr(h), uintptr(unsafe.Pointer(wide(name))), 0, uintptr(syscall.REG_SZ), uintptr(unsafe.Pointer(&v[0])), uintptr(len(v)*2))
	if rr != 0 {
		return errors.New("could not write the registry: " + syscall.Errno(rr).Error())
	}
	return nil
}

func deleteRegKey(path string) error {
	r, _, _ := advapi32.NewProc("RegDeleteKeyW").Call(uintptr(syscall.HKEY_CURRENT_USER), uintptr(unsafe.Pointer(wide(path))))
	if r != 0 {
		return syscall.Errno(r)
	}
	return nil
}

// singleInstance keeps two Guardians from running (and double-reporting) for one user.
func singleInstance() bool {
	h, _, err := pCreateMutex.Call(0, 1, uintptr(unsafe.Pointer(wide(`Local\AptRunGuardian`))))
	if h == 0 {
		return true
	}
	// ERROR_ALREADY_EXISTS (183)
	return err != syscall.Errno(183)
}
