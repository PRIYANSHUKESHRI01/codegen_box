"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, Copy, Download, ExternalLink, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { canRunGuardian } from "@/lib/integrity/platform";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { CheckStatus, PreflightCheck } from "@/lib/integrity/types";

const ICON: Record<CheckStatus, { icon: typeof Circle; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-status-success" },
  skipped: { icon: CheckCircle2, className: "text-text-muted" },
  fail: { icon: XCircle, className: "text-status-danger" },
  warn: { icon: AlertTriangle, className: "text-status-warning" },
  working: { icon: Loader2, className: "text-accent-primary animate-spin" },
  pending: { icon: Circle, className: "text-text-muted" },
};

/**
 * The pre-start system check: what this attempt needs, what passed, what to fix. Every row is a real check the engine
 * ran — nothing here is decoration — and the Start button stays disabled until every REQUIRED row is green, so a student
 * finds out what is wrong now, with nothing held against them, instead of mid-attempt as a strike.
 */
export function IntegrityChecklist({ onEnableDevices }: { onEnableDevices: () => void }) {
  const ui = useIntegrityUi();
  if (ui.checks.length === 0) return null;

  return (
    <div className="space-y-2" role="list" aria-label="System check">
      <div className="flex items-center justify-between">
        <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">System check</h3>
        <span className="text-3xs text-text-muted">{ui.checks.filter((c) => c.status === "ok" || c.status === "skipped").length}/{ui.checks.length} ready</span>
      </div>

      {ui.checks.map((c) => (
        <CheckRow key={c.id} check={c} onEnableDevices={onEnableDevices} actions={ui.actions} />
      ))}

      {ui.guardian.mode !== "off" && ui.checks.some((c) => c.id === "guardian") && <GuardianCard />}
    </div>
  );
}

function CheckRow({ check, onEnableDevices, actions }: { check: PreflightCheck; onEnableDevices: () => void; actions: ReturnType<typeof useIntegrityUi>["actions"] }) {
  const { icon: Icon, className } = ICON[check.status];
  const actionable = check.status === "pending" || check.status === "fail";

  const button =
    check.id === "camera" ? { label: check.status === "fail" ? "Try again" : "Enable", run: onEnableDevices }
    : check.id === "screen" ? { label: check.status === "fail" ? "Try again" : "Share screen", run: () => actions?.shareScreen() }
    : check.id === "guardian" ? { label: "Connect", run: () => actions?.connectGuardian() }
    : null;

  return (
    <div role="listitem" className="flex items-start gap-2.5 rounded-control border border-border-subtle bg-elevated/40 px-3 py-2">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-primary">
          {check.label}
          {!check.required && check.status !== "ok" && <span className="ml-1.5 text-3xs font-medium text-text-muted">optional</span>}
        </p>
        {check.detail && <p className={cn("text-2xs", check.status === "fail" ? "text-status-danger" : "text-text-muted")}>{check.detail}</p>}
        {check.fix && actionable && <p className="mt-0.5 text-2xs text-text-secondary">{check.fix}</p>}
      </div>
      {button && actionable && (
        <button
          type="button"
          onClick={button.run}
          className="shrink-0 rounded-control border border-accent-primary/40 bg-accent-primary/10 px-2.5 py-1 text-2xs font-bold text-accent-primary transition-colors hover:bg-accent-primary/20"
        >
          {button.label}
        </button>
      )}
    </div>
  );
}

/** After this long with no Guardian, stop showing a bare spinner and say what to actually do. */
const HELP_AFTER_MS = 15_000;

function GuardianCard() {
  const ui = useIntegrityUi();
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { pairing, summary, busy, error, mode } = ui.guardian;

  // The spinner only means something while the code is alive; tick once a second to know when it is not, and when to offer help.
  const [shownAt, setShownAt] = useState(() => Date.now());
  const code = pairing?.code;
  useEffect(() => {
    if (!code) return;
    setShownAt(Date.now());
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [code]);

  if (summary?.connected && summary.blockers.length === 0 && !summary.outdated) return null;

  const expiresAt = pairing ? Date.parse(pairing.expiresAt) : NaN;
  const secondsLeft = Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  const expired = secondsLeft === 0;
  const needsHelp = !expired && now - shownAt >= HELP_AFTER_MS;
  const downloadUrl = pairing?.downloadUrl || summary?.download_url || "";
  const download = summary?.download ?? null;
  const windows = canRunGuardian();

  const copy = async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the code is on screen to read */
    }
  };

  return (
    <div className="space-y-2.5 rounded-control border border-accent-primary/25 bg-accent-primary/5 p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent-primary" aria-hidden />
        <p className="text-xs font-bold text-primary">AptRun Guardian</p>
      </div>
      <p className="text-2xs text-text-secondary">
        A small program for Windows that runs next to this page and reports which programs and windows are open. It does not read your files, messages or browsing.
      </p>

      {summary && summary.blockers.length > 0 && (
        <ul className="space-y-1">
          {summary.blockers.map((b) => (
            <li key={b.type + (b.detail ?? "")} className="rounded border border-status-danger/25 bg-status-danger/10 px-2 py-1.5 text-2xs">
              <span className="font-bold text-status-danger">{b.title}</span>
              {b.detail && <span className="text-status-danger"> — {b.detail}</span>}
              <span className="block text-text-secondary">{b.fix}</span>
            </li>
          ))}
        </ul>
      )}

      {!windows ? (
        <p className="rounded border border-border-subtle bg-surface/60 p-2 text-2xs text-text-secondary">
          The Guardian runs on <strong>Windows</strong>, so it can&apos;t be used on this device.{" "}
          {mode === "required"
            ? "This test needs it: please use a Windows computer, or ask your college which computer to use."
            : "It is optional for this test, so you can continue without it."}
        </p>
      ) : (
        <div className="space-y-3">
          <Step n={1} title="Install it (once on this computer)">
            {downloadUrl ? (
              <>
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-control border border-accent-primary/40 bg-accent-primary/10 px-3 py-1.5 text-2xs font-bold text-accent-primary transition-colors hover:bg-accent-primary/20"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download for Windows
                </a>
                {download && (
                  <p className="text-3xs text-text-muted">
                    aptrun-guardian.exe{download.version ? ` · v${download.version}` : ""} · {formatSize(download.size)}
                  </p>
                )}
                <p className="text-2xs text-text-secondary">
                  Open the downloaded <strong>aptrun-guardian.exe</strong> (double-click it). It asks for the code from step 2 and sets itself up, so you only do this once. Already did? Go to step 2.
                </p>
                <details className="text-3xs text-text-muted">
                  <summary className="cursor-pointer font-semibold text-text-secondary">Windows or your browser warns about the file?</summary>
                  <p className="mt-1">
                    Windows shows &ldquo;Windows protected your PC&rdquo; for programs it has not seen many times. Choose <strong>More info</strong>, then <strong>Run anyway</strong>. In Chrome, use the download&apos;s menu → <strong>Keep</strong>.
                  </p>
                  {download?.sha256 && (
                    <p className="mt-1 break-all">
                      To check the file, its SHA-256 is <span className="font-mono">{download.sha256}</span> (in PowerShell: <span className="font-mono">Get-FileHash aptrun-guardian.exe</span>).
                    </p>
                  )}
                </details>
              </>
            ) : (
              <p className="text-2xs text-text-secondary">
                Ask your college for the AptRun Guardian (<strong>aptrun-guardian.exe</strong>) and open it once. Already have it? Go to step 2.
              </p>
            )}
          </Step>

          <Step n={2} title="Get a pairing code">
            {!pairing ? (
              <Button variant="outline" onClick={() => ui.actions?.connectGuardian()} isLoading={busy} fullWidth>
                {summary?.connected ? "Reconnect the Guardian" : "Get a pairing code"}
              </Button>
            ) : (
              <>
                <p className="text-2xs text-text-secondary">
                  {expired ? "This code has expired." : `Enter this code in the Guardian${secondsLeft !== null ? ` (valid for ${formatLeft(secondsLeft)})` : ""}:`}
                </p>
                <div className="flex items-center gap-2">
                  <code className={cn("flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-center font-mono text-base font-extrabold tracking-[0.25em] text-primary", expired && "line-through opacity-50")}>{pairing.code}</code>
                  <button type="button" onClick={copy} disabled={expired} className="rounded-control border border-border-strong p-2 text-text-muted hover:text-primary disabled:opacity-40" aria-label="Copy code">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                {expired && (
                  <Button variant="outline" onClick={() => ui.actions?.connectGuardian()} isLoading={busy} fullWidth>
                    Get a new code
                  </Button>
                )}
              </>
            )}
          </Step>

          {pairing && !expired && (
            <Step n={3} title="Open the Guardian and enter the code">
              <a href={pairing.deepLink} className="inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline">
                <ExternalLink className="h-3 w-3" aria-hidden /> Open Guardian
              </a>
              <p className="text-2xs text-text-secondary">If your browser asks, allow it to open AptRun Guardian. Keep the Guardian window open for the whole test.</p>
              <p className="flex items-center gap-1.5 text-3xs text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Waiting for the Guardian to connect…
              </p>

              {needsHelp && (
                <div className="rounded border border-border-subtle bg-surface/60 p-2 text-2xs text-text-secondary">
                  <p className="font-bold text-primary">Nothing happening?</p>
                  <p className="mt-0.5">
                    This page cannot start the Guardian by itself — it is a separate program for Windows. It does nothing until it is running on this computer and has been given the code above.
                  </p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                    <li>{downloadUrl ? "Download the Guardian (step 1) and double-click it." : "Ask your college for the AptRun Guardian (aptrun-guardian.exe) and double-click it."}</li>
                    <li>When it asks, type the code above. (Once it has been run, <strong>Open Guardian</strong> does this for you.)</li>
                    <li>Leave its window open. This page notices within a few seconds.</li>
                  </ol>
                </div>
              )}
            </Step>
          )}
        </div>
      )}

      {error && <p className="text-2xs text-status-danger">{error}</p>}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-3xs font-extrabold text-accent-primary" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-2xs font-bold text-primary">{title}</p>
        {children}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLeft(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
}
