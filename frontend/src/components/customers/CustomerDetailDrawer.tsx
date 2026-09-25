"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import type { CustomerDetail } from "@/types/customer";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The customer-side twin of LeadDetailDrawer — same stats/notes layout, but
 * no status-changer: a converted customer's lead_status only ever moves in
 * one direction (on purchase, see LeadAssignmentService::convertLead), so
 * there's nothing here to toggle. Shows who converted them (Marketing) and
 * when, since that credit trail is the one thing a lead's drawer doesn't need.
 */
export function CustomerDetailDrawer({
  customerId,
  onClose,
  onChanged,
}: {
  customerId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<CustomerDetail>(`/admin/customers/${customerId}`);
      setDetail(res);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/admin/customers/${customerId}/notes`, { note: noteText.trim() });
      setNoteText("");
      await load();
      onChanged();
    } finally {
      setSavingNote(false);
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
            Loading customer...
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-primary">{detail.customer.name}</h3>
                <p className="text-xs text-text-muted">{detail.customer.email}</p>
              </div>
              <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-control bg-status-success/10 border border-status-success/25 text-status-success text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Converted {formatDate(detail.customer.converted_at)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.solved_score}</div>
                <div className="text-[9px] text-text-muted uppercase mt-1">Solved Score</div>
              </div>
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.solved_by_difficulty.total_solved}</div>
                <div className="text-[9px] text-text-muted uppercase mt-1">Problems Solved</div>
              </div>
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.streak.current}</div>
                <div className="text-[9px] text-text-muted uppercase mt-1">Day Streak</div>
              </div>
            </div>

            <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs space-y-1">
              <div className="flex justify-between text-text-secondary">
                <span>Plan</span>
                <strong className="text-primary">{detail.customer.subscription?.plan_name ?? "—"}</strong>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Signed up</span>
                <strong className="text-primary">{formatDate(detail.customer.created_at)}</strong>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Converted by</span>
                <strong className="text-primary">{detail.customer.assigned_marketing_name ?? "—"}</strong>
              </div>
              {detail.customer.phone && (
                <div className="flex justify-between text-text-secondary">
                  <span>Phone</span>
                  <strong className="text-primary">{detail.customer.phone}</strong>
                </div>
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Add Note</p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Onboarding call scheduled for Friday..."
                rows={3}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs placeholder:text-text-muted outline-none focus:border-accent-primary resize-none"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !noteText.trim()}
                className="mt-2 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors disabled:opacity-50"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">History</p>
              {detail.notes.length === 0 ? (
                <p className="text-[11px] text-text-muted">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.notes.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                      <p className="text-xs text-text-secondary">{n.note}</p>
                      <p className="text-[10px] text-text-muted mt-1">
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
