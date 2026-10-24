package main

import (
	"os"
	"path/filepath"
	"testing"
)

// Every test gets its own LOCALAPPDATA, so none of them touches the real Guardian folder of whoever runs them.
func isolatedFolder(t *testing.T) {
	t.Helper()
	t.Setenv("LOCALAPPDATA", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", os.Getenv("LOCALAPPDATA"))
}

func download(t *testing.T, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "aptrun-guardian.exe")
	if err := os.WriteFile(p, []byte(content), 0o755); err != nil {
		t.Fatal(err)
	}
	return p
}

func read(t *testing.T, p string) string {
	t.Helper()
	b, err := os.ReadFile(p)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestTheDownloadIsCopiedIntoTheGuardiansOwnFolder(t *testing.T) {
	isolatedFolder(t)
	self := download(t, "build one")

	got := placeProgram(self)

	if got != installedExe() {
		t.Fatalf("the link should point at the program's own copy %q, got %q", installedExe(), got)
	}
	if read(t, got) != "build one" {
		t.Fatal("the copy is not the program that was run")
	}
}

func TestANewerDownloadReplacesTheOlderCopy(t *testing.T) {
	isolatedFolder(t)
	placeProgram(download(t, "build one"))

	got := placeProgram(download(t, "build two"))

	if read(t, got) != "build two" {
		t.Fatal("the newer download did not replace the old copy: the exam page would keep opening an out-of-date Guardian")
	}
	if _, err := os.Stat(installedExe() + ".new"); err == nil {
		t.Fatal("a half-written copy was left behind")
	}
}

func TestRunningTheSameBuildAgainChangesNothing(t *testing.T) {
	isolatedFolder(t)
	self := download(t, "build one")
	placeProgram(self)

	changed, err := copyIfDifferent(self, installedExe())
	if err != nil || changed {
		t.Fatalf("an identical program should not be rewritten (changed=%v err=%v)", changed, err)
	}
}

func TestRunningFromTheInstalledCopyNeedsNoCopy(t *testing.T) {
	isolatedFolder(t)
	if err := os.MkdirAll(stateDir(), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(installedExe(), []byte("installed"), 0o755); err != nil {
		t.Fatal(err)
	}

	if got := placeProgram(installedExe()); got != installedExe() || read(t, got) != "installed" {
		t.Fatalf("started from its own copy it must leave it alone, got %q", got)
	}
}

// If the folder cannot be used the student must still be able to connect: the link then points at the program that is running.
func TestWhenTheFolderCannotBeUsedTheLinkPointsAtTheRunningProgram(t *testing.T) {
	isolatedFolder(t)
	// The Guardian's folder is a FILE, so nothing can be created inside it.
	if err := os.WriteFile(stateDir(), []byte("in the way"), 0o600); err != nil {
		t.Fatal(err)
	}
	self := download(t, "build one")

	if got := placeProgram(self); got != self {
		t.Fatalf("expected a fallback to the running program %q, got %q", self, got)
	}
}

func TestDisconnectingForgetsTheIdentityButKeepsTheProgram(t *testing.T) {
	isolatedFolder(t)
	placeProgram(download(t, "build one"))
	for _, f := range []string{"state.json", "something.tmp"} {
		if err := os.WriteFile(filepath.Join(stateDir(), f), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	if err := clearState(); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(statePath()); err == nil {
		t.Fatal("the saved identity survived")
	}
	if read(t, installedExe()) != "build one" {
		t.Fatal("disconnecting removed the program, so the exam page's button would stop working")
	}
}

func TestDisconnectingWithNothingSavedIsFine(t *testing.T) {
	isolatedFolder(t)
	if err := clearState(); err != nil {
		t.Fatal(err)
	}
}
