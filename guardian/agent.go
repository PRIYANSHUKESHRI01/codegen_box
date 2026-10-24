package main

import (
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

// Foreground is the window the user is typing into right now.
type Foreground struct {
	PID     uint32
	Process string
	Title   string
}

// Sensors is everything the Guardian needs from the operating system. The Windows implementation is in
// sensors_windows.go; the tests use a fake, which is what lets the decision logic below be tested on its own.
type Sensors interface {
	// Scan is the slow, thorough look: processes, windows, screens, virtual machine, network.
	Scan(m *Matcher, marker string) Snapshot
	Foreground() Foreground
	// ExamWindowPresent reports whether any top-level window carries the marker (the browser tab with the exam).
	ExamWindowPresent(marker string) bool
	// InjectedInput returns running totals of keystrokes / mouse events that came from software, not hardware.
	InjectedInput() (keys, mouse uint64)
	ClipboardSeq() uint32
	RemovableDrives() int
	Close()
}

// Agent turns what the sensors see into signed reports.
type Agent struct {
	Version string
	ExeSHA  string

	API     *API
	Saved   *Saved
	Priv    ed25519.PrivateKey
	Token   string
	Sensors Sensors
	Log     func(format string, args ...any)

	matcher *Matcher
	policy  Policy
	tracker *Tracker

	mu         sync.Mutex
	events     []map[string]any
	marker     string
	examActive bool

	// foreground tracking
	awaySince    time.Time
	awayReported bool
	missingSince time.Time
	missingSent  bool

	lastKeys, lastMouse uint64
	injectedWindow      []injSample
	lastInjectedAt      time.Time
	lastClip            uint32
	lastClipAt          time.Time
	lastDrives          int
	lastSnapshot        Snapshot
	lastSnapshotAt      time.Time

	now func() time.Time
}

type injSample struct {
	at    time.Time
	keys  uint64
	mouse uint64
}

func NewAgent(a *API, s *Saved, priv ed25519.PrivateKey, token string, sensors Sensors, version, exeSHA string, logf func(string, ...any)) *Agent {
	ag := &Agent{Version: version, ExeSHA: exeSHA, API: a, Saved: s, Priv: priv, Token: token, Sensors: sensors, Log: logf, tracker: NewTracker(), now: time.Now}
	if s.PolicyJSON != "" {
		_ = json.Unmarshal([]byte(s.PolicyJSON), &ag.policy)
	}
	ag.matcher = NewMatcher(ag.policy)
	return ag
}

func (a *Agent) setPolicy(raw json.RawMessage) {
	var p Policy
	if err := json.Unmarshal(raw, &p); err != nil || p.Version == "" {
		return
	}
	a.policy = p
	a.matcher = NewMatcher(p)
	a.Saved.PolicyJSON = string(raw)
	_ = a.Saved.save()
}

func (a *Agent) emit(typ string, data map[string]any) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.events) >= 200 {
		a.events = a.events[1:]
	}
	a.events = append(a.events, map[string]any{"type": typ, "t": a.now().UnixMilli(), "data": data})
	if minor[typ] {
		a.Log("[ ] noted: %s", describe(typ, data))
	} else {
		a.Log("[!] %s", describe(typ, data))
	}
}

// minor events are shown to the student as notes, not alarms.
var minor = map[string]bool{"unknown_window_process": true, "dns_changed": true, "clipboard_outside": true}

func describe(typ string, data map[string]any) string {
	name, _ := data["name"].(string)
	switch typ {
	case "unknown_window_process":
		return fmt.Sprintf("%s opened a window", name)
	case "forbidden_process":
		return fmt.Sprintf("%s is running (%v)", name, data["category"])
	case "os_foreground_away":
		return fmt.Sprintf("you left the exam window for %v", data["process"])
	case "os_exam_window_missing":
		return "the exam window is not on the desktop"
	default:
		return strings.ReplaceAll(typ, "_", " ")
	}
}

// Run reports until ctx ends. Every beat carries the latest state and whatever events happened since the last one.
func (a *Agent) Run(ctx context.Context) error {
	beat := time.Duration(a.policy.BeatMS) * time.Millisecond
	if beat < time.Second {
		beat = 5 * time.Second
	}

	fast := time.NewTicker(100 * time.Millisecond)
	defer fast.Stop()
	slow := time.NewTicker(beat)
	defer slow.Stop()

	var seq = a.Saved.Seq
	a.tick(true)
	if err := a.send(&seq); err != nil {
		if fatal(err) {
			return err
		}
	}
	nextEarly := a.now()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-fast.C:
			a.watchForeground()

			// An event is worth sending now, not at the next heartbeat: the server cross-checks it against the page, and a
			// student who has just walked away should not get five seconds' head start. A failing server is not hammered.
			if a.queued() > 0 && !a.now().Before(nextEarly) {
				if err := a.send(&seq); err != nil {
					if fatal(err) {
						return err
					}
					nextEarly = a.now().Add(5 * time.Second)
				} else {
					nextEarly = a.now().Add(400 * time.Millisecond)
				}
			}
		case <-slow.C:
			a.tick(false)
			if err := a.send(&seq); err != nil && fatal(err) {
				return err
			}
			nextEarly = a.now().Add(400 * time.Millisecond)
		}
	}
}

func (a *Agent) queued() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.events)
}

func fatal(err error) bool {
	var se *ServerError
	if errors.As(err, &se) {
		return se.Status == 401 || se.Status == 403
	}
	return false
}

// tick is the slow scan plus the checks that compare one scan to the last.
func (a *Agent) tick(first bool) {
	a.mu.Lock()
	marker := a.marker
	active := a.examActive
	a.mu.Unlock()

	snap := a.Sensors.Scan(a.matcher, marker)
	a.lastSnapshot = snap
	a.lastSnapshotAt = a.now()

	if active {
		for _, f := range a.tracker.Fresh(snap.Findings) {
			a.emit(f.Type, f.Data)
		}
		a.watchInjected()
		a.watchClipboardAndDrives()
	}
}

// watchForeground is the 10-times-a-second check: is the exam window the one in front?
func (a *Agent) watchForeground() {
	a.mu.Lock()
	marker, active := a.marker, a.examActive
	a.mu.Unlock()
	if !active || marker == "" {
		a.awaySince, a.awayReported, a.missingSince, a.missingSent = time.Time{}, false, time.Time{}, false
		return
	}

	fg := a.Sensors.Foreground()
	now := a.now()

	if strings.Contains(strings.ToLower(fg.Title), strings.ToLower(marker)) {
		a.awaySince, a.awayReported = time.Time{}, false
	} else {
		if a.awaySince.IsZero() {
			a.awaySince = now
		}
		if !a.awayReported && now.Sub(a.awaySince) >= 1500*time.Millisecond {
			a.awayReported = true
			a.emit("os_foreground_away", map[string]any{
				"since":   a.awaySince.Unix(),
				"process": fg.Process,
				"title":   truncate(fg.Title, 80),
			})
		}
	}

	// The exam window not being anywhere on the desktop (minimised to nothing, closed, moved off every screen) is a
	// different finding from "something else is in front".
	if a.Sensors.ExamWindowPresent(marker) {
		a.missingSince, a.missingSent = time.Time{}, false
	} else {
		if a.missingSince.IsZero() {
			a.missingSince = now
		}
		if !a.missingSent && now.Sub(a.missingSince) >= 5*time.Second {
			a.missingSent = true
			a.emit("os_exam_window_missing", map[string]any{"since": a.missingSince.Unix()})
		}
	}
}

// watchInjected reports keystrokes / mouse events that came from software (SendInput): the signature of auto-typers
// and macro tools. Only COUNTS are kept — never which keys.
func (a *Agent) watchInjected() {
	keys, mouse := a.Sensors.InjectedInput()
	now := a.now()
	a.injectedWindow = append(a.injectedWindow, injSample{now, keys, mouse})
	for len(a.injectedWindow) > 1 && now.Sub(a.injectedWindow[0].at) > 10*time.Second {
		a.injectedWindow = a.injectedWindow[1:]
	}
	first := a.injectedWindow[0]
	dk, dm := keys-first.keys, mouse-first.mouse

	if (dk >= 15 || dm >= 40) && now.Sub(a.lastInjectedAt) > time.Minute {
		a.lastInjectedAt = now
		a.emit("injected_input", map[string]any{"keys": dk, "mouse": dm, "seconds": 10})
	}
	a.lastKeys, a.lastMouse = keys, mouse
}

func (a *Agent) watchClipboardAndDrives() {
	now := a.now()
	seq := a.Sensors.ClipboardSeq()
	if a.lastClip != 0 && seq != a.lastClip && now.Sub(a.lastClipAt) > 30*time.Second {
		// A copy made while the exam window is NOT in front happened somewhere else.
		a.mu.Lock()
		marker := a.marker
		a.mu.Unlock()
		if fg := a.Sensors.Foreground(); marker != "" && !strings.Contains(strings.ToLower(fg.Title), strings.ToLower(marker)) {
			a.lastClipAt = now
			a.emit("clipboard_outside", map[string]any{"process": fg.Process})
		}
	}
	a.lastClip = seq

	drives := a.Sensors.RemovableDrives()
	if a.lastDrives != 0 && drives > a.lastDrives {
		a.emit("removable_drive_added", map[string]any{"count": drives})
	}
	a.lastDrives = drives
}

// send posts one report. On failure the events stay queued for the next one.
func (a *Agent) send(seq *int64) error {
	a.mu.Lock()
	events := append([]map[string]any(nil), a.events...)
	a.mu.Unlock()

	state := a.state()
	next := *seq + 1
	res, err := a.API.Beat(a.Priv, a.Saved.LinkID, a.Token, next, map[string]any{
		"t":              a.now().UnixMilli(),
		"state":          state,
		"events":         events,
		"policy_version": a.policy.Version,
	})
	if err != nil {
		var se *ServerError
		if errors.As(err, &se) && se.Status == 409 && se.Code == "replayed" && se.LastSeq > 0 {
			*seq = se.LastSeq // we lost count (restart, restored backup): continue after the server's
			return err
		}
		return err
	}

	*seq = next
	a.Saved.Seq = next
	if next%20 == 0 {
		_ = a.Saved.save()
	}

	a.mu.Lock()
	a.events = a.events[len(events):]
	if res.ExamActive && !a.examActive {
		a.tracker.Reset()
		a.awaySince, a.awayReported, a.missingSince, a.missingSent = time.Time{}, false, time.Time{}, false
		a.Log("exam started - watching")
	} else if !res.ExamActive && a.examActive {
		a.Log("exam finished")
	}
	a.examActive = res.ExamActive
	a.marker = res.Marker
	a.mu.Unlock()

	if len(res.Policy) > 0 {
		a.setPolicy(res.Policy)
	}
	return nil
}

// state is the snapshot the server stores (GuardianService::cleanState reduces it to known keys).
func (a *Agent) state() map[string]any {
	st := map[string]any{}
	for k, v := range a.lastSnapshot.State {
		st[k] = v
	}
	st["version"] = a.Version
	st["exe_sha256"] = a.ExeSHA
	st["blockers"] = Blockers(a.lastSnapshot.Findings)

	fg := a.Sensors.Foreground()
	a.mu.Lock()
	marker := a.marker
	a.mu.Unlock()
	st["foreground"] = map[string]any{
		"pid":     fg.PID,
		"process": fg.Process,
		"title":   truncate(fg.Title, 80),
		"is_exam": marker != "" && strings.Contains(strings.ToLower(fg.Title), strings.ToLower(marker)),
	}
	_, offset := a.now().Zone()
	st["tz"] = fmt.Sprintf("UTC%+03d:%02d", offset/3600, abs(offset%3600)/60)
	st["locale"] = ""
	st["clipboard_seq"] = a.Sensors.ClipboardSeq()
	return st
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
