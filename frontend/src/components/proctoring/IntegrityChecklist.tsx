"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MonitorUp,
  Monitor,
  ShieldCheck,
  Wifi,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { canRunGuardian } from "@/lib/integrity/platform";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { CheckStatus, PreflightCheck } from "@/lib/integrity/types";

/** What each check is about, so a row says it at a glance before the student reads a word. */
const KIND_ICON: Record<PreflightCheck["id"], LucideIcon> = {
  browser: Globe,
  tamper: Lock,
  automation: Bot,
  camera: Camera,
  mic: Camera,
  display: Monitor,
  screen: MonitorUp,
  network: Wifi,
  guardian: ShieldCheck,
};

const ROW_TONE: Record<CheckStatus, string> = {
  ok: "border-status-success/25 bg-status-success/[0.06]",
  skipped: "border-border-subtle bg-elevated/40",
  fail: "border-status-danger/35 bg-status-danger/[0.06]",
  warn: "border-status-warning/35 bg-status-warning/[0.07]",
  working: "border-accent-primary/30 bg-accent-primary/[0.05]",
  pending: "border-border-subtle bg-surface hover:border-border-strong",
};

const isDone = (status: CheckStatus) => status === "ok" || status === "skipped";

/**
 * The pre-start system check: what this attempt needs, what passed, what to fix. Every row is a real check the engine
 * ran — nothing here is decoration — and the Start button stays disabled until every REQUIRED row is green, so a student
 * finds out what is wrong now, with nothing held against them, instead of mid-attempt as a strike.
 */
export function IntegrityChecklist({ onEnableDevices }: { onEnableDevices: () => void }) {
  const ui = useIntegrityUi();
  const reduceMotion = useReducedMotion();
  if (ui.checks.length === 0) return null;

  const ready = ui.checks.filter((c) => isDone(c.status)).length;
  const total = ui.checks.length;
  const allReady = ready === total;
  // The Guardian's row and its set-up steps are one thing: the steps hang straight off the row instead of repeating its title.
  const guardianCard = ui.guardian.mode !== "off" && ui.checks.some((c) => c.id === "guardian") && !(ui.guardian.summary?.connected && ui.guardian.summary.blockers.length === 0 && !ui.guardian.summary.outdated);

  return (
    <div className="space-y-3" role="list" aria-label="System check">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">System check</h3>
          <span className={cn("text-2xs font-bold tabular-nums transition-colors", allReady ? "text-status-success" : "text-text-muted")} aria-live="polite">
            {ready}/{total} ready
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="System check progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ready}
          className="h-1.5 overflow-hidden rounded-full bg-elevated"
        >
          <motion.div
            className={cn("h-full rounded-full", allReady ? "bg-status-success" : "bg-accent-primary")}
            initial={false}
            animate={{ width: `${(ready / total) * 100}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}
          />
        </div>
      </div>

      {ui.checks.map((c) => (
        <CheckRow key={c.id} check={c} onEnableDevices={onEnableDevices} actions={ui.actions} attached={c.id === "guardian" && guardianCard} />
      ))}

      {guardianCard && <GuardianCard />}
    </div>
  );
}

/** The square at the left of a row: the check's own icon while it waits, a spinner while it runs, a tick or a cross when it has an answer. */
function StatusTile({ check }: { check: PreflightCheck }) {
  const reduceMotion = useReducedMotion();
  const Kind = KIND_ICON[check.id];
  const { status } = check;

  const content =
    status === "ok" ? <CheckCircle2 className="h-5 w-5" aria-hidden />
    : status === "skipped" ? <Check className="h-[1.125rem] w-[1.125rem]" aria-hidden />
    : status === "fail" ? <XCircle className="h-5 w-5" aria-hidden />
    : status === "warn" ? <AlertTriangle className="h-5 w-5" aria-hidden />
    : status === "working" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
    : <Kind className="h-[1.125rem] w-[1.125rem]" aria-hidden />;

  const tone =
    status === "ok" ? "bg-status-success/15 text-status-success"
    : status === "skipped" ? "bg-elevated text-text-muted"
    : status === "fail" ? "bg-status-danger/15 text-status-danger"
    : status === "warn" ? "bg-status-warning/20 text-status-warning"
    : status === "working" ? "bg-accent-primary/15 text-accent-primary"
    : "bg-elevated text-text-secondary";

  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200", tone)}>
      <motion.span
        key={status}
        className="flex items-center justify-center"
        initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 24 }}
      >
        {content}
      </motion.span>
    </span>
  );
}

function CheckRow({ check, onEnableDevices, actions, attached = false }: { check: PreflightCheck; onEnableDevices: () => void; actions: ReturnType<typeof useIntegrityUi>["actions"]; attached?: boolean }) {
  const actionable = check.status === "pending" || check.status === "fail";
  const failed = check.status === "fail";

  const button =
    check.id === "camera" ? { label: failed ? "Try again" : "Enable", run: onEnableDevices }
    : check.id === "screen" ? { label: failed ? "Try again" : "Share screen", run: () => actions?.shareScreen() }
    : check.id === "guardian" ? { label: "Connect", run: () => actions?.connectGuardian() }
    : null;

  return (
    <div role="listitem" className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-200", ROW_TONE[check.status], attached && "!mb-0 rounded-b-none border-b-0")}>
      <StatusTile check={check} />
      <div className="min-w-0 flex-1 self-center">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold leading-tight text-primary">
          {check.label}
          {!isDone(check.status) && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[0.625rem] font-bold uppercase tracking-wide",
                check.required ? "bg-accent-primary/10 text-accent-primary" : "bg-elevated text-text-muted"
              )}
            >
              {check.required ? "Required" : "Optional"}
            </span>
          )}
        </p>
        {check.detail && <p className={cn("mt-0.5 text-2xs leading-snug", failed ? "text-status-danger" : "text-text-muted")}>{check.detail}</p>}
        {check.fix && actionable && <p className="mt-0.5 text-2xs leading-snug text-text-secondary">{check.fix}</p>}
      </div>
      {button && actionable && (
        <button
          type="button"
          onClick={button.run}
          className={cn(
            "shrink-0 self-center rounded-lg border px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
            failed
              ? "border-status-danger/40 bg-status-danger/10 text-status-danger hover:bg-status-danger/20"
              : "border-transparent bg-accent-primary text-white shadow-subtle hover:opacity-90"
          )}
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
    <div className="!mt-0 space-y-3.5 rounded-b-xl border border-t border-dashed border-accent-primary/25 bg-gradient-to-b from-accent-primary/[0.07] to-accent-primary/[0.02] p-4">
      <p className="text-2xs leading-relaxed text-text-secondary">
        A small program for Windows that runs next to this page and reports which programs and windows are open. It does not read your files, messages or browsing.
      </p>

      {summary && summary.blockers.length > 0 && (
        <ul className="space-y-1.5">
          {summary.blockers.map((b) => (
            <li key={b.type + (b.detail ?? "")} className="rounded-lg border border-status-danger/25 bg-status-danger/10 px-3 py-2 text-2xs">
              <span className="font-bold text-status-danger">{b.title}</span>
              {b.detail && <span className="text-status-danger"> — {b.detail}</span>}
              <span className="block text-text-secondary">{b.fix}</span>
            </li>
          ))}
        </ul>
      )}

      {!windows ? (
        <p className="rounded-lg border border-border-subtle bg-surface/70 p-3 text-2xs leading-relaxed text-text-secondary">
          The Guardian runs on <strong>Windows</strong>, so it can&apos;t be used on this device.{" "}
          {mode === "required"
            ? "This test needs it: please use a Windows computer, or ask your college which computer to use."
            : "It is optional for this test, so you can continue without it."}
        </p>
      ) : (
        <ol className="space-y-0">
          <Step n={1} title="Install it (once on this computer)">
            {downloadUrl ? (
              <>
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent-primary/40 bg-accent-primary/10 px-3.5 py-2 text-xs font-bold text-accent-primary transition-all hover:bg-accent-primary/20 active:scale-[0.97]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download for Windows
                </a>
                {download && (
                  <p className="text-3xs text-text-muted">
                    aptrun-guardian.exe{download.version ? ` · v${download.version}` : ""} · {formatSize(download.size)}
                  </p>
                )}
                <p className="text-2xs leading-relaxed text-text-secondary">
                  Open the downloaded <strong>aptrun-guardian.exe</strong> (double-click it). It asks for the code from step 2 and sets itself up, so you only do this once. Already did? Go to step 2.
                </p>
                <details className="rounded-lg text-3xs text-text-muted">
                  <summary className="cursor-pointer font-semibold text-text-secondary hover:text-primary">Windows or your browser warns about the file?</summary>
                  <p className="mt-1 leading-relaxed">
                    Windows shows &ldquo;Windows protected your PC&rdquo; for programs it has not seen many times. Choose <strong>More info</strong>, then <strong>Run anyway</strong>. In Chrome, use the download&apos;s menu → <strong>Keep</strong>.
                  </p>
                  {download?.sha256 && (
                    <p className="mt-1 break-all leading-relaxed">
                      To check the file, its SHA-256 is <span className="font-mono">{download.sha256}</span> (in PowerShell: <span className="font-mono">Get-FileHash aptrun-guardian.exe</span>).
                    </p>
                  )}
                </details>
              </>
            ) : (
              <p className="text-2xs leading-relaxed text-text-secondary">
                Ask your college for the AptRun Guardian (<strong>aptrun-guardian.exe</strong>) and open it once. Already have it? Go to step 2.
              </p>
            )}
          </Step>

          <Step n={2} title="Get a pairing code" last={!pairing || expired}>
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
                  <code
                    className={cn(
                      "flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-center font-mono text-lg font-extrabold tracking-[0.28em] text-primary shadow-inner",
                      expired && "line-through opacity-50"
                    )}
                  >
                    {pairing.code}
                  </code>
                  <button
                    type="button"
                    onClick={copy}
                    disabled={expired}
                    className="rounded-xl border border-border-strong p-2.5 text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-40"
                    aria-label="Copy code"
                  >
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
            <Step n={3} title="Open the Guardian and enter the code" last>
              <a href={pairing.deepLink} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open Guardian
              </a>
              <p className="text-2xs leading-relaxed text-text-secondary">If your browser asks, allow it to open AptRun Guardian. Keep the Guardian window open for the whole test.</p>
              <p className="flex items-center gap-1.5 text-3xs text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Waiting for the Guardian to connect…
              </p>

              {needsHelp && (
                <div className="rounded-lg border border-border-subtle bg-surface/70 p-3 text-2xs text-text-secondary">
                  <p className="font-bold text-primary">Nothing happening?</p>
                  <p className="mt-0.5 leading-relaxed">
                    This page cannot start the Guardian by itself — it is a separate program for Windows. It does nothing until it is running on this computer and has been given the code above.
                  </p>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 leading-relaxed">
                    <li>{downloadUrl ? "Download the Guardian (step 1) and double-click it." : "Ask your college for the AptRun Guardian (aptrun-guardian.exe) and double-click it."}</li>
                    <li>When it asks, type the code above. (Once it has been run, <strong>Open Guardian</strong> does this for you.)</li>
                    <li>Leave its window open. This page notices within a few seconds.</li>
                  </ol>
                </div>
              )}
            </Step>
          )}
        </ol>
      )}

      {error && <p className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">{error}</p>}
    </div>
  );
}

/** One numbered step of the Guardian set-up, joined to the next by a line so the order reads at a glance. */
function Step({ n, title, children, last = false }: { n: number; title: string; children: ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden className="absolute left-[0.6875rem] top-6 h-[calc(100%-1.5rem)] w-px bg-accent-primary/20" />}
      <span className="relative z-10 mt-px flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-accent-primary text-[0.6875rem] font-extrabold text-white" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-bold text-primary">{title}</p>
        {children}
      </div>
    </li>
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
