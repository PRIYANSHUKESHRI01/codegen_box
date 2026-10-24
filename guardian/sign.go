package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
)

// signingMessage is exactly what the server verifies (GuardianService::authenticate):
//
//	"<link id>|<seq>|<sha256 hex of the request body>"
//
// The signature covers the BODY BYTES as sent, so nothing in a report can be altered in transit, and the sequence number
// makes every report single-use.
func signingMessage(linkID int64, seq int64, body []byte) []byte {
	sum := sha256.Sum256(body)
	return []byte(fmt.Sprintf("%d|%d|%s", linkID, seq, hex.EncodeToString(sum[:])))
}

// Sign returns the base64 Ed25519 signature for a report.
func Sign(priv ed25519.PrivateKey, linkID int64, seq int64, body []byte) string {
	return base64.StdEncoding.EncodeToString(ed25519.Sign(priv, signingMessage(linkID, seq, body)))
}

// Verify is the same check the server does; used by the tests to prove the two sides agree on the format.
func Verify(pub ed25519.PublicKey, linkID int64, seq int64, body []byte, sig string) bool {
	raw, err := base64.StdEncoding.DecodeString(sig)
	if err != nil {
		return false
	}
	return ed25519.Verify(pub, signingMessage(linkID, seq, body), raw)
}
