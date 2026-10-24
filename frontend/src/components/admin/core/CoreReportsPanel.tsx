"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Flag, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_SHORT, questionLabel } from "@/lib/core";
import type { CoreDiscipline, CoreQuestion, CoreReport } from "@/types/core";

const REASON: Record<string, string> = { wrong_answer: "Wrong answer", unclear: "Unclear question", typo: "Typo", out_of_syllabus: "Out of syllabus", other: "Other" };

/** Core Prep → Reports: students saying "this question looks wrong". Open one to fix it, then resolve or dismiss the report. */
export function CoreReportsPanel({ onToast, onOpen }: { onToast: (m: string) => void; onOpen: (q: CoreQuestion) => void }) {
  const [reports, setReports] = useState<CoreReport[] | null>(null);
  const [status, setStatus] = useState<"open" | "all">("open");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReports((await api.get<{ reports: CoreReport[] }>(`/admin/core/reports?status=${status}`)).reports);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load reports.");
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (r: CoreReport, to: "resolved" | "dismissed") => {
    try {
      await api.post(`/admin/core/reports/${r.id}/resolve`, { status: to });
      onToast(to === "resolved" ? "Marked resolved." : "Dismissed.");
      await load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "That didn't work.");
    }
  };

  const open = async (r: CoreReport) => {
    if (!r.question) return;
    try {
      onOpen((await api.get<{ question: CoreQuestion }>(`/admin/core/questions/${r.question.id}`)).question);
    } catch {
      onToast("Couldn't open that question.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-1 w-fit" role="tablist">
        {(["open", "all"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={cn("rounded-control px-3 py-1.5 text-2xs font-bold capitalize", status === s ? "bg-accent-primary text-white" : "text-text-muted hover:text-primary")}>{s === "open" ? "Open" : "Everything"}</button>
        ))}
      </div>

      {error && <p role="alert" className="text-xs text-status-danger">{error}</p>}
      {!reports ? (
        <div className="h-40 animate-pulse rounded-panel bg-elevated" aria-busy="true" />
      ) : reports.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface px-6 py-14 text-center">
          <Flag className="mx-auto h-6 w-6 text-text-muted" aria-hidden />
          <p className="mt-2 text-sm font-bold text-primary">No reports {status === "open" ? "waiting" : "yet"}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">Students can report any question from practice or a test result. They appear here, with the question, so a wrong key gets fixed fast.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-panel border border-border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-3xs font-bold uppercase tracking-wide">
                <span className="rounded-full bg-status-danger/10 px-2 py-0.5 text-status-danger">{REASON[r.reason] ?? r.reason}</span>
                {r.question && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{DISCIPLINE_SHORT[r.question.discipline_code as CoreDiscipline] ?? r.question.discipline_code} · {r.question.subject ?? "—"}</span>}
                <span className="font-mono text-text-muted">{r.question ? questionLabel(r.question) : "deleted"}</span>
                <span className="ml-auto text-text-muted normal-case tracking-normal">{r.reporter?.name ?? "A student"} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
              {r.question && <p className="mt-2 line-clamp-3 text-xs text-primary">{r.question.stem}</p>}
              {r.note && <p className="mt-2 rounded-control bg-elevated/60 px-3 py-2 text-2xs italic text-text-secondary">“{r.note}”</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.question && <button onClick={() => open(r)} className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white">Open question</button>}
                {r.status === "open" ? (
                  <>
                    <button onClick={() => resolve(r, "resolved")} className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary"><Check className="h-3 w-3" /> Resolved</button>
                    <button onClick={() => resolve(r, "dismissed")} className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-2xs font-bold text-text-muted hover:text-primary"><X className="h-3 w-3" /> Dismiss</button>
                  </>
                ) : (
                  <span className="text-2xs font-semibold capitalize text-text-muted">{r.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
