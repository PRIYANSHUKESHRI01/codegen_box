package main

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// programName is the Guardian's own copy inside its folder (%LOCALAPPDATA%\AptRunGuardian). A student downloads one file, runs
// it once from wherever the browser saved it, and from then on the exam page's "Open Guardian" button starts THIS copy — so
// deleting the download, or cleaning the Downloads folder, does not break it.
const programName = "aptrun-guardian.exe"

func installedExe() string { return filepath.Join(stateDir(), programName) }

func samePath(a, b string) bool {
	return strings.EqualFold(filepath.Clean(a), filepath.Clean(b))
}

// placeProgram makes sure the Guardian's folder holds this very program and returns where the link should point.
//
// A newer download replaces an older copy. If the old copy cannot be replaced (it is running right now, so Windows keeps its file
// locked) or the folder cannot be written, the link points at the program that is running — which still works, it just has not
// moved. This never fails the caller: the student should not be stopped from connecting over a convenience.
func placeProgram(self string) string {
	dest := installedExe()
	if samePath(self, dest) {
		return dest
	}
	if err := os.MkdirAll(stateDir(), 0o700); err != nil {
		return self
	}
	if _, err := copyIfDifferent(self, dest); err != nil {
		return self
	}
	return dest
}

// copyIfDifferent copies src over dst unless dst already holds the same bytes. It writes beside the target first and renames, so a
// half-copied program is never left where the link points.
func copyIfDifferent(src, dst string) (changed bool, err error) {
	want, err := os.ReadFile(src)
	if err != nil {
		return false, err
	}
	if have, err := os.ReadFile(dst); err == nil && sha256.Sum256(have) == sha256.Sum256(want) {
		return false, nil
	}

	tmp := dst + ".new"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return false, err
	}
	if _, err := io.Copy(f, bytes.NewReader(want)); err != nil {
		f.Close()
		os.Remove(tmp)
		return false, err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return false, err
	}
	if err := os.Rename(tmp, dst); err != nil {
		os.Remove(tmp)
		return false, err
	}
	return true, nil
}

// clearState deletes what the Guardian saved (identity, key, token) but not the program: a running program cannot delete itself,
// and "disconnect" should not make the exam page's button stop working. --uninstall removes the program.
func clearState() error {
	entries, err := os.ReadDir(stateDir())
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var first error
	for _, e := range entries {
		if strings.EqualFold(e.Name(), programName) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(stateDir(), e.Name())); err != nil && first == nil {
			first = err
		}
	}
	return first
}
