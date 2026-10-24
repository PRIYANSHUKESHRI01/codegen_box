package main

import "strings"

// userFolders are where a library that is not part of a normal install tends to sit.
var userFolders = []string{`\appdata\local\temp\`, `\appdata\roaming\`, `\downloads\`, `\desktop\`, `\users\public\`, `\appdata\local\programs\`}

// suspiciousModulePath reports whether a library loaded into the Guardian comes from a user folder. The Guardian's own
// executable (wherever the student unzipped it) is never suspicious, and neither is anything under Windows or Program Files.
func suspiciousModulePath(lowerPath, lowerSelf string) bool {
	if lowerPath == "" || lowerPath == lowerSelf {
		return false
	}
	if strings.HasPrefix(lowerPath, `c:\windows\`) || strings.HasPrefix(lowerPath, `c:\program files`) {
		return false
	}
	for _, f := range userFolders {
		if strings.Contains(lowerPath, f) {
			return true
		}
	}
	return false
}
