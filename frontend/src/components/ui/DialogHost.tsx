"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, HelpCircle, Pencil, ShieldAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { registerDialogHost, settleDialog, useActiveDialog, type DialogRequest, type DialogTone } from "@/lib/dialogs";

const TONE: Record<DialogTone, { icon: LucideIcon; tile: string; ring: string }> = {
  default: { icon: HelpCircle, tile: "border-accent-primary/25 bg-accent-primary/[0.10] text-accent-primary", ring: "from-accent-primary/[0.10]" },
  warning: { icon: AlertTriangle, tile: "border-status-warning/30 bg-status-warning/[0.14] text-status-warning", ring: "from-status-warning/[0.12]" },
  danger: { icon: ShieldAlert, tile: "border-status-danger/25 bg-status-danger/[0.12] text-status-danger", ring: "from-status-danger/[0.10]" },
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Draws the questions raised through `lib/dialogs` (`confirmDialog`, `promptDialog`). Mounted once in the root layout.
 * One at a time, in the order they were asked. Sits above the app's modals and drawers — a confirmation is very often
 * asked from inside one — and answers them in the right order: Escape cancels *this* box and never also closes the
 * modal underneath it.
 */
export function DialogHost() {
  const request = useActiveDialog();

  useEffect(() => registerDialogHost(), []);

  return <AnimatePresence mode="wait">{request && <DialogCard key={request.id} request={request} />}</AnimatePresence>;
}

function DialogCard({ request }: { request: DialogRequest }) {
  const reduceMotion = useReducedMotion();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const fieldId = `${uid}-field`;

  const prompt = request.kind === "prompt";
  const tone: DialogTone = request.tone ?? "default";
  const style = TONE[tone];
  const Icon = prompt ? Pencil : style.icon;
  const destructive = tone === "danger";

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(request.kind === "prompt" ? request.defaultValue ?? "" : "");
  const [error, setError] = useState<string | null>(null);

  const cancel = () => settleDialog(request.id, request.kind === "confirm" ? false : null);

  const submit = () => {
    if (request.kind === "prompt") {
      const problem = request.validate?.(value) ?? null;
      if (problem) {
        setError(problem);
        inputRef.current?.focus();
        return;
      }
      settleDialog(request.id, value);
      return;
    }
    settleDialog(request.id, true);
  };

  // Keep the latest closures reachable from the one keydown listener below without re-subscribing on every keystroke.
  const latest = useRef({ cancel, submit });
  latest.current = { cancel, submit };

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // A destructive question starts on "Cancel": a stray Enter or Space must never be the thing that deletes.
    const first = prompt ? inputRef.current : destructive || tone === "warning" ? cancelRef.current : confirmRef.current;
    first?.focus();
    if (first instanceof HTMLInputElement) first.select();

    // Capture phase on window, so this runs before a Modal's own document-level Escape handler and can stop it.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        latest.current.cancel();
        return;
      }

      if (e.key === "Tab") {
        const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        if (nodes.length === 0) return;
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === firstNode || !panelRef.current?.contains(active))) {
          e.preventDefault();
          lastNode.focus();
        } else if (!e.shiftKey && (active === lastNode || !panelRef.current?.contains(active))) {
          e.preventDefault();
          firstNode.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per dialog; `latest` carries the fresh handlers.
  }, []);

  const confirmLabel = request.confirmLabel ?? (prompt ? "Save" : destructive ? "Delete" : "Confirm");
  const cancelLabel = request.cancelLabel ?? "Cancel";
  const items = request.kind === "confirm" ? request.items : undefined;

  return (
    // !mt-0: pages render siblings inside `space-y-*` columns, whose margin would nudge a fixed overlay off the top edge.
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm !mt-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <motion.div
        ref={panelRef}
        role={prompt ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={request.message || items?.length ? descId : undefined}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
        className="relative my-auto w-full max-w-[26rem] overflow-hidden rounded-panel border border-border-strong bg-surface shadow-[0_32px_80px_-20px_rgba(15,23,42,0.55)]"
      >
        <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", style.ring)} />

        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="px-6 pb-5 pt-6">
            <span aria-hidden="true" className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", style.tile)}>
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </span>

            <h2 id={titleId} className="mt-4 text-base font-bold leading-snug tracking-tight text-primary">
              {request.title}
            </h2>

            {(request.message || items?.length) && (
              <div id={descId} className="mt-1.5 space-y-2 text-xs leading-relaxed text-text-secondary">
                {request.message && <p className="whitespace-pre-line break-words">{request.message}</p>}
                {items && items.length > 0 && (
                  <ul className="space-y-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-2.5">
                    {items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className={cn("mt-[7px] h-1 w-1 shrink-0 rounded-full", destructive ? "bg-status-danger" : "bg-status-warning")} />
                        <span className="min-w-0 break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {request.kind === "prompt" && (
              <div className="mt-4">
                <label htmlFor={fieldId} className={cn("mb-1.5 block text-2xs font-bold text-primary", !request.label && "sr-only")}>
                  {request.label ?? request.title}
                </label>
                <input
                  ref={inputRef}
                  id={fieldId}
                  type="text"
                  value={value}
                  maxLength={request.maxLength}
                  placeholder={request.placeholder}
                  autoComplete="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${fieldId}-error` : undefined}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null);
                  }}
                  className={cn(
                    "w-full rounded-control border bg-elevated px-3 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary",
                    error ? "border-status-danger" : "border-border-subtle"
                  )}
                />
                {error && (
                  <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-2xs font-semibold text-status-danger">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border-subtle bg-elevated/60 px-6 py-4 sm:flex-row sm:justify-end">
            <Button ref={cancelRef} type="button" variant="secondary" size="sm" onClick={cancel} className="sm:min-w-[88px]">
              {cancelLabel}
            </Button>
            <Button ref={confirmRef} type="submit" variant={destructive ? "danger" : "primary"} size="sm" className="sm:min-w-[88px]">
              {confirmLabel}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
