package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Set at build time:  -ldflags "-X main.version=1.0.0 -X main.defaultAPI=https://api.example.com/api"
var (
	version    = "1.0.0"
	defaultAPI = ""
)

const usage = `AptRun Guardian %s

Runs next to your exam page and reports what your computer is doing (which programs and windows are open, how many
screens, your network settings) so a patched web page cannot hide it. It never reads your files, messages or keystrokes.

  aptrun-guardian                      start (asks for the code on your exam page the first time)
  aptrun-guardian aptrun-guardian://...  opened from the exam page's "Open Guardian" link
  aptrun-guardian --code ABCD-EFGH     pair with a code, then start
  aptrun-guardian --api URL            the AptRun server (default %q)
  aptrun-guardian --install            register the "Open Guardian" link on this computer
  aptrun-guardian --uninstall          remove it
  aptrun-guardian --forget             disconnect and delete the saved identity
  aptrun-guardian --check              look at this computer once and print what would block an exam
  aptrun-guardian --dump               print everything the Guardian would report (for support)
`

func main() {
	var (
		code      = flag.String("code", "", "pairing code from the exam page")
		api       = flag.String("api", "", "AptRun server URL, e.g. https://api.example.com/api")
		install   = flag.Bool("install", false, "register the aptrun-guardian:// link")
		uninstall = flag.Bool("uninstall", false, "remove the aptrun-guardian:// link")
		forget    = flag.Bool("forget", false, "disconnect and delete the saved identity")
		check     = flag.Bool("check", false, "scan once and print the result")
		dump      = flag.Bool("dump", false, "scan once and print everything the Guardian would report (for support)")
		showVer   = flag.Bool("version", false, "print the version")
	)
	flag.Usage = func() { fmt.Fprintf(os.Stderr, usage, version, defaultAPI) }
	flag.Parse()

	if *showVer {
		fmt.Println(version)
		return
	}
	if runtime.GOOS != "windows" {
		fmt.Println("The AptRun Guardian is available for Windows.")
		os.Exit(1)
	}

	// An aptrun-guardian://pair?code=…&api=… link, as opened by the browser.
	for _, a := range flag.Args() {
		if u, err := url.Parse(a); err == nil && u.Scheme == "aptrun-guardian" {
			q := u.Query()
			if *code == "" {
				*code = q.Get("code")
			}
			if *api == "" {
				*api = q.Get("api")
			}
		}
	}

	switch {
	case *install:
		where, err := installProtocol()
		exitOn(err)
		fmt.Printf("Done. The \"Open Guardian\" button on exam pages now opens %s\n", where)
		return
	case *uninstall:
		exitOn(uninstallProtocol())
		fmt.Println("Removed.")
		return
	case *forget:
		exitOn(forgetIdentity())
		return
	case *check:
		exitOn(checkOnce(false))
		return
	case *dump:
		exitOn(checkOnce(true))
		return
	}

	exitOn(run(*code, *api))
}

func exitOn(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "\n"+err.Error())
		fmt.Fprint(os.Stderr, "\nPress Enter to close this window… ")
		_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
		os.Exit(1)
	}
}

func logf(format string, args ...any) {
	fmt.Printf("[%s] %s\n", time.Now().Format("15:04:05"), fmt.Sprintf(format, args...))
}

// exeSHA256 is the hash of this very program; the server compares it with the released builds.
func exeSHA256() string {
	path, err := os.Executable()
	if err != nil {
		return ""
	}
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return ""
	}
	return hex.EncodeToString(h.Sum(nil))
}

func resolveAPI(flagValue string, saved *Saved) string {
	for _, v := range []string{flagValue, os.Getenv("APTRUN_API"), configFileAPI(), saved.API, defaultAPI} {
		if strings.TrimSpace(v) != "" {
			return strings.TrimRight(strings.TrimSpace(v), "/")
		}
	}
	return ""
}

// configFileAPI reads guardian.json next to the executable: {"api": "https://…"}, so one installer can be preset per college.
func configFileAPI() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(exe), "guardian.json"))
	if err != nil {
		return ""
	}
	s := string(raw)
	i := strings.Index(s, `"api"`)
	if i < 0 {
		return ""
	}
	s = s[i+5:]
	a := strings.Index(s, `"`)
	if a < 0 {
		return ""
	}
	s = s[a+1:]
	b := strings.Index(s, `"`)
	if b < 0 {
		return ""
	}
	return s[:b]
}

func run(code, apiFlag string) error {
	if !singleInstance() {
		return errors.New("The AptRun Guardian is already running (look for its other window).")
	}

	saved, err := loadSaved()
	if err != nil {
		return err
	}
	apiBase := resolveAPI(apiFlag, saved)
	if apiBase == "" {
		return errors.New("This copy of the Guardian does not know which AptRun server to talk to.\nStart it from the \"Open Guardian\" button on your exam page, or run: aptrun-guardian --api https://...")
	}
	saved.API = apiBase
	api := NewAPI(apiBase)

	priv, err := saved.ensureKey()
	if err != nil {
		return err
	}

	fmt.Printf("AptRun Guardian %s\n", version)
	exe := exeSHA256()

	// First run from the Downloads folder (or after a newer download): keep a copy here and point the exam page's "Open Guardian"
	// button at it, so the next time the student does not have to find the file. Never stops the student from connecting.
	// (A lab that deploys the program itself, or a test rig, sets APTRUN_NO_SELF_INSTALL=1 to keep it from touching the user's folder and registry.)
	if self, err := os.Executable(); err == nil && os.Getenv("APTRUN_NO_SELF_INSTALL") == "" && !samePath(self, installedExe()) {
		if where, err := installProtocol(); err == nil {
			fmt.Printf("The \"Open Guardian\" button on your exam pages now opens this program (%s).\n", where)
		}
	}

	token, ok := saved.token()
	if !ok || saved.LinkID == 0 || code != "" {
		if code == "" {
			fmt.Print("Enter the code shown on your exam page: ")
			line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
			code = strings.TrimSpace(line)
		}
		if code == "" {
			return errors.New("A pairing code is needed. Open your exam page and choose \"Connect\" next to AptRun Guardian.")
		}

		res, err := api.Pair(code, saved, version, exe, machineInfo())
		if err != nil {
			return friendly(err)
		}
		saved.LinkID, saved.Name, saved.Seq = res.LinkID, res.User.Name, 0
		if err := saved.setToken(res.Token); err != nil {
			return err
		}
		if len(res.Policy) > 0 {
			saved.PolicyJSON = string(res.Policy)
		}
		token = res.Token
		if err := saved.save(); err != nil {
			return err
		}
	}

	fmt.Printf("Connected as %s. Keep this window open while you take your exam.\n", saved.Name)

	sensors := newSensors(apiBase)
	defer sensors.Close()

	agent := NewAgent(api, saved, priv, token, sensors, version, exe, logf)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	logf("watching")
	err = agent.Run(ctx)
	_ = saved.save()
	if err != nil {
		return friendly(err)
	}
	return nil
}

func friendly(err error) error {
	var se *ServerError
	if errors.As(err, &se) {
		switch se.Code {
		case "invalid_code":
			return errors.New("That code is not valid or has expired. Get a new one from your exam page.")
		case "link_invalid", "guardian_revoked":
			return errors.New("This Guardian is no longer connected. Run it again and enter a new code from your exam page.")
		case "guardian_build_not_allowed", "guardian_outdated":
			return errors.New(se.Message)
		}
		if se.Message != "" {
			return errors.New(se.Message)
		}
	}
	return err
}

func forgetIdentity() error {
	saved, _ := loadSaved()
	if saved.LinkID != 0 {
		if priv, err := saved.ensureKey(); err == nil {
			if token, ok := saved.token(); ok && saved.API != "" {
				_ = NewAPI(saved.API).Unpair(priv, saved.LinkID, token, saved.Seq+1)
			}
		}
	}
	if err := clearState(); err != nil {
		return err
	}
	fmt.Println("Disconnected, and the saved identity was deleted.")
	return nil
}

// checkOnce prints what a scan finds, using the saved policy (or an empty one). Nothing is sent anywhere.
func checkOnce(full bool) error {
	saved, _ := loadSaved()
	agent := NewAgent(nil, saved, nil, "", newSensors(saved.API), version, exeSHA256(), logf)
	snap := agent.Sensors.Scan(agent.matcher, "")

	if full {
		raw, _ := json.MarshalIndent(map[string]any{"state": snap.State, "findings": snap.Findings}, "", "  ")
		fmt.Println(string(raw))
		return nil
	}

	blockers := Blockers(snap.Findings)
	if len(blockers) == 0 {
		fmt.Println("Nothing on this computer would stop you from starting an exam.")
	}
	for _, b := range blockers {
		fmt.Printf("  ✗ %v %v\n", b["type"], b["name"])
	}
	for _, f := range snap.Findings {
		if !f.Blocker {
			fmt.Printf("  · (noted) %s %v\n", f.Type, f.Data["name"])
		}
	}
	return nil
}

func machineInfo() map[string]any {
	host, _ := os.Hostname()
	sum := sha256.Sum256([]byte(host))
	return map[string]any{"os": runtime.GOOS, "arch": runtime.GOARCH, "host": hex.EncodeToString(sum[:4])}
}
