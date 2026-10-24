package main

import "strings"

// Policy is what the server tells the Guardian to look for (config/integrity_denylist.php on the backend). Matching is
// done here, on the student's machine, in lower case. It is shipped as data so the list can be tightened without a new
// installer.
type Policy struct {
	Version        string         `json:"version"`
	BeatMS         int            `json:"beat_ms"`
	Processes      [][]any        `json:"processes"`
	Strings        [][]any        `json:"strings"`
	Titles         [][]any        `json:"titles"`
	OverlayAllowed []string       `json:"overlay_allowed"`
	Browsers       []string       `json:"browsers"`
	Categories     map[string]Cat `json:"categories"`
	// TLSPins are the public-key hashes of the certificates the AptRun server uses; empty = do not check (see tlspin.go).
	TLSPins []string `json:"tls_pins"`
}

// Cat is what a category costs (informational here; the server decides).
type Cat struct {
	Strike int `json:"strike"`
}

// Rule is one decoded denylist entry.
type Rule struct {
	Pattern  string
	Category string
	Strike   int // 0 = use the category's
}

func decode(entries [][]any) []Rule {
	out := make([]Rule, 0, len(entries))
	for _, e := range entries {
		if len(e) < 2 {
			continue
		}
		p, _ := e[0].(string)
		c, _ := e[1].(string)
		if p == "" || c == "" {
			continue
		}
		r := Rule{Pattern: strings.ToLower(p), Category: c}
		if len(e) >= 3 {
			if f, ok := e[2].(float64); ok {
				r.Strike = int(f)
			}
		}
		out = append(out, r)
	}
	return out
}

// Matcher is a compiled Policy.
type Matcher struct {
	procs   map[string]Rule // exact executable name, no ".exe"
	strs    []Rule          // substring of file metadata
	titles  []Rule          // substring of a window title
	overlay map[string]bool
	browser map[string]bool
	Pins    []string
}

func NewMatcher(p Policy) *Matcher {
	m := &Matcher{procs: map[string]Rule{}, overlay: map[string]bool{}, browser: map[string]bool{}, Pins: p.TLSPins}
	for _, r := range decode(p.Processes) {
		m.procs[r.Pattern] = r
	}
	m.strs = decode(p.Strings)
	m.titles = decode(p.Titles)
	for _, o := range p.OverlayAllowed {
		m.overlay[strings.ToLower(o)] = true
	}
	for _, b := range p.Browsers {
		m.browser[strings.ToLower(b)] = true
	}
	return m
}

// ProcName normalises an executable name: lower case, directory and ".exe" removed.
func ProcName(image string) string {
	n := strings.ToLower(image)
	if i := strings.LastIndexAny(n, `\/`); i >= 0 {
		n = n[i+1:]
	}
	return strings.TrimSuffix(n, ".exe")
}

// Process reports whether an executable name is on the list.
func (m *Matcher) Process(name string) (Rule, bool) {
	r, ok := m.procs[ProcName(name)]
	return r, ok
}

// Metadata checks a file's own ProductName / OriginalFilename / FileDescription — what survives renaming the .exe.
func (m *Matcher) Metadata(fields ...string) (Rule, bool) {
	joined := strings.ToLower(strings.Join(fields, "\n"))
	if joined == "" {
		return Rule{}, false
	}
	for _, r := range m.strs {
		if strings.Contains(joined, r.Pattern) {
			return r, true
		}
	}
	return Rule{}, false
}

// Title checks a window title.
func (m *Matcher) Title(title string) (Rule, bool) {
	t := strings.ToLower(title)
	if t == "" {
		return Rule{}, false
	}
	for _, r := range m.titles {
		if strings.Contains(t, r.Pattern) {
			return r, true
		}
	}
	return Rule{}, false
}

func (m *Matcher) IsBrowser(image string) bool      { return m.browser[ProcName(image)] }
func (m *Matcher) OverlayAllowed(image string) bool { return m.overlay[ProcName(image)] }
