//go:build windows

package main

import (
	"runtime"
	"sync/atomic"
	"syscall"
	"unsafe"
)

// Input that did not come from hardware. Windows tags keystrokes and mouse events produced by SendInput() — the call
// every auto-typer, macro recorder and "type this for me" tool uses — with an "injected" flag that the hardware path never
// sets. A low-level hook sees that flag. Only COUNTS are kept: which keys were pressed is never read, stored or sent.
type injectedCounters struct {
	keys  atomic.Uint64
	mouse atomic.Uint64
}

type kbdHook struct {
	VKCode, ScanCode, Flags, Time uint32
	ExtraInfo                     uintptr
}

type mouseHook struct {
	X, Y      int32
	MouseData uint32
	Flags     uint32
	Time      uint32
	ExtraInfo uintptr
}

type msg struct {
	Hwnd    uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	Pt      struct{ X, Y int32 }
}

// startInputHooks installs the hooks on a dedicated OS thread (a hook only fires on a thread that pumps messages) and
// returns the running counters. It never blocks the caller.
func startInputHooks() *injectedCounters {
	c := &injectedCounters{}
	ready := make(chan struct{})

	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		kcb := syscall.NewCallback(func(code int32, w, l uintptr) uintptr {
			if code >= 0 && l != 0 {
				if (*kbdHook)(unsafe.Pointer(l)).Flags&llkhfInjected != 0 {
					c.keys.Add(1)
				}
			}
			r, _, _ := pCallNextHookEx.Call(0, uintptr(code), w, l)
			return r
		})
		mcb := syscall.NewCallback(func(code int32, w, l uintptr) uintptr {
			if code >= 0 && l != 0 {
				if (*mouseHook)(unsafe.Pointer(l)).Flags&llmhfInjected != 0 {
					c.mouse.Add(1)
				}
			}
			r, _, _ := pCallNextHookEx.Call(0, uintptr(code), w, l)
			return r
		})

		kh, _, _ := pSetWindowsHookEx.Call(whKeyboardLL, kcb, 0, 0)
		mh, _, _ := pSetWindowsHookEx.Call(whMouseLL, mcb, 0, 0)
		close(ready)

		var m msg
		for {
			r, _, _ := pGetMessage.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
			if int32(r) <= 0 {
				break
			}
		}
		if kh != 0 {
			pUnhookWindowsHookEx.Call(kh)
		}
		if mh != 0 {
			pUnhookWindowsHookEx.Call(mh)
		}
	}()

	<-ready
	return c
}
