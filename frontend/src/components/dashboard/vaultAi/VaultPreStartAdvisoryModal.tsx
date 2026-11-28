"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VaultPreStartAdvisoryModalProps {
  open: boolean;
  setTitle?: string;
  proceeding?: boolean;
  onCancel: () => void;
  onProceed: () => void;
}

/**
 * Modern pre-start instruction dialog shown before entering a Vault AI Interview.
 * Encourages clearing cached assets or using an Incognito/Private browser window so
 * continuous AptRun deployments never collide with stale browser scripts or audio caches.
 */
export function VaultPreStartAdvisoryModal({
  open,
  setTitle,
  proceeding = false,
  onCancel,
  onProceed,
}: VaultPreStartAdvisoryModalProps) {
  const [copied, setCopied] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || ""));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !proceeding) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, proceeding, onCancel]);

  if (!open) return null;

  const shortcut = isMac ? "⌘ + Shift + N" : "Ctrl + Shift + N";

  const handleCopyLink = async () => {
    try {
      const targetUrl = typeof window !== "undefined" ? window.location.href : "";
      if (targetUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleClearCacheAndReload = async () => {
    if (clearingCache) return;
    setClearingCache(true);
    try {
      if (typeof window !== "undefined") {
        if ("caches" in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.map((key) => window.caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        const url = new URL(window.location.href);
        url.searchParams.set("_fresh", String(Date.now()));
        window.location.replace(url.toString());
        return;
      }
    } catch {
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-cache-advisory-title"
      data-testid="vault-prestart-advisory-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[26px] border border-indigo-500/30 bg-surface shadow-[0_32px_90px_-20px_rgba(15,23,42,0.75)]">
        {/* Top gradient bar */}
        <div
          aria-hidden
          className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
        />

        {/* Ambient backdrop glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"
        />

        <div className="relative p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-inset ring-white/25">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/12 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Before You Begin · Best Experience Setup
                </div>
                <h2
                  id="vault-cache-advisory-title"
                  className="text-lg font-black tracking-tight text-primary sm:text-xl"
                >
                  Clear Browser Cache or Use Incognito Mode
                </h2>
                {setTitle && (
                  <p className="text-xs font-medium text-text-muted truncate max-w-md">
                    Preparing: <span className="font-semibold text-text-secondary">{setTitle}</span>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              disabled={proceeding}
              aria-label="Close setup notice"
              className="rounded-xl p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Explanation banner */}
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.04] to-transparent px-4 py-3 text-xs leading-relaxed text-text-secondary">
            AptRun is actively updated with improved proctoring accuracy, AI voice playback, and real-time evaluation.
            Older cached browser files or background extensions can occasionally interfere with voice recording or screen sharing.{" "}
            <strong className="font-semibold text-primary">
              For a smooth, glitch-free Vault AI Interview, follow one of the quick options below first:
            </strong>
          </div>

          {/* Two side-by-side clean recommendation cards */}
          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* Option 1: Incognito / Private Window */}
            <div className="flex flex-col justify-between rounded-2xl border border-indigo-500/25 bg-elevated/60 p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
                      <EyeOff className="h-4 w-4" aria-hidden />
                    </span>
                    Use Incognito Mode
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    Recommended
                  </span>
                </div>
                <p className="text-2xs leading-relaxed text-text-secondary">
                  Open a clean Incognito / Private Chrome or Edge window (<kbd className="rounded border border-border-strong bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{shortcut}</kbd>), sign in, and attempt your interview with zero cached scripts or conflicting extensions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-surface-hover"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-indigo-500" />}
                <span>{copied ? "Interview Link Copied!" : "Copy Link for Incognito"}</span>
              </button>
            </div>

            {/* Option 2: Clear Cache & Hard Refresh */}
            <div className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-elevated/60 p-4 space-y-3">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  </span>
                  Clear Browser Cache
                </span>
                <p className="text-2xs leading-relaxed text-text-secondary">
                  Staying in this browser window? Clear your site cache so the latest interview engine, voice codecs, and UI load freshly before fullscreen proctoring begins.
                </p>
              </div>
              <button
                type="button"
                disabled={clearingCache || proceeding}
                onClick={() => void handleClearCacheAndReload()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-700 transition-colors hover:bg-cyan-500/15 disabled:opacity-60 dark:text-cyan-300"
              >
                {clearingCache ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                <span>{clearingCache ? "Refreshing Fresh Build..." : "Clear Cache & Reload Tab"}</span>
              </button>
            </div>
          </div>

          {/* Footer CTA bar */}
          <div className="flex flex-col-reverse gap-2.5 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={proceeding}
              onClick={onCancel}
              className="rounded-full border border-border-subtle px-5 py-2.5 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={proceeding || clearingCache}
              onClick={onProceed}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              {proceeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
              <span>{proceeding ? "Opening Interview..." : "I've Cleared Cache — Continue to Interview"}</span>
              {!proceeding && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
