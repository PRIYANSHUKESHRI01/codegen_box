package main

import "sync"

// Finding is one thing the scanners saw that the server may care about.
type Finding struct {
	// Key is the finding's identity ("forbidden_process:anydesk"): the same key is reported once per exam, not on every scan.
	Key string
	// Type is the server's event type (see EventCatalog on the backend; the Guardian may only send guardian-sourced types).
	Type string
	Data map[string]any
	// Blocker findings are listed in the state as pre-flight blockers, so the exam page can tell the student what to fix
	// BEFORE they start (and cost nothing).
	Blocker bool
}

// Snapshot is the result of one slow scan.
type Snapshot struct {
	State    map[string]any
	Findings []Finding
}

// Tracker turns "what is true right now" into "what is new": every finding becomes one event, once.
type Tracker struct {
	mu       sync.Mutex
	reported map[string]bool
}

func NewTracker() *Tracker { return &Tracker{reported: map[string]bool{}} }

// Fresh returns the findings not reported yet and remembers them.
func (t *Tracker) Fresh(fs []Finding) []Finding {
	t.mu.Lock()
	defer t.mu.Unlock()
	var out []Finding
	for _, f := range fs {
		if !t.reported[f.Key] {
			t.reported[f.Key] = true
			out = append(out, f)
		}
	}
	return out
}

// Reset forgets everything (a new exam started).
func (t *Tracker) Reset() {
	t.mu.Lock()
	t.reported = map[string]bool{}
	t.mu.Unlock()
}

// Blockers lists the pre-flight blockers among findings, in the shape the server expects in state.blockers.
func Blockers(fs []Finding) []map[string]any {
	out := make([]map[string]any, 0)
	seen := map[string]bool{}
	for _, f := range fs {
		if !f.Blocker || seen[f.Key] {
			continue
		}
		seen[f.Key] = true
		b := map[string]any{"type": f.Type}
		if n, ok := f.Data["name"].(string); ok {
			b["name"] = n
		}
		if c, ok := f.Data["category"].(string); ok {
			b["category"] = c
		}
		out = append(out, b)
		if len(out) >= 12 {
			break
		}
	}
	return out
}
