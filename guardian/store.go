package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Saved is what the Guardian remembers between runs. The private key and the link token are stored encrypted for the
// current Windows user (DPAPI), so copying the file to another machine or user account gives nothing.
type Saved struct {
	InstallID  string `json:"install_id"`
	PrivateKey string `json:"private_key"` // base64 of the protected key bytes
	PublicKey  string `json:"public_key"`  // base64, sent at pairing
	API        string `json:"api"`
	LinkID     int64  `json:"link_id"`
	Token      string `json:"token"` // base64 of the protected token bytes
	Name       string `json:"name"`
	Seq        int64  `json:"seq"`
	PolicyJSON string `json:"policy"`
}

func stateDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	return filepath.Join(base, "AptRunGuardian")
}

func statePath() string { return filepath.Join(stateDir(), "state.json") }

func loadSaved() (*Saved, error) {
	raw, err := os.ReadFile(statePath())
	if errors.Is(err, os.ErrNotExist) {
		return &Saved{}, nil
	}
	if err != nil {
		return nil, err
	}
	var s Saved
	// Notepad and PowerShell write a UTF-8 byte-order mark; Go's JSON reader does not accept one.
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	if err := json.Unmarshal(raw, &s); err != nil {
		return &Saved{}, nil // a damaged file is the same as no file: pair again
	}
	return &s, nil
}

func (s *Saved) save() error {
	if err := os.MkdirAll(stateDir(), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	tmp := statePath() + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, statePath())
}

// ensureKey creates this installation's identity once: an id and an Ed25519 key pair.
func (s *Saved) ensureKey() (ed25519.PrivateKey, error) {
	if s.PrivateKey != "" {
		blob, err := base64.StdEncoding.DecodeString(s.PrivateKey)
		if err == nil {
			if plain, err := unprotect(blob); err == nil && len(plain) == ed25519.PrivateKeySize {
				return ed25519.PrivateKey(plain), nil
			}
		}
		// Unreadable (another Windows user, or damaged): this install gets a new identity.
		s.PrivateKey, s.PublicKey, s.Token, s.LinkID, s.InstallID = "", "", "", 0, ""
	}

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	protected, err := protect(priv)
	if err != nil {
		return nil, fmt.Errorf("protect key: %w", err)
	}
	s.PrivateKey = base64.StdEncoding.EncodeToString(protected)
	s.PublicKey = base64.StdEncoding.EncodeToString(pub)
	s.InstallID = newUUID()
	return priv, nil
}

func (s *Saved) setToken(plain string) error {
	blob, err := protect([]byte(plain))
	if err != nil {
		return err
	}
	s.Token = base64.StdEncoding.EncodeToString(blob)
	return nil
}

func (s *Saved) token() (string, bool) {
	if s.Token == "" {
		return "", false
	}
	blob, err := base64.StdEncoding.DecodeString(s.Token)
	if err != nil {
		return "", false
	}
	plain, err := unprotect(blob)
	if err != nil {
		return "", false
	}
	return string(plain), true
}

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
