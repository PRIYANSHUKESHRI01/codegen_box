"use client";

import type { ReactNode, RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, CheckCircle2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { checksPass, useIntegrityUi } from "@/lib/integrity/store";
import { IntegrityChecklist } from "./IntegrityChecklist";

export interface ConsentRule {
  icon: LucideIcon;
  /** `warn` is the strike rule: amber, and drawn with the three-strike meter. */
  tone?: "default" | "warn";
  text: ReactNode;
}

interface ConsentScreenProps {
  title: string;
  subtitle: string;
  previewVideoRef: RefObject<HTMLVideoElement>;
  devicePreviewReady: boolean;
  /** The interview shows the student's own face like a mirror. */
  mirrored?: boolean;
  onEnableDevices: () => void;
  onConsent: () => void;
  starting: boolean;
  blocked: boolean;
  /** What the primary button says once everything is ready ("Start Proctored Session" …). */
  startLabel: string;
  consentError: string | null;
  rules: ConsentRule[];
  /** What is recorded and who can see it (IntegrityDisclosure), or null when the integrity layer is off. */
  disclosure: ReactNode;
  footer: string;
}

/**
 * The screen a student sees BEFORE a proctored attempt, shared by contests, tests, interviews and practice sittings so they all look
 * and behave the same: left, "get ready" (camera preview and the system check, each row saying what to do about it); right, "what to
 * expect" (the rules, the strike meter, what is recorded); and a bar pinned to the bottom with the one button that matters, which says
 * exactly what is still missing instead of just being grey.
 *
 * Nothing here decides anything — the checks, the policy and the consent all come from the caller and the integrity store — it only
 * lays them out. When the server runs no integrity layer there is no system check and the screen is the single, narrower card.
 */
export function ConsentScreen({
  title,
  subtitle,
  previewVideoRef,
  devicePreviewReady,
  mirrored = false,
  onEnableDevices,
  onConsent,
  starting,
  blocked,
  startLabel,
  consentError,
  rules,
  disclosure,
  footer,
}: ConsentScreenProps) {
  const ui = useIntegrityUi();
  const reduceMotion = useReducedMotion();
  const integrity = ui.policy !== null;
  const ready = !integrity || checksPass(ui.checks);
  const missing = ui.checks.filter((c) => c.required && c.status !== "ok" && c.status !== "skipped").map((c) => c.label);

  const status = !devicePreviewReady
    ? { tone: "idle" as const, text: "First, allow your camera and microphone so we can check your setup." }
    : !ready
      ? { tone: "todo" as const, text: missing.length > 0 ? `Still needed: ${missing.join(" · ")}` : "A few checks are still running…" }
      : { tone: "done" as const, text: "Everything checks out. Start when you are ready." };

  const enter = (delay: number) =>
    reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" as const, delay } };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 pt-6 sm:px-6 lg:pt-10">
        <motion.header {...enter(0)} className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 text-accent-primary ring-1 ring-accent-primary/25">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-extrabold tracking-tight text-primary sm:text-xl">{title}</h2>
              <span className="rounded-full border border-accent-primary/25 bg-accent-primary/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-accent-primary">Proctored</span>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          </div>
        </motion.header>

        <div className={cn("mt-6 grid flex-1 content-start gap-5", integrity ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : "mx-auto w-full max-w-xl")}>
          <motion.section {...enter(0.06)} aria-labelledby="consent-get-ready" className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card sm:p-6">
            <SectionTitle id="consent-get-ready" n={1} title="Get ready" hint="Nothing here counts against you." />

            {/* Mounted from the start (hidden until a stream attaches) so the preview can attach synchronously. Only ever shown here. */}
            <div className={devicePreviewReady ? "relative overflow-hidden rounded-xl border border-border-strong bg-black shadow-inner" : "hidden"}>
              <video ref={previewVideoRef} muted playsInline className={cn("aspect-video w-full object-cover", mirrored && "-scale-x-100")} />
              <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-[78%] w-[34%] rounded-[50%] border-2 border-dashed border-white/35" />
              </span>
              <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-danger" aria-hidden /> Live preview
              </span>
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 text-2xs font-semibold text-white">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden />
                Make sure your face is clearly visible
              </div>
            </div>

            {integrity ? (
              <IntegrityChecklist onEnableDevices={onEnableDevices} />
            ) : (
              !devicePreviewReady && (
                <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-elevated/50 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                    <Camera className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="self-center text-xs leading-relaxed text-text-secondary">
                    Your browser will ask to use your camera and microphone. Allow both — you will see yourself here first, so you can fix the light and framing before anything starts.
                  </p>
                </div>
              )
            )}
          </motion.section>

          <motion.section {...enter(0.12)} aria-labelledby="consent-expect" className="space-y-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card sm:p-6">
            <SectionTitle id="consent-expect" n={2} title="What to expect" hint="Read this once; it is short." />

            <ul className="space-y-2.5">
              {rules.map((rule, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3.5 py-3",
                    rule.tone === "warn" ? "border-status-warning/30 bg-status-warning/[0.07]" : "border-border-subtle bg-elevated/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      rule.tone === "warn" ? "bg-status-warning/20 text-status-warning" : "bg-accent-primary/10 text-accent-primary"
                    )}
                  >
                    <rule.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    {rule.tone === "warn" && <StrikeMeter />}
                    <p className="text-xs leading-relaxed text-text-secondary">{rule.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            {disclosure && (
              <details open className="group rounded-xl border border-border-subtle bg-elevated/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary [&::-webkit-details-marker]:hidden">
                  What is recorded, and who can see it
                  <span aria-hidden className="text-text-muted transition-transform group-open:rotate-180">⌄</span>
                </summary>
                <div className="border-t border-border-subtle px-3.5 py-3">{disclosure}</div>
              </details>
            )}
          </motion.section>
        </div>

        {/* Pinned to the bottom of the scroll area: the one button that matters is always in reach, and says what is missing. */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-border-subtle bg-surface/90 px-4 py-3.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-4 lg:rounded-2xl lg:border lg:shadow-card">
          {consentError && (
            <div role="alert" className="mb-3 rounded-xl border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">
              {consentError}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                aria-live="polite"
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold",
                  status.tone === "done" ? "text-status-success" : status.tone === "todo" ? "text-text-secondary" : "text-text-muted"
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-2 w-2 shrink-0 rounded-full", status.tone === "done" ? "bg-status-success" : status.tone === "todo" ? "animate-pulse bg-status-warning" : "bg-text-muted/50")}
                />
                <span className="truncate">{status.text}</span>
              </p>
              <p className="mt-1 text-3xs leading-snug text-text-muted">{footer}</p>
            </div>

            {devicePreviewReady ? (
              <Button onClick={onConsent} isLoading={starting} disabled={!ready} size="lg" className="whitespace-nowrap sm:min-w-[19rem]">
                {starting ? "Starting..." : ready ? startLabel : "Finish the system check to start"}
              </Button>
            ) : (
              <Button onClick={onEnableDevices} size="lg" className="whitespace-nowrap sm:min-w-[19rem]">
                {blocked ? "Try Again" : "Enable Camera & Mic to Continue"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ id, n, title, hint }: { id: string; n: number; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-primary text-xs font-extrabold text-white" aria-hidden>
        {n}
      </span>
      <div>
        <h3 id={id} className="text-sm font-extrabold text-primary">
          {title}
        </h3>
        <p className="text-2xs text-text-muted">{hint}</p>
      </div>
    </div>
  );
}

/** Three pips — two warnings, then the third ends the attempt — so the rule reads at a glance before the sentence does. */
export function StrikeMeter() {
  return (
    <div className="mb-1.5 flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("h-1.5 w-7 rounded-full", i < 2 ? "bg-status-warning/60" : "bg-status-danger")} />
      ))}
      <span className="ml-1 text-[0.625rem] font-bold uppercase tracking-wider text-text-muted">3 strikes</span>
    </div>
  );
}
