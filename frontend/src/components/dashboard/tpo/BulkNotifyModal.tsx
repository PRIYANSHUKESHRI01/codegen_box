"use client";

import { useState, type ReactNode } from "react";
import { Mail, MessageCircle, AlertTriangle, Loader2, Send, Users, GraduationCap, UserRound, Siren, MessageSquareText, Check, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { Modal } from "@/components/ui/Modal";
import { HpButton } from "@/components/portal/kit";
import { HpCallout } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";

type NotifyChannel = "email" | "whatsapp";
type NotifyTemplate = "generic" | "termination";
type NotifyRecipient = "student" | "parent";

export interface BulkNotifyTarget {
  ids: number[];
  label: string;
  /** Only `parent_phone` is needed here, to warn when a WhatsApp-to-parent send will skip some recipients. */
  students: { parent_phone: string | null }[];
}

interface BulkNotifyModalProps {
  target: BulkNotifyTarget;
  onClose: () => void;
  onSent: (message: string) => void;
  /** Defaults to the TPO's own bulk-notify route; the Section Coordinator
   * dashboard passes "/coordinator/students/bulk-notify" to reuse this
   * exact same UI against its section-scoped equivalent instead of forking it. */
  endpoint?: string;
  /**
   * "premium" is the College TPO portal treatment. When omitted it follows
   * the signed-in role — a TPO (cohort page, drives ATS) gets premium; the
   * Section Coordinator dashboard keeps the original modal exactly.
   */
  variant?: "default" | "premium";
}

/**
 * The one real bulk-notify UI — calls POST {endpoint}. Shared by the
 * student cohort page, the drives ATS panel, and the Section Coordinator
 * dashboard so every surface drives the exact same channel/template/
 * recipient behavior instead of maintaining several copies that could drift.
 */
export function BulkNotifyModal({ target, onClose, onSent, endpoint = "/tpo/students/bulk-notify", variant }: BulkNotifyModalProps) {
  const { user } = useAuth();
  const premium = (variant ?? (user?.role === "admin_tpo" ? "premium" : "default")) === "premium";
  const [notifyChannel, setNotifyChannel] = useState<NotifyChannel>("email");
  const [notifyTemplate, setNotifyTemplate] = useState<NotifyTemplate>("generic");
  const [notifyRecipient, setNotifyRecipient] = useState<NotifyRecipient>("student");
  const [sendingNotify, setSendingNotify] = useState(false);

  const handleConfirm = async () => {
    setSendingNotify(true);
    try {
      const res = await api.post<{ message: string; queued_count: number; skipped_no_phone: number }>(
        endpoint,
        {
          student_ids: target.ids,
          channel: notifyChannel,
          template: notifyTemplate,
          recipient: notifyRecipient,
        }
      );
      onSent(res.message);
    } catch (err) {
      onSent(err instanceof ApiError ? err.message : "Failed to send the notification.");
    } finally {
      setSendingNotify(false);
    }
  };

  if (premium) {
    const missingParent = target.students.filter((s) => !s.parent_phone).length;
    return (
      <HpOverlayPortal>
        <Modal
          onClose={onClose}
          title="Notify Students"
          subtitle={`Sending to ${target.label}`}
          icon={Mail}
          size="lg"
          variant="premium"
          footer={
            <>
              <HpButton type="button" variant="ghost" onClick={onClose} disabled={sendingNotify}>
                Cancel
              </HpButton>
              <HpButton
                type="button"
                onClick={handleConfirm}
                disabled={sendingNotify}
                isLoading={sendingNotify}
                leftIcon={<Send className="h-4 w-4" />}
              >
                {sendingNotify ? "Sending..." : "Send"}
              </HpButton>
            </>
          }
        >
          <div className="space-y-5">
            {/* Audience */}
            <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-border-subtle bg-elevated/50 p-3.5">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_140%_at_0%_0%,rgb(var(--hp-id)/0.10),transparent_60%)]" />
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.65)] ring-1 ring-inset ring-white/25">
                <Users className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Audience</p>
                <p className="truncate text-13 font-bold text-primary">{target.label}</p>
              </div>
              <span className="tabular relative shrink-0 rounded-full bg-[rgb(var(--bg-surface-rgb))] px-2.5 py-1 text-2xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                {target.ids.length} {target.ids.length === 1 ? "recipient" : "recipients"}
              </span>
            </div>

            {/* Channel */}
            <fieldset>
              <legend className="mb-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Channel</legend>
              <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
                <OptionCard
                  icon={Mail}
                  title="Email"
                  description="Sent to each student's email"
                  active={notifyChannel === "email"}
                  onClick={() => {
                    setNotifyChannel("email");
                    setNotifyRecipient("student");
                  }}
                />
                <OptionCard
                  icon={MessageCircle}
                  title="WhatsApp"
                  description="The student's or a parent's phone"
                  active={notifyChannel === "whatsapp"}
                  onClick={() => setNotifyChannel("whatsapp")}
                />
              </div>
            </fieldset>

            {/* Recipient — parent only makes sense over WhatsApp, colleges don't collect parent emails */}
            {notifyChannel === "whatsapp" && (
              <fieldset>
                <legend className="mb-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Recipient</legend>
                <div className="grid grid-cols-2 gap-2.5">
                  <OptionCard compact icon={GraduationCap} title="Student" active={notifyRecipient === "student"} onClick={() => setNotifyRecipient("student")} />
                  <OptionCard compact icon={UserRound} title="Parent" active={notifyRecipient === "parent"} onClick={() => setNotifyRecipient("parent")} />
                </div>
                {notifyRecipient === "parent" && missingParent > 0 && (
                  <HpCallout icon={AlertTriangle} tone="amber" className="mt-2.5">
                    <span className="tabular font-semibold text-primary">
                      {missingParent} of {target.students.length}
                    </span>{" "}
                    have no parent number on file — they&apos;ll be skipped.
                  </HpCallout>
                )}
              </fieldset>
            )}

            {/* Template */}
            <fieldset>
              <legend className="mb-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Template</legend>
              <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
                <OptionCard
                  icon={MessageSquareText}
                  title="Generic Check-in"
                  description="General-purpose check-in message"
                  active={notifyTemplate === "generic"}
                  onClick={() => setNotifyTemplate("generic")}
                />
                <OptionCard
                  icon={Siren}
                  title="Termination Notice"
                  description="Formal notice — review before sending"
                  danger
                  active={notifyTemplate === "termination"}
                  onClick={() => setNotifyTemplate("termination")}
                />
              </div>
            </fieldset>

            <HpCallout icon={AlertTriangle} tone="amber">
              Both templates are placeholders for now — swap them for real copy once that&apos;s ready.
              {notifyChannel === "whatsapp" &&
                " WhatsApp messages log to the server instead of sending until a real WhatsApp Business account is configured."}
            </HpCallout>
          </div>
        </Modal>
      </HpOverlayPortal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      title="Notify Students"
      icon={Mail}
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={sendingNotify}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={sendingNotify}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {sendingNotify && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{sendingNotify ? "Sending..." : "Send"}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Sending to <strong>{target.label}</strong>.
        </p>

        {/* Channel */}
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Channel</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setNotifyChannel("email");
                setNotifyRecipient("student");
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-control text-xs font-bold border transition-colors",
                notifyChannel === "email"
                  ? "bg-accent-primary text-white border-accent-primary"
                  : "bg-elevated text-text-secondary border-border-subtle"
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
            <button
              onClick={() => setNotifyChannel("whatsapp")}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2 rounded-control text-xs font-bold border transition-colors",
                notifyChannel === "whatsapp"
                  ? "bg-accent-primary text-white border-accent-primary"
                  : "bg-elevated text-text-secondary border-border-subtle"
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* Recipient — parent only makes sense over WhatsApp, colleges don't collect parent emails */}
        {notifyChannel === "whatsapp" && (
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Recipient</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNotifyRecipient("student")}
                className={cn(
                  "py-2 rounded-control text-xs font-bold border transition-colors",
                  notifyRecipient === "student"
                    ? "bg-accent-primary text-white border-accent-primary"
                    : "bg-elevated text-text-secondary border-border-subtle"
                )}
              >
                Student
              </button>
              <button
                onClick={() => setNotifyRecipient("parent")}
                className={cn(
                  "py-2 rounded-control text-xs font-bold border transition-colors",
                  notifyRecipient === "parent"
                    ? "bg-accent-primary text-white border-accent-primary"
                    : "bg-elevated text-text-secondary border-border-subtle"
                )}
              >
                Parent
              </button>
            </div>
            {notifyRecipient === "parent" &&
              (() => {
                const missing = target.students.filter((s) => !s.parent_phone).length;
                return missing > 0 ? (
                  <p className="mt-1.5 text-3xs text-status-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {missing} of {target.students.length} have no parent number on file — they&apos;ll be skipped.
                  </p>
                ) : null;
              })()}
          </div>
        )}

        {/* Template */}
        <div>
          <label className="block text-2xs font-bold uppercase tracking-wider text-text-muted mb-1.5">Template</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNotifyTemplate("generic")}
              className={cn(
                "py-2 rounded-control text-xs font-bold border transition-colors",
                notifyTemplate === "generic"
                  ? "bg-accent-primary text-white border-accent-primary"
                  : "bg-elevated text-text-secondary border-border-subtle"
              )}
            >
              Generic Check-in
            </button>
            <button
              onClick={() => setNotifyTemplate("termination")}
              className={cn(
                "py-2 rounded-control text-xs font-bold border transition-colors",
                notifyTemplate === "termination"
                  ? "bg-status-danger text-white border-status-danger"
                  : "bg-elevated text-text-secondary border-border-subtle"
              )}
            >
              Termination Notice
            </button>
          </div>
        </div>

        <div className="p-3 rounded-control bg-elevated border border-dashed border-border-strong text-2xs text-text-muted flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0 mt-0.5" />
          <span>
            Both templates are placeholders for now — swap them for real copy once that&apos;s ready.
            {notifyChannel === "whatsapp" &&
              " WhatsApp messages log to the server instead of sending until a real WhatsApp Business account is configured."}
          </span>
        </div>
      </div>
    </Modal>
  );
}

function OptionCard({
  icon: Icon,
  title,
  description,
  active,
  onClick,
  danger = false,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-w-0 items-center gap-3 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.99]",
        compact ? "px-3 py-2.5" : "p-3.5",
        active
          ? danger
            ? "border-rose-500/45 bg-rose-500/[0.06] shadow-[0_0_0_3px_rgba(244,63,94,0.10)]"
            : "border-indigo-500/45 bg-indigo-500/[0.06] shadow-[0_0_0_3px_rgba(99,102,241,0.10)]"
          : "border-border-subtle bg-[rgb(var(--bg-surface-rgb))] hover:border-border-strong hover:bg-elevated/50"
      )}
    >
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-colors duration-200",
          compact ? "h-8 w-8" : "h-10 w-10",
          active
            ? danger
              ? "bg-gradient-to-br from-rose-400 to-red-600 text-white ring-white/25 shadow-[0_8px_18px_-6px_rgba(244,63,94,0.6)]"
              : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-white/25 shadow-[0_8px_18px_-6px_rgba(99,102,241,0.65)]"
            : "bg-elevated text-text-muted ring-border-subtle group-hover:text-primary"
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-bold", compact ? "text-xs" : "text-13", active ? "text-primary" : "text-text-secondary")}>{title}</span>
        {description && <span className="mt-0.5 block text-2xs leading-snug text-text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
          active
            ? danger
              ? "border-transparent bg-rose-500 text-white"
              : "border-transparent bg-indigo-500 text-white"
            : "border-border-strong text-transparent"
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform duration-200", active ? "scale-100" : "scale-0")} strokeWidth={3.2} />
      </span>
    </button>
  );
}
