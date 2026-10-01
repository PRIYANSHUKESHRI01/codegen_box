"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Mail, Phone, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { avatarColorClass, initials } from "@/lib/avatarColor";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, type LeadStatus } from "@/types/lead";
import { CONTACT_REQUEST_AUDIENCE_LABELS, type ContactRequestDetail, type ContactRequestNote } from "@/types/contactRequest";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface ContactRequestDetailDrawerProps {
  requestId: number;
  onClose: () => void;
  onChanged: () => void;
}

/** The ContactRequest sibling of LeadDetailDrawer — same visual shape, simpler data (no practice stats/subscription, since a "Talk to Our Team" submitter isn't a user account). */
export function ContactRequestDetailDrawer({ requestId, onClose, onChanged }: ContactRequestDetailDrawerProps) {
  const [detail, setDetail] = useState<{ request: ContactRequestDetail; notes: ContactRequestNote[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ request: ContactRequestDetail; notes: ContactRequestNote[] }>(
        `/marketing/contact-requests/${requestId}`
      );
      setDetail(res);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/marketing/contact-requests/${requestId}/notes`, { note: noteText.trim() });
      setNoteText("");
      await load();
      onChanged();
    } finally {
      setSavingNote(false);
    }
  };

  const handleSetStatus = async (s: LeadStatus) => {
    setSavingStatus(true);
    try {
      await api.post(`/marketing/contact-requests/${requestId}/status`, { status: s });
      await load();
      onChanged();
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md h-full bg-surface border-l border-border-strong shadow-2xl overflow-y-auto"
      >
        {loading || !detail ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading inquiry...
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                    avatarColorClass(detail.request.name)
                  )}
                >
                  {initials(detail.request.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-primary truncate">{detail.request.name}</h3>
                  <p className="text-xs text-text-muted truncate">{detail.request.organization_name}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs space-y-2">
              <div className="flex items-center gap-2 text-text-secondary">
                <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="truncate">{detail.request.email}</span>
              </div>
              {detail.request.phone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span>{detail.request.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-text-secondary">
                <Building2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>{CONTACT_REQUEST_AUDIENCE_LABELS[detail.request.audience]}</span>
              </div>
              <div className="flex justify-between text-text-secondary pt-1 border-t border-border-subtle">
                <span>Submitted</span>
                <strong className="text-primary">{formatDate(detail.request.created_at)}</strong>
              </div>
            </div>

            {detail.request.message && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Message</p>
                <p className="text-xs text-text-secondary leading-relaxed p-3 rounded-control bg-elevated/60 border border-border-subtle whitespace-pre-wrap">
                  {detail.request.message}
                </p>
              </div>
            )}

            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={savingStatus}
                    onClick={() => handleSetStatus(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-3xs font-bold border transition-colors disabled:opacity-50",
                      detail.request.status === s
                        ? LEAD_STATUS_BADGE_CLASS[s]
                        : "bg-elevated text-text-muted border-border-subtle hover:text-primary"
                    )}
                  >
                    {LEAD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Add Note</p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Called on Tuesday, scheduling a demo..."
                rows={3}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs placeholder:text-text-muted outline-none focus:border-accent-primary resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !noteText.trim()}
                className="mt-2 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors disabled:opacity-50"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>

            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">History</p>
              {detail.notes.length === 0 ? (
                <p className="text-2xs text-text-muted">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.notes.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                      <p className="text-xs text-text-secondary">{n.note}</p>
                      <p className="text-3xs text-text-muted mt-1">
                        {n.author_name} · {formatDate(n.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
