//go:build !windows

package main

// The Guardian reads the Windows operating system. On any other system this file lets the portable logic (policy
// matching, signing, the decision engine) still build and be tested; the program itself says it is Windows-only.

func protect(b []byte) ([]byte, error)   { return b, nil }
func unprotect(b []byte) ([]byte, error) { return b, nil }
func installProtocol() (string, error)   { return "", nil }
func uninstallProtocol() error           { return nil }
func singleInstance() bool               { return true }
func newSensors(string) Sensors          { return nil }
