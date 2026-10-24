package main

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"net"
	"net/url"
	"strings"
	"time"
)

// Is HTTPS between this computer and AptRun being read by something in the middle?
//
// An intercepting proxy (mitmproxy, Fiddler, Burp, a router doing "SSL inspection") can read and rewrite everything the
// exam page sends — but to do it for HTTPS it must present ITS OWN certificate for our server. So the Guardian looks at the
// chain our server actually presents and compares the public keys in it with the "pins" the server published (the public-key
// hashes of the certificates it uses). If none match, someone else's certificate is in the way.
//
// Pins are the SHA-256 of a certificate's SubjectPublicKeyInfo, base64 — the same value browsers used for HPKP. Pin the
// INTERMEDIATE or root CA (they change rarely), not the leaf (a renewed certificate would otherwise lock everyone out).
// A college whose network does legitimate SSL inspection must exempt the AptRun host, or leave GUARDIAN_TLS_PINS empty.

// spkiPins returns the pin of every certificate in a presented chain.
func spkiPins(chain []*x509.Certificate) []string {
	out := make([]string, 0, len(chain))
	for _, c := range chain {
		sum := sha256.Sum256(c.RawSubjectPublicKeyInfo)
		out = append(out, base64.StdEncoding.EncodeToString(sum[:]))
	}
	return out
}

// pinMatches reports whether ANY certificate in the chain carries one of the published pins.
func pinMatches(chain []*x509.Certificate, pins []string) bool {
	if len(pins) == 0 {
		return true // nothing is pinned: nothing to contradict
	}
	want := map[string]bool{}
	for _, p := range pins {
		want[strings.TrimSpace(p)] = true
	}
	for _, got := range spkiPins(chain) {
		if want[got] {
			return true
		}
	}
	return false
}

// tlsIntercepted dials the API host and says whether the chain it presents contradicts the pins. Errors reaching the host
// are not a finding (a network problem is not an attack); only a chain that is present and wrong is.
func tlsIntercepted(apiBase string, pins []string) (intercepted bool, presented []string) {
	if len(pins) == 0 {
		return false, nil
	}
	u, err := url.Parse(apiBase)
	if err != nil || u.Scheme != "https" {
		return false, nil
	}
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		port = "443"
	}

	dialer := &net.Dialer{Timeout: 4 * time.Second}
	// InsecureSkipVerify is deliberate: we want to SEE the chain even when it would not verify. Trust is decided by the pins.
	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, port), &tls.Config{ServerName: host, InsecureSkipVerify: true})
	if err != nil {
		return false, nil
	}
	defer conn.Close()

	chain := conn.ConnectionState().PeerCertificates
	return !pinMatches(chain, pins), spkiPins(chain)
}
