"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Laptop,
  Maximize2,
  Monitor,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { RoomBackdrop } from "./RoomBackdrop";
import type { InterviewSessionVariant } from "../InterviewSessionView";

interface DesktopRequiredScreenProps {
  variant?: InterviewSessionVariant;
  backHref: string;
  sessionLabel?: string;
}

/**
 * Shown when a student opens a proctored Mock AI Interview or Vault AI Interview
 * session page from a mobile phone. Tech-stack browsing remains unlocked on mobile,
 * while the live proctored session requires a laptop, desktop, or iPad/tablet.
 */
export function DesktopRequiredScreen({
  variant = "mock",
  backHref,
  sessionLabel,
}: DesktopRequiredScreenProps) {
  const reduce = useReducedMotion() ?? false;
  const [copied, setCopied] = useState(false);

  const isVault = variant === "vault";
  const titleLabel = sessionLabel ?? (isVault ? "Vault AI Interview" : "Mock AI Interview");
  const backLabel = isVault
    ? "Back to Vault AI Interview"
    : backHref.includes("merchant-navy")
      ? "Back to Merchant Navy"
      : "Back to Mock AI Interview";

  const handleCopyLink = async () => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard may be blocked in restricted contexts */
    }
  };

  return (
    <div
      data-testid="mobile-interview-blocked-screen"
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-8 sm:px-6"
    >
      <RoomBackdrop />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <Wordmark className="text-2xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {titleLabel} · Desktop or Tablet Required
          </span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface/95 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400"
          />

          {/* Device comparison hero */}
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-emerald-600 dark:text-emerald-300">
              <div className="relative">
                <Laptop className="h-7 w-7" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                  <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden />
                </span>
              </div>
              <span className="text-[11px] font-bold">Laptop / PC</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-emerald-600 dark:text-emerald-300">
              <div className="relative">
                <Tablet className="h-7 w-7" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                  <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden />
                </span>
              </div>
              <span className="text-[11px] font-bold">iPad / Tablet</span>
            </div>

            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-rose-600 dark:text-rose-300">
              <div className="relative">
                <Smartphone className="h-7 w-7" aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white shadow">
                  <X className="h-2.5 w-2.5 stroke-[3]" aria-hidden />
                </span>
              </div>
              <span className="text-[11px] font-bold">Mobile Phone</span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <h1 className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
              Attempt this interview on your laptop or bigger screen
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
              The proctored{" "}
              <span className="font-semibold text-primary">{titleLabel}</span>{" "}
              session is not available on mobile phones. You can browse topics and select your tech stack on mobile, then open this link on a laptop, desktop, or iPad to start.
            </p>
          </div>

          <div className="mt-5 space-y-2.5 rounded-2xl border border-border-subtle bg-background/70 p-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Why a larger screen is required
            </p>
            <ul className="space-y-2 text-xs leading-relaxed text-text-secondary">
              <li className="flex items-start gap-2.5">
                <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-primary">Fullscreen proctoring lock:</strong>{" "}
                  Mobile browsers block reliable fullscreen enforcement and trigger unintended backgrounding strikes on calls or notifications.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-primary">Live AI camera &amp; voice biometrics:</strong>{" "}
                  Requires a stable webcam frame and uninterrupted microphone capture alongside your transcript review.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                <span>
                  <strong className="font-semibold text-primary">Supported devices:</strong>{" "}
                  Windows or Mac laptop, desktop computer, iPad, or large tablet (screen width 768px or wider).
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-500/15 dark:text-indigo-300"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                  <span>Interview Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  <span>Copy Interview Link for Laptop</span>
                </>
              )}
            </button>

            <Link
              href={backHref}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>{backLabel}</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
