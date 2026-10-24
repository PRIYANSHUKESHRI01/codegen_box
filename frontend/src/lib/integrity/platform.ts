/**
 * Whether this device can run the AptRun Guardian, which watches the Windows operating system. Used only to decide what the
 * Guardian card says (a Mac or a phone is told so, instead of being sent to download something that cannot run) — never as
 * a security signal: the Guardian proves itself to the server, this just spares a student a pointless download.
 */
export function canRunGuardian(): boolean {
  if (typeof navigator === "undefined") return true;

  const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  if (hint) return /windows/i.test(hint);

  return /windows/i.test(navigator.userAgent || "");
}
