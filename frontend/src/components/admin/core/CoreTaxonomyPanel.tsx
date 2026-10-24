"use client";

import { useState } from "react";
import { ChevronDown, Eye, EyeOff, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABEL } from "@/lib/core";
import type { CoreSubjectRow, CoreTaxonomyResponse } from "@/types/core";

const inp = "px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-2xs";
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]+/, "");

/**
 * Core Prep → Taxonomy: the subjects and topics a question is filed under. It ships seeded (aligned with the GATE
 * syllabi for EC, EE, ME and CE); add your own, rename, or hide. A subject or topic that already has questions
 * cannot be deleted — hide it instead.
 */
export function CoreTaxonomyPanel({ taxonomy, onChanged, onToast }: { taxonomy: CoreTaxonomyResponse; onChanged: () => void; onToast: (m: string) => void }) {
  const [open, setOpen] = useState<string | null>(taxonomy.disciplines[0]?.code ?? null);
  const [adding, setAdding] = useState<{ kind: "subject" | "topic"; parent: string | number } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      onToast(done);
      onChanged();
      return true;
    } catch (err) {
      onToast(err instanceof ApiError ? err.errors?.code?.[0] ?? err.errors?.subject?.[0] ?? err.errors?.topic?.[0] ?? err.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!adding || !name.trim()) return;
    const code = slug(name);
    if (!code) return onToast("Use a name with letters in it.");
    const ok = await run(
      () => (adding.kind === "subject" ? api.post("/admin/core/subjects", { discipline_code: adding.parent, code, name: name.trim() }) : api.post("/admin/core/topics", { subject_id: adding.parent, code, name: name.trim() })),
      `${adding.kind === "subject" ? "Subject" : "Topic"} added.`
    );
    if (ok) {
      setName("");
      setAdding(null);
    }
  };

  const rename = (kind: "subjects" | "topics", id: number, current: string) => {
    const next = window.prompt("Rename to:", current)?.trim();
    if (next && next !== current) void run(() => api.put(`/admin/core/${kind}/${id}`, { name: next }), "Renamed.");
  };

  const hide = (kind: "subjects" | "topics", id: number, active: boolean) => void run(() => api.put(`/admin/core/${kind}/${id}`, { is_active: !active }), active ? "Hidden from the editor." : "Visible again.");

  return (
    <div className="space-y-3">
      {taxonomy.disciplines.map((d) => (
        <section key={d.code} className="overflow-hidden rounded-panel border border-border-subtle bg-surface">
          <button onClick={() => setOpen(open === d.code ? null : d.code)} aria-expanded={open === d.code} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-surface-hover">
            <span className="text-sm font-extrabold text-primary">{DISCIPLINE_LABEL[d.code]} <span className="ml-1 text-2xs font-semibold text-text-muted">{d.subjects.length} subjects</span></span>
            <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", open === d.code && "rotate-180")} />
          </button>
          {open === d.code && (
            <div className="space-y-3 border-t border-border-subtle p-4">
              {d.subjects.map((s: CoreSubjectRow) => (
                <div key={s.id} className={cn("rounded-control border border-border-subtle p-3", !s.is_active && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-primary">{s.name}</span>
                    <span className="font-mono text-3xs text-text-muted">{s.code}</span>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">{s.questions} questions</span>
                    <div className="ml-auto flex items-center gap-2 text-2xs font-semibold">
                      <button disabled={busy} onClick={() => rename("subjects", s.id, s.name)} className="text-accent-primary hover:underline">Rename</button>
                      <button disabled={busy} onClick={() => hide("subjects", s.id, s.is_active)} className="inline-flex items-center gap-1 text-text-muted hover:text-primary">{s.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {s.is_active ? "Hide" : "Show"}</button>
                      {s.questions === 0 && <button disabled={busy} onClick={() => window.confirm(`Delete “${s.name}”?`) && run(() => api.delete(`/admin/core/subjects/${s.id}`), "Subject deleted.")} className="text-status-danger hover:underline">Delete</button>}
                    </div>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {s.topics.map((t) => (
                      <li key={t.id} className={cn("group inline-flex items-center gap-1 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-text-secondary", !t.is_active && "opacity-50 line-through")}>
                        {t.name}
                        <button aria-label={`Rename ${t.name}`} onClick={() => rename("topics", t.id, t.name)} className="hidden text-accent-primary group-hover:inline">✎</button>
                        <button aria-label={`${t.is_active ? "Hide" : "Show"} ${t.name}`} onClick={() => hide("topics", t.id, t.is_active)} className="hidden text-text-muted group-hover:inline">{t.is_active ? "⊘" : "↺"}</button>
                      </li>
                    ))}
                    <li>
                      {adding?.kind === "topic" && adding.parent === s.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="inline-flex items-center gap-1">
                          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New topic" className={cn(inp, "w-48")} aria-label="New topic name" />
                          <button type="submit" disabled={busy} className="rounded-control bg-accent-primary px-2.5 py-1.5 text-2xs font-bold text-white">Add</button>
                          <button type="button" onClick={() => setAdding(null)} className="text-2xs text-text-muted">Cancel</button>
                        </form>
                      ) : (
                        <button onClick={() => { setAdding({ kind: "topic", parent: s.id }); setName(""); }} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-1 text-2xs font-semibold text-text-muted hover:text-primary"><Plus className="h-3 w-3" /> Topic</button>
                      )}
                    </li>
                  </ul>
                </div>
              ))}
              {adding?.kind === "subject" && adding.parent === d.code ? (
                <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="flex flex-wrap items-center gap-2">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New subject name" className={cn(inp, "w-64")} aria-label="New subject name" />
                  <button type="submit" disabled={busy} className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white">Add subject</button>
                  <button type="button" onClick={() => setAdding(null)} className="text-2xs text-text-muted">Cancel</button>
                </form>
              ) : (
                <button onClick={() => { setAdding({ kind: "subject", parent: d.code }); setName(""); }} className="inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"><Plus className="h-3 w-3" /> Add a subject</button>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
