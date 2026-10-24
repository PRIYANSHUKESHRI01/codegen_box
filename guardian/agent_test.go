package main

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// ── fakes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type fakeSensors struct {
	fg       Foreground
	examHere bool
	keys     uint64
	mouse    uint64
	clip     uint32
	drives   int
	snapshot Snapshot
}

func (f *fakeSensors) Scan(*Matcher, string) Snapshot  { return f.snapshot }
func (f *fakeSensors) Foreground() Foreground          { return f.fg }
func (f *fakeSensors) ExamWindowPresent(string) bool   { return f.examHere }
func (f *fakeSensors) InjectedInput() (uint64, uint64) { return f.keys, f.mouse }
func (f *fakeSensors) ClipboardSeq() uint32            { return f.clip }
func (f *fakeSensors) RemovableDrives() int            { return f.drives }
func (f *fakeSensors) Close()                          {}

type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestAgent(t *testing.T, fs *fakeSensors) (*Agent, *clock) {
	t.Helper()
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	ag := NewAgent(NewAPI("http://invalid.test/api"), &Saved{LinkID: 7}, priv, "tok", fs, "1.0.0", "abc", func(string, ...any) {})
	c := &clock{t: time.Date(2026, 10, 23, 10, 0, 0, 0, time.UTC)}
	ag.now = c.now
	ag.matcher = NewMatcher(Policy{Browsers: []string{"chrome"}})
	return ag, c
}

func (a *Agent) arm(marker string) {
	a.mu.Lock()
	a.examActive, a.marker = true, marker
	a.mu.Unlock()
}

func (a *Agent) eventTypes() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	var out []string
	for _, e := range a.events {
		out = append(out, e["type"].(string))
	}
	return out
}

// ── policy matching ──────────────────────────────────────────────────────────────────────────────────────────────────

func TestProcessMatchingIsExact(t *testing.T) {
	m := NewMatcher(Policy{Processes: [][]any{{"obs64", "screen_sharing"}, {"anydesk", "remote_control"}}})

	for _, name := range []string{"OBS64.exe", `C:\Tools\AnyDesk.exe`, "anydesk"} {
		if _, ok := m.Process(name); !ok {
			t.Errorf("%q should match", name)
		}
	}
	// A program that merely CONTAINS a listed name is not that program.
	for _, name := range []string{"observer.exe", "obs640.exe", "myanydeskclone.exe", "chrome.exe"} {
		if _, ok := m.Process(name); ok {
			t.Errorf("%q must not match", name)
		}
	}
}

func TestMetadataSurvivesARename(t *testing.T) {
	m := NewMatcher(Policy{Strings: [][]any{{"anydesk", "remote_control"}, {"obs studio", "screen_sharing"}}})
	// calc.exe copied from anydesk.exe still says AnyDesk inside.
	if r, ok := m.Metadata("AnyDesk", "AnyDesk.exe", "AnyDesk Software GmbH"); !ok || r.Category != "remote_control" {
		t.Fatalf("a renamed AnyDesk should be recognised, got %+v %v", r, ok)
	}
	if _, ok := m.Metadata("Notepad", "NOTEPAD.EXE", "Notepad"); ok {
		t.Fatal("notepad is not on the list")
	}
}

func TestTitleRulesCarryTheirOwnStrike(t *testing.T) {
	m := NewMatcher(Policy{Titles: [][]any{{"chatgpt", "ai_assistant", 1.0}}})
	r, ok := m.Title("ChatGPT - Google Chrome")
	if !ok || r.Strike != 1 || r.Category != "ai_assistant" {
		t.Fatalf("got %+v %v", r, ok)
	}
	if _, ok := m.Title("AptRun contest — Solve"); ok {
		t.Fatal("an unrelated title must not match")
	}
}

func TestProcNameNormalisation(t *testing.T) {
	cases := map[string]string{`C:\Program Files\X\App.EXE`: "app", "App.exe": "app", "app": "app", `d:/x/y.exe`: "y"}
	for in, want := range cases {
		if got := ProcName(in); got != want {
			t.Errorf("ProcName(%q) = %q, want %q", in, got, want)
		}
	}
}

// ── signing: the exact format the PHP server verifies ──────────────────────────────────────────────────────────────

func TestSignatureCoversLinkSequenceAndBody(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	body := []byte(`{"seq":5,"events":[]}`)
	sig := Sign(priv, 7, 5, body)

	if !Verify(pub, 7, 5, body, sig) {
		t.Fatal("a fresh signature must verify")
	}
	if Verify(pub, 8, 5, body, sig) || Verify(pub, 7, 6, body, sig) || Verify(pub, 7, 5, append(body, ' '), sig) {
		t.Fatal("changing the link, the sequence or one byte of the body must invalidate it")
	}
	if got := string(signingMessage(7, 5, body)); !strings.HasPrefix(got, "7|5|") || len(got) != len("7|5|")+64 {
		t.Fatalf("message format drifted from the server's: %q", got)
	}
}

// ── findings ─────────────────────────────────────────────────────────────────────────────────────────────────────────

func TestTrackerReportsEachFindingOncePerExam(t *testing.T) {
	tr := NewTracker()
	f := []Finding{{Key: "proc:anydesk", Type: "forbidden_process"}, {Key: "proc:obs", Type: "forbidden_process"}}
	if got := tr.Fresh(f); len(got) != 2 {
		t.Fatalf("first sight: %d", len(got))
	}
	if got := tr.Fresh(f); len(got) != 0 {
		t.Fatalf("second sight must be silent, got %d", len(got))
	}
	tr.Reset()
	if got := tr.Fresh(f); len(got) != 2 {
		t.Fatalf("a new exam starts fresh, got %d", len(got))
	}
}

func TestBlockersCarryTheNamesTheServerShows(t *testing.T) {
	got := Blockers([]Finding{
		{Key: "a", Type: "vm_detected", Blocker: true, Data: map[string]any{"name": "VirtualBox"}},
		{Key: "a", Type: "vm_detected", Blocker: true, Data: map[string]any{"name": "dup"}},
		{Key: "b", Type: "forbidden_process", Blocker: true, Data: map[string]any{"name": "anydesk.exe", "category": "remote_control"}},
		{Key: "c", Type: "dns_changed", Blocker: false},
	})
	if len(got) != 2 || got[0]["type"] != "vm_detected" || got[1]["category"] != "remote_control" {
		t.Fatalf("unexpected blockers: %+v", got)
	}
}

// ── the decision logic ───────────────────────────────────────────────────────────────────────────────────────────────

func TestLeavingTheExamWindowIsReportedOnceAfterAMoment(t *testing.T) {
	fs := &fakeSensors{examHere: true, fg: Foreground{Process: "chrome.exe", Title: "[AptRun A1B2C3] Solve"}}
	ag, clk := newTestAgent(t, fs)
	ag.arm("A1B2C3")

	ag.watchForeground()
	if len(ag.eventTypes()) != 0 {
		t.Fatal("the exam window is in front: nothing to report")
	}

	fs.fg = Foreground{Process: "Discord.exe", Title: "friends - Discord"}
	ag.watchForeground()
	clk.advance(1000 * time.Millisecond)
	ag.watchForeground()
	if len(ag.eventTypes()) != 0 {
		t.Fatal("a one-second glance is not reported yet")
	}

	clk.advance(700 * time.Millisecond)
	ag.watchForeground()
	clk.advance(5000 * time.Millisecond)
	ag.watchForeground()
	if got := ag.eventTypes(); len(got) != 1 || got[0] != "os_foreground_away" {
		t.Fatalf("expected exactly one os_foreground_away, got %v", got)
	}
	if ag.events[0]["data"].(map[string]any)["process"] != "Discord.exe" {
		t.Fatalf("the report should name where they went: %+v", ag.events[0])
	}

	// back, then away again → a second episode
	fs.fg = Foreground{Title: "[AptRun A1B2C3] Solve"}
	ag.watchForeground()
	fs.fg = Foreground{Process: "notepad.exe", Title: "Untitled"}
	ag.watchForeground()
	clk.advance(2000 * time.Millisecond)
	ag.watchForeground()
	if got := ag.eventTypes(); len(got) != 2 {
		t.Fatalf("a second walk-away is a second event, got %v", got)
	}
}

func TestNothingIsWatchedWhenNoExamIsOn(t *testing.T) {
	fs := &fakeSensors{fg: Foreground{Process: "game.exe", Title: "Game"}}
	ag, clk := newTestAgent(t, fs)
	ag.watchForeground()
	clk.advance(time.Minute)
	ag.watchForeground()
	if len(ag.eventTypes()) != 0 {
		t.Fatal("outside an exam the Guardian reports no events")
	}
}

func TestAMissingExamWindowIsReportedAfterFiveSeconds(t *testing.T) {
	fs := &fakeSensors{examHere: false, fg: Foreground{Title: "[AptRun A1B2C3] x"}}
	ag, clk := newTestAgent(t, fs)
	ag.arm("A1B2C3")

	ag.watchForeground()
	clk.advance(4 * time.Second)
	ag.watchForeground()
	if len(ag.eventTypes()) != 0 {
		t.Fatal("too early")
	}
	clk.advance(2 * time.Second)
	ag.watchForeground()
	if got := ag.eventTypes(); len(got) != 1 || got[0] != "os_exam_window_missing" {
		t.Fatalf("got %v", got)
	}
}

func TestSoftwareTypingIsCountedNeverRead(t *testing.T) {
	fs := &fakeSensors{fg: Foreground{Title: "[AptRun A1B2C3] x"}}
	ag, clk := newTestAgent(t, fs)
	ag.arm("A1B2C3")

	ag.watchInjected()
	clk.advance(2 * time.Second)
	fs.keys = 5
	ag.watchInjected()
	if len(ag.eventTypes()) != 0 {
		t.Fatal("five injected keys is below the threshold (touch keyboards inject a few)")
	}

	clk.advance(2 * time.Second)
	fs.keys = 60
	ag.watchInjected()
	got := ag.eventTypes()
	if len(got) != 1 || got[0] != "injected_input" {
		t.Fatalf("got %v", got)
	}
	data := ag.events[0]["data"].(map[string]any)
	for k := range data {
		if k != "keys" && k != "mouse" && k != "seconds" {
			t.Fatalf("the report must hold counts only, found %q", k)
		}
	}

	// rate-limited
	clk.advance(2 * time.Second)
	fs.keys = 200
	ag.watchInjected()
	if len(ag.eventTypes()) != 1 {
		t.Fatal("one report a minute is enough")
	}
}

func TestFindingsBecomeEventsOnlyDuringAnExamButBlockersAreAlwaysInTheState(t *testing.T) {
	fs := &fakeSensors{snapshot: Snapshot{
		State:    map[string]any{"monitors": map[string]any{"count": 1}},
		Findings: []Finding{{Key: "proc:anydesk", Type: "forbidden_process", Blocker: true, Data: map[string]any{"name": "anydesk.exe", "category": "remote_control"}}},
	}, fg: Foreground{Title: "x"}}
	ag, _ := newTestAgent(t, fs)

	ag.tick(true)
	if len(ag.eventTypes()) != 0 {
		t.Fatal("before an exam it is only a pre-flight blocker, never an event")
	}
	st := ag.state()
	bl, _ := st["blockers"].([]map[string]any)
	if len(bl) != 1 || bl[0]["name"] != "anydesk.exe" {
		t.Fatalf("the state must list the blocker so the exam page can say what to close: %+v", st["blockers"])
	}
	if st["version"] != "1.0.0" || st["exe_sha256"] != "abc" {
		t.Fatal("the state carries the version and the executable's hash")
	}
	if tz, _ := st["tz"].(string); !strings.HasPrefix(tz, "UTC") {
		t.Fatalf("time zone should be a UTC offset the server can compare, got %q", tz)
	}

	ag.arm("A1B2C3")
	ag.tick(false)
	ag.tick(false)
	if got := ag.eventTypes(); len(got) != 1 || got[0] != "forbidden_process" {
		t.Fatalf("during an exam it is ONE event, got %v", got)
	}
}

// ── talking to the server ───────────────────────────────────────────────────────────────────────────────────────────

func TestSendPostsASignedReportAndLearnsTheMarker(t *testing.T) {
	var mu sync.Mutex
	var got struct {
		auth, sig string
		body      map[string]any
		raw       []byte
	}
	next := `{"ok":true,"seq":1,"marker":"A1B2C3","exam_active":true,"policy_version":"v1"}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		mu.Lock()
		got.auth, got.sig, got.raw = r.Header.Get("Authorization"), r.Header.Get("X-Guardian-Signature"), raw
		_ = json.Unmarshal(raw, &got.body)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(next))
	}))
	defer srv.Close()

	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	fs := &fakeSensors{fg: Foreground{Title: "x"}}
	ag := NewAgent(NewAPI(srv.URL), &Saved{LinkID: 7}, priv, "secret-token", fs, "1.0.0", "abc", func(string, ...any) {})
	ag.emit("os_foreground_away", map[string]any{"process": "x.exe"})

	var seq int64
	if err := ag.send(&seq); err != nil {
		t.Fatal(err)
	}

	mu.Lock()
	defer mu.Unlock()
	if got.auth != "Bearer secret-token" {
		t.Fatalf("auth header %q", got.auth)
	}
	if !Verify(pub, 7, 1, got.raw, got.sig) {
		t.Fatal("the server must be able to verify the signature over the exact body it received")
	}
	if got.body["seq"].(float64) != 1 {
		t.Fatalf("first report is seq 1, got %v", got.body["seq"])
	}
	if evs, _ := got.body["events"].([]any); len(evs) != 1 {
		t.Fatalf("the queued event rides the report, got %v", got.body["events"])
	}
	if seq != 1 || len(ag.eventTypes()) != 0 {
		t.Fatal("after an acknowledged report the queue is empty and the sequence advanced")
	}
	if !ag.examActive || ag.marker != "A1B2C3" {
		t.Fatalf("the reply tells the Guardian an exam is on and which window to look for: %v %q", ag.examActive, ag.marker)
	}
}

func TestAFailedReportKeepsItsEventsForTheNextOne(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	ag := NewAgent(NewAPI(srv.URL), &Saved{LinkID: 7}, priv, "t", &fakeSensors{}, "1.0.0", "", func(string, ...any) {})
	ag.emit("os_foreground_away", nil)

	var seq int64
	if err := ag.send(&seq); err == nil {
		t.Fatal("a 500 is an error")
	}
	if seq != 0 || len(ag.eventTypes()) != 1 {
		t.Fatal("a failed report must neither advance the sequence nor drop the event")
	}
}

func TestOutOfStepSequenceNumbersResync(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"code":"replayed","message":"Report out of sequence.","last_seq":41}`))
	}))
	defer srv.Close()

	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	ag := NewAgent(NewAPI(srv.URL), &Saved{LinkID: 7}, priv, "t", &fakeSensors{}, "1.0.0", "", func(string, ...any) {})

	var seq int64
	_ = ag.send(&seq)
	if seq != 41 {
		t.Fatalf("after a 'replayed' the Guardian continues from the server's count, got %d", seq)
	}
}

func TestRunStopsOnARevokedLink(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":"link_invalid","message":"This Guardian link is no longer valid."}`))
	}))
	defer srv.Close()

	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	ag := NewAgent(NewAPI(srv.URL), &Saved{LinkID: 7}, priv, "t", &fakeSensors{}, "1.0.0", "", func(string, ...any) {})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := ag.Run(ctx)
	if err == nil || !fatal(err) {
		t.Fatalf("a revoked link ends the run with a fatal error, got %v", err)
	}
}
