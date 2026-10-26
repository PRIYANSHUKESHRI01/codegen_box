"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, FilePlus2, Loader2, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
import { MarkdownRenderer } from "@/components/dashboard/articles/MarkdownRenderer";
import { api, ApiError } from "@/lib/api";
import { SOW_TEMPLATE } from "@/lib/sowTemplate";
import { cn } from "@/lib/utils";
import type { AdminTopicFull, Difficulty, TopicStatus } from "@/types/projectLab";
import { confirmDialog } from "@/lib/dialogs";

interface MilestoneForm {
  /** Stable React key; also how a row is tracked while being reordered. */
  key: string;
  id?: number;
  title: string;
  description: string;
  /** One acceptance criterion per line. */
  criteria: string;
  estimated_hours: string;
}

const MIN_SOW_CHARS_TO_PUBLISH = 100;
let keySeq = 0;
const newKey = () => `m${++keySeq}`;

const inputClass =
  "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-medium text-primary outline-none placeholder:text-text-muted focus:border-accent-primary";
const labelClass = "mb-1 block text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary";

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function fromTopic(topic?: AdminTopicFull): {
  fields: Record<string, string | boolean>;
  milestones: MilestoneForm[];
} {
  return {
    fields: {
      title: topic?.title ?? "",
      category: topic?.category ?? "",
      summary: topic?.summary ?? "",
      difficulty: topic?.difficulty ?? "intermediate",
      estimated_hours: String(topic?.estimated_hours ?? 40),
      tech_stack: (topic?.tech_stack ?? []).join(", "),
      outcomes: (topic?.outcomes ?? []).join("\n"),
      sow_markdown: topic?.sow_markdown ?? "",
      status: topic?.status ?? "draft",
      is_free_sample: topic?.is_free_sample ?? false,
      authorship_mode: topic?.authorship_mode ?? "strict",
      icon: topic?.icon ?? "",
      display_order: String(topic?.display_order ?? 0),
      bump_sow_version: false,
    },
    milestones: (topic?.milestones ?? []).map((m) => ({
      key: newKey(),
      id: m.id,
      title: m.title,
      description: m.description ?? "",
      criteria: (m.acceptance_criteria ?? []).join("\n"),
      estimated_hours: String(m.estimated_hours),
    })),
  };
}

interface TopicEditorProps {
  /** Omit to create a new topic. */
  topic?: AdminTopicFull;
}

/**
 * The authoring surface for one Project Lab topic: its metadata, the SOW as
 * Markdown (with a live preview of exactly what students see), and the
 * structured milestones whose acceptance criteria reviewers grade against.
 * Everything here is written by hand by staff — nothing is generated.
 */
export function TopicEditor({ topic }: TopicEditorProps) {
  const router = useRouter();
  const initial = useMemo(() => fromTopic(topic), [topic]);

  // The saved topic as the server last returned it (null while creating).
  const [current, setCurrent] = useState<AdminTopicFull | undefined>(topic);
  const [f, setF] = useState(initial.fields);
  const [milestones, setMilestones] = useState<MilestoneForm[]>(initial.milestones);
  const [sowView, setSowView] = useState<"source" | "preview">("source");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: string, value: string | boolean) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const sow = String(f.sow_markdown);
  const wordCount = sow.trim().split(/\s+/).filter(Boolean).length;
  const status = f.status as TopicStatus;

  const problems: string[] = [];
  if (!String(f.title).trim()) problems.push("a title");
  if (!String(f.category).trim()) problems.push("a category");
  if (!String(f.summary).trim()) problems.push("a summary");
  if (status === "published") {
    if (sow.trim().length < MIN_SOW_CHARS_TO_PUBLISH) problems.push("a written SOW to publish");
    if (milestones.filter((m) => m.title.trim()).length === 0) problems.push("at least one milestone to publish");
  }
  if (milestones.some((m) => !m.title.trim())) problems.push("a title on every milestone");

  const updateMilestone = (key: string, patch: Partial<MilestoneForm>) => {
    setMilestones((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
    setSaved(false);
  };

  const move = (index: number, delta: -1 | 1) => {
    setMilestones((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      title: String(f.title).trim(),
      category: String(f.category).trim(),
      summary: String(f.summary).trim(),
      difficulty: f.difficulty as Difficulty,
      estimated_hours: Number(f.estimated_hours) || 1,
      tech_stack: String(f.tech_stack)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      outcomes: lines(String(f.outcomes)),
      sow_markdown: sow.trim() === "" ? null : sow,
      status,
      is_free_sample: Boolean(f.is_free_sample),
      authorship_mode: f.authorship_mode === "open" ? "open" : "strict",
      icon: String(f.icon).trim() || null,
      display_order: Number(f.display_order) || 0,
      bump_sow_version: Boolean(f.bump_sow_version),
      milestones: milestones.map((m) => ({
        ...(m.id ? { id: m.id } : {}),
        title: m.title.trim(),
        description: m.description.trim() || null,
        acceptance_criteria: lines(m.criteria),
        estimated_hours: Number(m.estimated_hours) || 0,
      })),
    };

    try {
      if (current) {
        const res = await api.put<{ topic: AdminTopicFull }>(`/admin/project-lab/topics/${current.id}`, payload);
        // Adopt what the server now holds. Newly created milestones have ids only in this
        // response; without them a second save would delete and recreate every new row,
        // silently wiping the progress ticks students had made against them.
        const next = fromTopic(res.topic);
        setCurrent(res.topic);
        setF(next.fields);
        setMilestones(next.milestones);
        setSaved(true);
      } else {
        const res = await api.post<{ topic: AdminTopicFull }>("/admin/project-lab/topics", payload);
        router.replace(`/admin/projects/edit?id=${res.topic.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setError(Object.values(err.errors).flat().slice(0, 3).join(" "));
      } else {
        setError(err instanceof ApiError ? err.message : "We couldn't save this project.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Save bar ── */}
      <div className="sticky top-16 z-20 -mx-1 flex flex-wrap items-center gap-3 rounded-panel border border-border-subtle bg-surface/95 px-4 py-3 shadow-subtle backdrop-blur">
        <div className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-0.5" role="group" aria-label="Status">
          {(["draft", "published", "archived"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("status", s)}
              aria-pressed={status === s}
              className={cn(
                "rounded-control px-3 py-1.5 text-2xs font-bold capitalize transition-colors",
                status === s ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {current && (
          <span className="text-2xs font-semibold text-text-secondary">
            SOW v{current.sow_version} · {current.enrollment_count} student{current.enrollment_count === 1 ? "" : "s"} enrolled
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {saved && <span className="text-2xs font-bold text-status-success">Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving || problems.length > 0}
            title={problems.length > 0 ? `Needs ${problems.join(", ")}` : undefined}
            className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {current ? "Save changes" : "Create project"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {problems.length > 0 && (
        <p className="text-2xs font-semibold text-text-secondary">Before you can save: add {problems.join(", ")}.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Left: details + milestones ── */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
            <h2 className="text-sm font-extrabold text-primary">Project details</h2>

            <label className="block">
              <span className={labelClass}>Title</span>
              <input value={String(f.title)} onChange={(e) => set("title", e.target.value)} placeholder="Hospital Management System" maxLength={160} className={inputClass} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Category</span>
                <input value={String(f.category)} onChange={(e) => set("category", e.target.value)} placeholder="Healthcare" maxLength={60} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Difficulty</span>
                <select value={String(f.difficulty)} onChange={(e) => set("difficulty", e.target.value)} className={inputClass}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Summary (shown on the project card)</span>
              <textarea value={String(f.summary)} onChange={(e) => set("summary", e.target.value)} rows={3} maxLength={600} className={`${inputClass} resize-none`} />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Estimated hours</span>
                <input type="number" min={1} max={1000} value={String(f.estimated_hours)} onChange={(e) => set("estimated_hours", e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Card icon</span>
                <input value={String(f.icon)} onChange={(e) => set("icon", e.target.value)} placeholder="Stethoscope" className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Display order</span>
                <input type="number" min={0} value={String(f.display_order)} onChange={(e) => set("display_order", e.target.value)} className={inputClass} />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Tech stack (comma separated)</span>
              <input value={String(f.tech_stack)} onChange={(e) => set("tech_stack", e.target.value)} placeholder="Laravel, MySQL, React, Tailwind" className={inputClass} />
            </label>

            <label className="block">
              <span className={labelClass}>What the student will build and learn (one per line)</span>
              <textarea value={String(f.outcomes)} onChange={(e) => set("outcomes", e.target.value)} rows={4} className={`${inputClass} resize-none`} />
            </label>

            <label className="flex items-start gap-3 rounded-control border border-border-subtle bg-elevated p-3">
              <input type="checkbox" checked={Boolean(f.is_free_sample)} onChange={(e) => set("is_free_sample", e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-xs">
                <span className="block font-bold text-primary">Free sample</span>
                <span className="text-text-secondary">Anyone can read and download this project&apos;s SOW without Project Lab — a taste that sells the rest. The workspace stays paid.</span>
              </span>
            </label>

            <label className="block rounded-control border border-border-subtle bg-elevated p-3">
              <span className="block text-xs font-bold text-primary">Pasting from outside the workspace</span>
              <select value={String(f.authorship_mode)} onChange={(e) => set("authorship_mode", e.target.value)} className={`${inputClass} mt-2`}>
                <option value="strict">Refused — students write the code themselves (recommended)</option>
                <option value="open">Allowed — the paste guard is off for this project</option>
              </select>
              <span className="mt-2 block text-2xs leading-relaxed text-text-secondary">
                Copy-and-paste inside the workspace always works, and so do commands in the SOW&apos;s <code className="font-mono">bash</code> code blocks. Code you show in a SOW
                in another language (php, blade, js…) must be typed. Each submission gets an authorship check for the reviewer unless this is set to Allowed.
              </span>
            </label>
          </section>

          <section className="space-y-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-primary">Milestones</h2>
                <p className="mt-0.5 text-2xs text-text-secondary">What students tick off, and what a reviewer checks. Ticks survive renames and reordering.</p>
              </div>
              <button
                type="button"
                onClick={() => setMilestones((p) => [...p, { key: newKey(), title: "", description: "", criteria: "", estimated_hours: "4" }])}
                className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Add milestone
              </button>
            </div>

            {milestones.length === 0 && <p className="rounded-control border border-dashed border-border-strong p-4 text-center text-xs text-text-secondary">No milestones yet.</p>}

            <ol className="space-y-3">
              {milestones.map((m, i) => (
                <li key={m.key} className="rounded-control border border-border-subtle bg-elevated/60 p-3.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-2xs font-black text-accent-primary">{i + 1}</span>
                    <input
                      value={m.title}
                      onChange={(e) => updateMilestone(m.key, { title: e.target.value })}
                      placeholder="Patient registration"
                      aria-label={`Milestone ${i + 1} title`}
                      maxLength={200}
                      className={inputClass}
                    />
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded-control p-1.5 text-text-secondary hover:bg-surface hover:text-primary disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === milestones.length - 1} aria-label="Move down" className="rounded-control p-1.5 text-text-secondary hover:bg-surface hover:text-primary disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMilestones((p) => p.filter((x) => x.key !== m.key));
                          setSaved(false);
                        }}
                        aria-label="Remove milestone"
                        className="rounded-control p-1.5 text-text-secondary hover:bg-status-danger/10 hover:text-status-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 pl-8 sm:grid-cols-[1fr_90px]">
                    <label className="block">
                      <span className={labelClass}>Description</span>
                      <textarea value={m.description} onChange={(e) => updateMilestone(m.key, { description: e.target.value })} rows={2} maxLength={2000} className={`${inputClass} resize-none`} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Hours</span>
                      <input type="number" min={0} max={200} value={m.estimated_hours} onChange={(e) => updateMilestone(m.key, { estimated_hours: e.target.value })} className={inputClass} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className={labelClass}>Acceptance criteria (one per line — each must be checkable)</span>
                      <textarea
                        value={m.criteria}
                        onChange={(e) => updateMilestone(m.key, { criteria: e.target.value })}
                        rows={3}
                        placeholder={"A receptionist can register a new patient\nDuplicate phone numbers are rejected with a clear message"}
                        className={`${inputClass} resize-none`}
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ── Right: the SOW ── */}
        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle xl:sticky xl:top-36 xl:h-[calc(100vh-11rem)] xl:self-start">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3">
            <h2 className="mr-auto text-sm font-extrabold text-primary">Statement of Work</h2>
            <span className="text-2xs font-semibold text-text-secondary">{wordCount} words</span>
            <button
              type="button"
              onClick={async () => {
                if (sow.trim() === "" || (await confirmDialog({ title: "Replace the SOW with the blank template?", message: "Your current text will be lost.", tone: "warning", confirmLabel: "Replace" }))) set("sow_markdown", SOW_TEMPLATE);
              }}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Insert template
            </button>
            <div className="flex gap-0.5 rounded-control border border-border-subtle bg-elevated p-0.5" role="group" aria-label="SOW view">
              <button type="button" onClick={() => setSowView("source")} aria-pressed={sowView === "source"} className={cn("rounded-control px-2.5 py-1 text-2xs font-bold", sowView === "source" ? "bg-accent-primary text-white" : "text-text-secondary")}>
                Write
              </button>
              <button type="button" onClick={() => setSowView("preview")} aria-pressed={sowView === "preview"} className={cn("inline-flex items-center gap-1 rounded-control px-2.5 py-1 text-2xs font-bold", sowView === "preview" ? "bg-accent-primary text-white" : "text-text-secondary")}>
                <Eye className="h-3 w-3" />
                Preview
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sowView === "source" ? (
              <textarea
                value={sow}
                onChange={(e) => set("sow_markdown", e.target.value)}
                spellCheck={false}
                placeholder="Write the SOW in Markdown — or press Insert template for the standard structure."
                className="h-full min-h-[560px] w-full resize-none bg-transparent p-5 font-mono text-13 leading-relaxed text-primary outline-none"
              />
            ) : (
              <div className="mx-auto max-w-[680px] p-6">
                {sow.trim() ? <MarkdownRenderer content={sow} /> : <p className="text-xs italic text-text-secondary">The preview appears here as you write.</p>}
              </div>
            )}
          </div>

          {current && (
            <label className="flex shrink-0 items-start gap-3 border-t border-border-subtle bg-elevated/60 px-4 py-3">
              <input type="checkbox" checked={Boolean(f.bump_sow_version)} onChange={(e) => set("bump_sow_version", e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-2xs leading-snug text-text-secondary">
                <strong className="text-primary">This is a material change</strong> — raise the SOW to v{current.sow_version + 1} and tell students already on it that the SOW was updated.
                Leave unticked for typo fixes.
              </span>
            </label>
          )}
        </section>
      </div>
    </div>
  );
}
