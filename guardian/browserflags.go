package main

import "strings"

// riskyFlags are the start-up options that matter. Matched as "--name" or "--name=value", case-insensitively.
var riskyFlags = []string{
	"--remote-debugging-port", "--remote-debugging-pipe", "--remote-allow-origins", "--enable-automation",
	"--load-extension", "--disable-extensions-except", "--proxy-server", "--proxy-pac-url", "--no-proxy-server",
	"--disable-web-security", "--ignore-certificate-errors", "--allow-insecure-localhost", "--host-resolver-rules", "--host-rules",
	"--auto-open-devtools-for-tabs", "--allow-running-insecure-content", "--disable-site-isolation-trials",
}

// riskyBrowserFlags lists the risky options present in a browser's MAIN-process command line (helper processes carry
// `--type=…` and are ignored). Pure, so it is tested without a browser.
func riskyBrowserFlags(cmd string) []string {
	lower := strings.ToLower(cmd)
	if lower == "" || strings.Contains(lower, " --type=") {
		return nil
	}
	var found []string
	for _, f := range strings.Fields(lower) {
		name := f
		if i := strings.Index(f, "="); i >= 0 {
			name = f[:i]
		}
		for _, risky := range riskyFlags {
			if name == risky {
				found = append(found, risky)
				break
			}
		}
	}
	return found
}
