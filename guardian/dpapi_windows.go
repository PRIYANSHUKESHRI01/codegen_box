//go:build windows

package main

import (
	"errors"
	"unsafe"
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func blobOf(b []byte) dataBlob {
	if len(b) == 0 {
		return dataBlob{}
	}
	return dataBlob{cbData: uint32(len(b)), pbData: &b[0]}
}

func (d dataBlob) bytes() []byte {
	if d.cbData == 0 || d.pbData == nil {
		return nil
	}
	return append([]byte(nil), unsafe.Slice(d.pbData, d.cbData)...)
}

// protect encrypts for the CURRENT Windows user (DPAPI): the same file on another account or machine cannot be read.
func protect(plain []byte) ([]byte, error) {
	in := blobOf(plain)
	var out dataBlob
	r, _, err := pCryptProtectData.Call(uintptr(unsafe.Pointer(&in)), 0, 0, 0, 0, 0, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, errors.New("CryptProtectData: " + err.Error())
	}
	defer kernel32.NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.pbData)))
	return out.bytes(), nil
}

func unprotect(blob []byte) ([]byte, error) {
	in := blobOf(blob)
	var out dataBlob
	r, _, err := pCryptUnprotectData.Call(uintptr(unsafe.Pointer(&in)), 0, 0, 0, 0, 0, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, errors.New("CryptUnprotectData: " + err.Error())
	}
	defer kernel32.NewProc("LocalFree").Call(uintptr(unsafe.Pointer(out.pbData)))
	return out.bytes(), nil
}
