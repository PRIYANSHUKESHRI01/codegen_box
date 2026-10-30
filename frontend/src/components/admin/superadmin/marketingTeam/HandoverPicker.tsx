"use client";

import { cn } from "@/lib/utils";
import type { Colleague, Handover, HandoverMode } from "./types";

/** The starting choice: share it evenly if there is anyone to share with, otherwise leave it waiting. */
export function defaultHandover(colleagues: Colleague[]): Handover {
  return colleagues.length > 0 ? { mode: "distribute", to: null } : { mode: "leave", to: null };
}

/** True when the choice is complete enough to send (a named colleague must actually be picked). */
export function handoverReady(h: Handover): boolean {
  return h.mode !== "to" || h.to !== null;
}

/**
 * "Who takes their work?" - the one decision that makes reassigning and deleting safe. Used by both dialogs so the wording and the
 * rules (you cannot share work with nobody) are the same in each.
 */
export function HandoverPicker({ colleagues, value, onChange, name }: { colleagues: Colleague[]; value: Handover; onChange: (next: Handover) => void; name: string }) {
  const none = colleagues.length === 0;

  const options: { mode: HandoverMode; title: string; detail: string; disabled?: boolean }[] = [
    { mode: "distribute", title: `Share evenly across ${none ? "the active team" : `${colleagues.length} active colleague${colleagues.length === 1 ? "" : "s"}`}`, detail: "Each piece goes to whoever holds the least, so nobody is swamped.", disabled: none },
    { mode: "to", title: "Give it all to one person", detail: "Pick who takes over.", disabled: none },
    { mode: "leave", title: "Leave it unassigned", detail: "It waits, and is dealt out the moment someone is added or unblocked." },
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-xs font-semibold text-text-secondary">Who takes over {name}&apos;s work?</legend>

      {none && <p className="rounded-control border border-status-warning/30 bg-status-warning/10 p-2.5 text-2xs text-status-warning">There is no other active marketing employee, so it can&apos;t be shared. Add or unblock someone first, or leave it unassigned.</p>}

      {options.map((o) => {
        const selected = value.mode === o.mode;
        return (
          <label
            key={o.mode}
            className={cn(
              "block rounded-control border p-3 transition-colors",
              o.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              selected ? "border-accent-primary bg-accent-primary/10" : "border-border-subtle hover:border-border-strong"
            )}
          >
            <span className="flex items-start gap-2.5">
              <input
                type="radio"
                name="handover-mode"
                className="mt-0.5 h-3.5 w-3.5"
                checked={selected}
                disabled={o.disabled}
                onChange={() => onChange({ mode: o.mode, to: o.mode === "to" ? (value.to ?? colleagues[0]?.id ?? null) : null })}
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-primary">{o.title}</span>
                <span className="block text-2xs text-text-muted">{o.detail}</span>
              </span>
            </span>

            {o.mode === "to" && selected && (
              <select
                aria-label="Colleague who takes over"
                value={value.to ?? ""}
                onChange={(e) => onChange({ mode: "to", to: e.target.value ? Number(e.target.value) : null })}
                className="mt-2.5 w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
              >
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </option>
                ))}
              </select>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
