package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"reflect"
	"testing"
	"time"
)

func TestRiskyBrowserFlags(t *testing.T) {
	cases := []struct {
		name string
		cmd  string
		want []string
	}{
		{"an ordinary start", `"C:\Program Files\Google\Chrome\Application\chrome.exe" --profile-directory=Default`, nil},
		{"remote debugging", `chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\x`, []string{"--remote-debugging-port"}},
		{"upper case and several", `MSEDGE.EXE --LOAD-EXTENSION="C:\ext" --Proxy-Server=127.0.0.1:8080 --ignore-certificate-errors`, []string{"--load-extension", "--proxy-server", "--ignore-certificate-errors"}},
		{"bypassing the hosts file", `chrome.exe --host-resolver-rules="MAP api.example.com 10.0.0.9"`, []string{"--host-resolver-rules"}},
		{"automation", `chrome.exe --enable-automation --remote-debugging-pipe`, []string{"--enable-automation", "--remote-debugging-pipe"}},
		{"a helper process is not the browser", `chrome.exe --type=renderer --remote-debugging-port=9222`, nil},
		{"a flag that merely contains the name", `chrome.exe --proxy-server-not-a-flag=1 --my-load-extension`, nil},
		{"nothing readable", ``, nil},
	}
	for _, c := range cases {
		if got := riskyBrowserFlags(c.cmd); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func cert(t *testing.T) *x509.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tpl := &x509.Certificate{SerialNumber: big.NewInt(time.Now().UnixNano()), Subject: pkix.Name{CommonName: "test"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour)}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	c, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestPinsAreMatchedAnywhereInTheChain(t *testing.T) {
	leaf, intermediate, interceptor := cert(t), cert(t), cert(t)
	pinOfIntermediate := spkiPins([]*x509.Certificate{intermediate})[0]

	// our real chain: leaf + intermediate; we pinned the intermediate (rotating the leaf must not matter)
	if !pinMatches([]*x509.Certificate{leaf, intermediate}, []string{pinOfIntermediate}) {
		t.Fatal("the pinned intermediate is in the chain: not intercepted")
	}
	// a proxy presents its own certificate: nothing in the chain is ours
	if pinMatches([]*x509.Certificate{interceptor}, []string{pinOfIntermediate}) {
		t.Fatal("a chain with none of our keys must be reported")
	}
	// nothing pinned = nothing to contradict (so a college behind legitimate SSL inspection can opt out)
	if !pinMatches([]*x509.Certificate{interceptor}, nil) {
		t.Fatal("no pins configured must never raise an alarm")
	}
	// whitespace in the configured list is tolerated
	if !pinMatches([]*x509.Certificate{leaf}, []string{"  " + spkiPins([]*x509.Certificate{leaf})[0] + " "}) {
		t.Fatal("pins are trimmed")
	}
}

func TestTLSCheckIsSilentWhenItCannotJudge(t *testing.T) {
	if bad, _ := tlsIntercepted("http://plain.example/api", []string{"x"}); bad {
		t.Fatal("plain http has no chain to judge")
	}
	if bad, _ := tlsIntercepted("https://127.0.0.1:1/api", []string{"x"}); bad {
		t.Fatal("an unreachable host is a network problem, not an attack")
	}
	if bad, _ := tlsIntercepted("https://whatever.example/api", nil); bad {
		t.Fatal("no pins, no judgement")
	}
}

func TestOnlyLibrariesFromUserFoldersAreSuspicious(t *testing.T) {
	self := `c:\users\esha\downloads\aptrun-guardian.exe`
	cases := map[string]bool{
		`c:\windows\system32\kernel32.dll`:                  false,
		`c:\program files\avast software\avast\aswhook.dll`: false, // antivirus hooks every process
		`c:\program files (x86)\nvidia corporation\x.dll`:   false,
		self: false, // the Guardian itself, even from Downloads
		`c:\users\esha\appdata\local\temp\cheat.dll`: true,
		`c:\users\esha\downloads\hook.dll`:           true,
		`c:\users\esha\desktop\inject\x.dll`:         true,
		`c:\users\public\documents\y.dll`:            true,
		`d:\tools\z.dll`:                             false, // not a known staging area: not guessed at
		``:                                           false,
	}
	for path, want := range cases {
		if got := suspiciousModulePath(path, self); got != want {
			t.Errorf("%q: got %v, want %v", path, got, want)
		}
	}
}
