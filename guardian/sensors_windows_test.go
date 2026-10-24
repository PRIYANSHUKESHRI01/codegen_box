//go:build windows

package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// A library loaded into the Guardian from a user folder must be seen. This loads a harmless copy of a Windows library from
// a folder called "Downloads" and checks the module snapshot (hand-bound structure and all) reports exactly that one.
func TestAnInjectedLibraryFromAUserFolderIsSeen(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "Downloads")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}

	src, err := os.Open(filepath.Join(os.Getenv("SystemRoot"), "System32", "cabinet.dll"))
	if err != nil {
		t.Skip("no cabinet.dll to copy")
	}
	defer src.Close()

	dst := filepath.Join(dir, "hook.dll")
	out, err := os.Create(dst)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(out, src); err != nil {
		t.Fatal(err)
	}
	out.Close()

	s := &winSensors{selfMods: map[string]bool{}}
	for _, m := range s.suspiciousModules() {
		if strings.EqualFold(filepath.Base(m), "hook.dll") {
			t.Fatal("the library was not loaded yet, yet it was reported")
		}
	}

	h, err := syscall.LoadLibrary(dst)
	if err != nil {
		t.Skipf("this machine will not load the probe library: %v", err)
	}
	defer syscall.FreeLibrary(h)

	var found []string
	for _, m := range s.suspiciousModules() {
		found = append(found, filepath.Base(m))
	}
	if len(found) != 1 || !strings.EqualFold(found[0], "hook.dll") {
		t.Fatalf("expected exactly the probe library to be reported, got %v", found)
	}
}

// The scanners must run on a real machine without panicking and return the shapes the server expects.
func TestARealScanReturnsTheExpectedShape(t *testing.T) {
	s := newSensors("https://api.example.com/api")
	snap := s.Scan(NewMatcher(Policy{Browsers: []string{"chrome", "msedge"}}), "")

	for _, k := range []string{"monitors", "network", "vm", "remote", "procs", "os", "input_devices", "exam_window"} {
		if _, ok := snap.State[k]; !ok {
			t.Errorf("state is missing %q", k)
		}
	}
	if procs, _ := snap.State["procs"].(int); procs < 5 {
		t.Errorf("a real machine runs more than %d processes", procs)
	}
	mon, _ := snap.State["monitors"].(map[string]any)
	prim, _ := mon["primary"].(map[string]any)
	if w, _ := prim["w"].(int); w < 640 {
		t.Errorf("implausible screen width %v", prim["w"])
	}
	if fg := s.Foreground(); fg.PID == 0 && fg.Title == "" {
		t.Log("no foreground window right now (headless session?)")
	}
	if kb, _ := s.(*winSensors).input.keys.Load(), 0; kb != 0 {
		t.Errorf("nobody has injected input into this test, got %d", kb)
	}
}
