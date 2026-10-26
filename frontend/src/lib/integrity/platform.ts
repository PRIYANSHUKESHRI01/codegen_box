/**
 * Whether this device can run the AptRun Guardian, which watches the Windows operating system. Used only to decide what the
 * Guardian card says (a Mac or a phone is told so, instead of being sent to download something that cannot run) — never as
 * a security signal: the Guardian proves itself to the server, this just spares a student a pointless download.
 */
export function canRunGuardian(): boolean {
  if (typeof navigator === "undefined") return true;

  return /windows/i.test(platformName());
}

/** A Mac computer (macOS), not an iPhone or iPad. */
export function isMac(): boolean {
  return typeof navigator !== "undefined" && /mac/i.test(platformName()) && !/iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
}

function platformName(): string {
  const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;

  return hint || navigator.userAgent || "";
}
