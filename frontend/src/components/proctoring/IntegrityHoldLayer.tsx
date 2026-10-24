"use client";

import { Camera, Loader2, MonitorOff, ShieldAlert, Wifi } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { Hold } from "@/lib/integrity/types";

const ICON: Record<Hold["kind"], typeof Wifi> = {
  signal: Wifi,
  camera: Camera,
  microphone: Camera,
  screen_share: MonitorOff,
  guardian: ShieldAlert,
  superseded: ShieldAlert,
};

/**
 * A blocking layer over the exam while something the attempt depends on is missing: the screen share was stopped, the
 * camera went away, the connection to the server dropped, the Guardian went quiet, or the attempt was opened somewhere
 * else. The attempt's clock keeps running on the server, and the server refuses answers while the signal is down —
 * this layer exists so the student sees why and how to put it right, instead of watching answers silently fail.
 *
 * It is not the enforcement (anyone can delete an element in devtools); the server gate is.
 */
export function IntegrityHoldLayer() {
  const { hold, actions } = useIntegrityUi();
  if (!hold) return null;

  const Icon = ICON[hold.kind];

  return (
    <div role="alertdialog" aria-modal="true" aria-label={hold.title} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="max-w-sm space-y-4 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-status-warning/30 bg-status-warning/15 text-status-warning">
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-primary">{hold.title}</h3>
        <p className="text-xs text-text-secondary">{hold.message}</p>
        {hold.kind === "signal" && (
          <p className="flex items-center justify-center gap-2 text-2xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Trying again…
          </p>
        )}
        {hold.action && !hold.final && (
          <Button onClick={() => actions?.resolveHold()} fullWidth>
            {hold.action}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A small honest indicator inside the strike pill: what is watching this attempt right now. Shown to the student on
 * purpose — nothing here runs silently.
 */
export function AssuranceBadge() {
  const { assurance, ai, screenShared } = useIntegrityUi();
  if (!assurance) return null;

  const parts = [assurance === "guardian" ? "Guardian" : null, screenShared ? "Screen" : null, ai === "ready" ? "Camera analysis" : null].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <>
      <span className="h-3.5 w-px bg-border-subtle" aria-hidden="true" />
      <span className="flex items-center gap-1 text-status-success" title="What is watching this attempt">
        <ShieldAlert className="h-3 w-3" aria-hidden />
        <span className="hidden sm:inline">{parts.join(" · ")}</span>
      </span>
    </>
  );
}
