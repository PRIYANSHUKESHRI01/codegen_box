"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuardCounters, GuardMode, GuardStatus } from "@/lib/projectLabGuard";

interface AuthorshipChipProps {
  status: GuardStatus;
  mode: GuardMode;
  counters: GuardCounters;
  onReloadEditor: () => void;
  /** Stop and start the workspace, which brings it up on the current editor (files are kept). */
  onRestartWorkspace: () => void;
  restarting: boolean;
}

/**
 * "Authorship protection": the top-bar chip that tells a student the rule BEFORE they trip over it, shows what the
 * guard did this session, and turns amber if the guard stops answering. Being open about the rule (and about what is
 * recorded) is part of how it works: a student who knows pasting is refused and noted does not try.
 */
export function AuthorshipChip({ status, mode, counters, onReloadEditor, onRestartWorkspace, restarting }: AuthorshipChipProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "off" || mode === "open") return null;

  const outdated = status === "outdated";
  const missing = status === "missing" || outdated;
  const Icon = missing ? ShieldAlert : status === "active" ? ShieldCheck : Shield;
  const label = outdated ? "Update needed" : missing ? "Protection not responding" : "You write the code";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Authorship protection: pasting from outside your workspace is turned off"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-2xs font-bold transition-colors",
          missing
            ? "border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300"
            : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", !missing && status === "active" && "text-emerald-500", status === "starting" && "animate-pulse")} aria-hidden />
        <span className="hidden xl:inline">{label}</span>
        <span className="sr-only xl:hidden">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="About authorship protection"
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,340px)] rounded-panel border border-border-subtle bg-surface p-4 text-left shadow-card"
        >
          <p className="text-xs font-extrabold text-primary">{outdated ? "Your workspace needs an update" : missing ? "The protection isn’t responding" : "You write the code here"}</p>

          {outdated ? (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                This workspace was started with an older editor that doesn’t have the paste protection, so pasting from outside is <strong className="text-primary">not</strong>{" "}
                being stopped and your reviewer will see that. Restart it to update: your files are kept and it takes about half a minute. If it still shows this
                afterwards, a browser extension may be blocking the protection.
              </p>
              <button
                type="button"
                disabled={restarting}
                onClick={() => {
                  setOpen(false);
                  onRestartWorkspace();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60"
              >
                {restarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                Restart workspace
              </button>
            </>
          ) : missing ? (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                The editor’s paste protection hasn’t answered for a while. Reload the editor to bring it back. If it keeps happening, a browser extension may
                be blocking it. Your work is safe, but your reviewer will see that the protection wasn’t running.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReloadEditor();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Reload the editor
              </button>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                {mode === "report" ? "Trial mode: pastes from outside are recorded but not refused. " : "Pasting text from outside your workspace is turned off. "}
                Copy and paste <strong className="text-primary">inside</strong> your workspace works normally, and so do the commands in the SOW. Searching the
                web and using other windows are fine.
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-text-secondary" aria-live="polite">
                This session: <strong className="tabular-nums text-primary">{counters.refused}</strong> paste{counters.refused === 1 ? "" : "s"} from outside{" "}
                {mode === "report" ? "noted" : "refused"}, <strong className="tabular-nums text-primary">{counters.inside}</strong> copy-and-paste
                {counters.inside === 1 ? "" : "s"} inside your workspace.
              </p>
              <p className="mt-2.5 border-t border-border-subtle pt-2.5 text-2xs leading-relaxed text-text-muted">
                We record how many pastes were refused and how large, never what you copied or typed. Your reviewer sees this summary when you submit.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
