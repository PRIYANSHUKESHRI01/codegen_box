//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// A browser can be started in ways that hand a script, another program or a proxy control of it: a remote-debugging port
// (anything on the machine can drive the page through the DevTools protocol), an unpacked extension, a proxy, relaxed
// certificate checks, or host-name overrides that bypass the hosts file. None of that is visible to the web page — but the
// command line the browser was started with is visible to the operating system.
//
// Reading another process's command line means reading its PEB (documented offsets on 64-bit Windows). It is a read-only
// look at a same-user process; if anything about it fails the answer is simply "no flags known".

var (
	ntdll                   = syscall.NewLazyDLL("ntdll.dll")
	pNtQueryInformationProc = ntdll.NewProc("NtQueryInformationProcess")
	pReadProcessMemory      = kernel32.NewProc("ReadProcessMemory")
)

const (
	processQueryInformation = 0x0400
	processVMRead           = 0x0010

	pebProcessParametersOffset = 0x20 // PEB.ProcessParameters (x64)
	paramsCommandLineOffset    = 0x70 // RTL_USER_PROCESS_PARAMETERS.CommandLine (x64)
)

type processBasicInformation struct {
	Reserved1       uintptr
	PebBaseAddress  uintptr
	Reserved2       [2]uintptr
	UniqueProcessID uintptr
	Reserved3       uintptr
}

type unicodeString struct {
	Length        uint16
	MaximumLength uint16
	_             uint32
	Buffer        uintptr
}

func readMem(h uintptr, addr uintptr, dst unsafe.Pointer, n uintptr) bool {
	var read uintptr
	r, _, _ := pReadProcessMemory.Call(h, addr, uintptr(dst), n, uintptr(unsafe.Pointer(&read)))
	return r != 0 && read == n
}

// commandLine returns a process's command line, or "" when it cannot be read.
func commandLine(pid uint32) string {
	h, _, _ := pOpenProcess.Call(processQueryInformation|processVMRead, 0, uintptr(pid))
	if h == 0 {
		return ""
	}
	defer syscall.CloseHandle(syscall.Handle(h))

	var pbi processBasicInformation
	var ret uint32
	if r, _, _ := pNtQueryInformationProc.Call(h, 0, uintptr(unsafe.Pointer(&pbi)), unsafe.Sizeof(pbi), uintptr(unsafe.Pointer(&ret))); r != 0 || pbi.PebBaseAddress == 0 {
		return ""
	}

	var params uintptr
	if !readMem(h, pbi.PebBaseAddress+pebProcessParametersOffset, unsafe.Pointer(&params), unsafe.Sizeof(params)) || params == 0 {
		return ""
	}

	var us unicodeString
	if !readMem(h, params+paramsCommandLineOffset, unsafe.Pointer(&us), unsafe.Sizeof(us)) || us.Length == 0 || us.Buffer == 0 || us.Length > 32768 {
		return ""
	}

	buf := make([]uint16, us.Length/2)
	if !readMem(h, us.Buffer, unsafe.Pointer(&buf[0]), uintptr(us.Length)) {
		return ""
	}
	return utf16ToString(buf)
}
