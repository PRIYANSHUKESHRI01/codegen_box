"use client";

import { useState } from "react";
import { Mail, MessageCircle, AlertTriangle, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

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
}

/**
 * The one real bulk-notify UI — calls POST {endpoint}. Shared by the
 * student cohort page, the drives ATS panel, and the Section Coordinator
 * dashboard so every surface drives the exact same channel/template/
 * recipient behavior instead of maintaining several copies that could drift.
 */
export function BulkNotifyModal({ target, onClose, onSent, endpoint = "/tpo/students/bulk-notify" }: BulkNotifyModalProps) {
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
