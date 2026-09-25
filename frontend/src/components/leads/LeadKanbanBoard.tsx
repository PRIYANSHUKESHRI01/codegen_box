"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical, StickyNote, GripVertical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColorClass, initials } from "@/lib/avatarColor";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus, type LeadSummary } from "@/types/lead";

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new: "bg-accent-secondary",
  contacted: "bg-accent-primary",
  engaged: "bg-status-warning",
  converted: "bg-status-success",
  lost: "bg-text-muted/50",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * A real drag-and-drop pipeline board — moving a card fires the exact same
 * POST /marketing/leads/{id}/status the table view's drawer already uses,
 * just with a CRM-native interaction instead of a form. Drag is a desktop
 * mouse convenience layered on top of (never a replacement for) the
 * per-card "Move to..." menu, since native HTML5 drag-and-drop has no touch
 * or keyboard equivalent — the menu is what makes every move actually
 * reachable on mobile or by keyboard.
 */
export function LeadKanbanBoard({
  leads,
  onOpenLead,
  onMoveLead,
  movingIds,
}: {
  leads: LeadSummary[];
  onOpenLead: (id: number) => void;
  onMoveLead: (leadId: number, status: LeadStatus) => void;
  movingIds: Set<number>;
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const handleDrop = (status: LeadStatus) => {
    setDragOverColumn(null);
    if (draggedId === null) return;
    const lead = leads.find((l) => l.id === draggedId);
    if (lead && lead.lead_status !== status) onMoveLead(draggedId, status);
    setDraggedId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
      {LEAD_STATUSES.map((status) => {
        const columnLeads = leads.filter((l) => l.lead_status === status);
        const isDragOver = dragOverColumn === status;

        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverColumn !== status) setDragOverColumn(status);
            }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === status ? null : prev))}
            onDrop={() => handleDrop(status)}
            className={cn(
              "flex-shrink-0 w-[280px] rounded-panel border transition-colors flex flex-col max-h-[calc(100vh-22rem)]",
              isDragOver ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle bg-elevated/40"
            )}
          >
            <div className="px-3.5 py-3 flex items-center justify-between border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", COLUMN_ACCENT[status])} />
                <h3 className="text-xs font-bold text-primary">{LEAD_STATUS_LABELS[status]}</h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-text-muted bg-surface px-1.5 py-0.5 rounded-full border border-border-subtle">
                {columnLeads.length}
              </span>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-[120px]">
              <AnimatePresence initial={false}>
                {columnLeads.map((lead) => (
                  <motion.div
                    key={lead.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.18 }}
                    draggable
                    onDragStart={() => setDraggedId(lead.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => onOpenLead(lead.id)}
                    className={cn(
                      "group relative p-3 rounded-control bg-surface border border-border-subtle shadow-subtle cursor-pointer hover:border-accent-primary/40 hover:shadow-card transition-all",
                      draggedId === lead.id && "opacity-40"
                    )}
                  >
                    {movingIds.has(lead.id) && (
                      <div className="absolute inset-0 rounded-control bg-surface/70 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                            avatarColorClass(lead.name)
                          )}
                        >
                          {initials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-primary truncate">{lead.name}</div>
                          <div className="text-[10px] text-text-muted truncate">{lead.email}</div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === lead.id ? null : lead.id);
                        }}
                        className="p-0.5 rounded text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                        title="Move to..."
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 text-[10px] text-text-muted">
                      <span className="font-mono">{formatDate(lead.created_at)}</span>
                      <div className="flex items-center gap-2">
                        {lead.note_count > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <StickyNote className="w-2.5 h-2.5" /> {lead.note_count}
                          </span>
                        )}
                        <span className="font-mono font-bold text-text-secondary">{lead.solved_score} pts</span>
                      </div>
                    </div>

                    {/* Drag affordance — visual only, dragging works from anywhere on the card */}
                    <GripVertical className="w-3 h-3 text-text-muted/40 absolute top-1/2 -translate-y-1/2 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {openMenuId === lead.id && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                          }}
                        />
                        <div className="absolute right-2 top-9 z-30 w-40 rounded-control bg-surface border border-border-strong shadow-card overflow-hidden">
                          {LEAD_STATUSES.filter((s) => s !== status).map((s) => (
                            <button
                              key={s}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                onMoveLead(lead.id, s);
                              }}
                              className="w-full text-left px-3 py-2 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover hover:text-primary transition-colors flex items-center gap-2"
                            >
                              <span className={cn("w-1.5 h-1.5 rounded-full", COLUMN_ACCENT[s])} />
                              Move to {LEAD_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {columnLeads.length === 0 && (
                <div className="h-full min-h-[80px] flex items-center justify-center text-[10px] text-text-muted/70 border border-dashed border-border-subtle rounded-control">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
