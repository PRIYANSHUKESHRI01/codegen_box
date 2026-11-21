"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, Check, CheckCircle2, ChevronDown, ChevronUp, Circle, Clock, Code2, ExternalLink, Github, Laptop, Link2, Loader2, Lock, Medal, Quote, Save, Send, Timer, Video, X, type LucideIcon } from "lucide-react";
import { useArenaDirty } from "@/components/arena/ArenaShell";
import { formatScore } from "@/components/arena/detail/Podium";
import { CountUp, EASE, Reveal } from "@/components/arena/motion";
import { ArenaMarkdown, Countdown, PageNotice } from "@/components/arena/primitives";
import { arenaApi, errorMessage, formatDateTime, isHttpUrl, ordinal, relativeTime } from "@/lib/hackathon";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HackathonDetail, MyProject } from "@/types/hackathon";

interface Form {
  title: string;
  tagline: string;
  description: string;
  track: string;
  repo_url: string;
  demo_url: string;
  video_url: string;
  tech_stack: string[];
}

const EMPTY: Form = { title: "", tagline: "", description: "", track: "", repo_url: "", demo_url: "", video_url: "", tech_stack: [] };

const toForm = (p: MyProject | null): Form =>
  p
    ? {
        title: p.title ?? "",
        tagline: p.tagline ?? "",
        description: p.description ?? "",
        track: p.track ?? "",
        repo_url: p.repo_url ?? "",
        demo_url: p.demo_url ?? "",
        video_url: p.video_url ?? "",
        tech_stack: p.tech_stack ?? [],
      }
    : EMPTY;

const MAX_TECH = 15;

type Errors = Partial<Record<keyof Form, string>>;

export function ProjectPanel({ hackathon, onChange }: { hackathon: HackathonDetail; onChange: (h: HackathonDetail) => void }) {
  const project = hackathon.my_submission;
  const access = hackathon.submission_access;
  const team = hackathon.my_team;
  const hasTracks = hackathon.tracks.length > 0;
  const submitted = project?.status === "submitted";

  const [form, setForm] = useState<Form>(() => toForm(project));
  const [saved, setSaved] = useState<Form>(() => toForm(project));
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [showProblem, setShowProblem] = useState(true);
  const [nowTime, setNowTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pick up a refreshed project (a teammate saved, or we just did) without clobbering unsaved typing.
  const serverKey = project ? `${project.id}:${project.updated_at}:${project.status}` : "none";
  useEffect(() => {
    const next = toForm(project);
    setSaved(next);
    setForm((current) => (JSON.stringify(current) === JSON.stringify(saved) ? next : current));
    // Only when the server copy changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  useArenaDirty(dirty && access.allowed);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setNotice(null);
  };

  const validate = (forSubmit: boolean): Errors => {
    const e: Errors = {};
    if (form.title.trim().length < 3) e.title = "Give your project a title (at least 3 characters).";

    (["repo_url", "demo_url", "video_url"] as const).forEach((k) => {
      if (form[k].trim() && !isHttpUrl(form[k].trim())) e[k] = "Enter a full link starting with https://";
    });

    if (forSubmit) {
      if (!form.description.trim()) e.description = "Describe what you built before submitting.";
      if (!form.repo_url.trim()) e.repo_url = "Add your repository link before submitting.";
      if (hasTracks && !form.track) e.track = "Pick the track you're entering.";
    }

    return e;
  };

  const save = async (submit: boolean) => {
    const found = validate(submit);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ tone: "error", text: "Fix the highlighted fields and try again." });
      return;
    }

    setBusy(submit ? "submit" : "draft");
    setNotice(null);

    try {
      const res = await arenaApi.saveProject(hackathon.slug, {
        title: form.title.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        track: form.track || null,
        repo_url: form.repo_url.trim() || null,
        demo_url: form.demo_url.trim() || null,
        video_url: form.video_url.trim() || null,
        tech_stack: form.tech_stack,
        submit,
      });

      onChange(res.hackathon);
      const next = toForm(res.hackathon.my_submission);
      setSaved(next);
      setForm(next);
      setNotice({ tone: "success", text: submit ? (submitted ? "Changes saved to your submission." : "Project submitted — good luck! You can keep improving it until the deadline.") : "Draft saved." });
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const fromServer: Errors = {};
        for (const [field, messages] of Object.entries(err.errors)) {
          if (field in EMPTY) fromServer[field as keyof Form] = messages[0];
        }
        setErrors(fromServer);
      }
      setNotice({ tone: "error", text: errorMessage(err, "Couldn't save your project. Please try again.") });
    } finally {
      setBusy(null);
    }
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "").slice(0, 30);
    if (!tag) return;
    if (form.tech_stack.length >= MAX_TECH) {
      setNotice({ tone: "error", text: `You can list up to ${MAX_TECH} technologies.` });
      return;
    }
    if (form.tech_stack.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    set("tech_stack", [...form.tech_stack, tag]);
    setTagDraft("");
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && tagDraft === "" && form.tech_stack.length > 0) {
      set("tech_stack", form.tech_stack.slice(0, -1));
    }
  };

  const readOnly = !access.allowed;
  const teamTooSmall = team && team.members.length < team.min_size;

  const readingMin = hackathon.reading_time_minutes ?? 15;
  const startTime = new Date(hackathon.starts_at).getTime();
  const readingEndTime = startTime + readingMin * 60 * 1000;
  const deadlineTime = new Date(hackathon.ends_at).getTime();
  const isReading = nowTime >= startTime && nowTime < readingEndTime && nowTime < deadlineTime;

  // What "Submit" will insist on — shown up front as a checklist so it never comes as a surprise.
  const checklist = [
    { label: "Title", done: form.title.trim().length >= 3 },
    { label: "Description", done: form.description.trim().length > 0 },
    { label: "Repository", done: form.repo_url.trim().length > 0 && isHttpUrl(form.repo_url.trim()) },
    ...(hasTracks ? [{ label: "Track", done: form.track !== "" }] : []),
  ];
  const ready = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      {hackathon.results_published && project && <ResultCard hackathon={hackathon} project={project} />}

      {access.code === "not_started" && (
        <div className="ar-raised flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 ring-1 ring-amber-300/30">
              <Clock className="h-5 w-5 text-amber-200" aria-hidden />
            </span>
            <div>
              <p className="text-[15.5px] font-semibold text-white">The project editor opens at kickoff</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--ar-text-2)]">Use the time to find teammates and plan. You can start building the moment the hackathon begins.</p>
            </div>
          </div>
          <Countdown target={hackathon.starts_at} size="sm" />
        </div>
      )}

      {access.code === "submissions_closed" && !hackathon.results_published && (
        <PageNotice tone="info">
          {submitted ? "Your project was submitted before the deadline. Judging is under way — results will appear here." : "The deadline has passed, so the project can no longer be edited."}
        </PageNotice>
      )}

      {/* Live Hackathon Status, Real-Time Countdown & Local Build Instructions */}
      {access.allowed && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#0c0d1c] via-[#10132b] to-[#151433] p-5 shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-300 ring-1 ring-rose-500/40">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                  Hackathon Active
                </span>

                {isReading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-amber-400/30">
                    <BookOpen className="h-3.5 w-3.5" /> {readingMin}m Problem Reading Phase
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30">
                    <Code2 className="h-3.5 w-3.5" /> Building & Submission Active
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-white">
                {isReading
                  ? "Read the problem statement thoroughly, plan system architecture, and prepare your local repo."
                  : "Build on your local laptop · Submit your GitHub Repo URL & Live Deployed Link before the deadline."}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/70">
                <span className="inline-flex items-center gap-1 text-indigo-200">
                  <Laptop className="h-3.5 w-3.5" /> Local Laptop Build (No Project Lab Needed)
                </span>
                <span className="inline-flex items-center gap-1 text-violet-200">
                  <Github className="h-3.5 w-3.5" /> GitHub Repo URL Required
                </span>
                <span className="inline-flex items-center gap-1 text-sky-200">
                  <Link2 className="h-3.5 w-3.5" /> Deployed Live Link Required
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-3 sm:text-right">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300 sm:justify-end">
                <Timer className="h-3.5 w-3.5" />
                {isReading ? "Reading Phase Left" : "Submission Window Left"}
              </p>
              <Countdown target={isReading ? (hackathon.reading_ends_at ?? new Date(readingEndTime).toISOString()) : hackathon.ends_at} size="sm" className="sm:justify-end" />
            </div>
          </div>
        </div>
      )}

      {/* Prominent Problem Statement Viewer */}
      {hackathon.problem_statement && (
        <div className="rounded-2xl border border-indigo-500/25 bg-[#0f1124] p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                <BookOpen className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Official Problem Statement</h3>
                <p className="text-2xs text-[color:var(--ar-text-3)]">Read the specifications and deliverables for this hackathon</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowProblem((s) => !s)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/5"
            >
              {showProblem ? (
                <>
                  Collapse <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  View Problem <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {showProblem && (
            <div className="dt-prose mt-4 max-h-96 overflow-y-auto pr-2">
              <ArenaMarkdown>{hackathon.problem_statement}</ArenaMarkdown>
            </div>
          )}
        </div>
      )}

      <Reveal y={12}>
        <section aria-labelledby="project-heading" className="ar-raised p-5 sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ar-eyebrow mb-2.5">Your project</p>
              <h2 id="project-heading" className="ar-h1 text-white">
                {project ? project.title : "Tell us what you're building"}
              </h2>
            </div>

            {project && (
              <div className="flex flex-col items-end gap-1.5">
                <span className="ar-chip ar-phase" data-tone={submitted ? "open" : "soon"}>
                  {submitted ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
                  {submitted ? "Submitted" : "Draft"}
                </span>
                {project.updated_at && <span className="text-[12px] text-[color:var(--ar-text-3)]">Saved {relativeTime(project.updated_at)}</span>}
              </div>
            )}
          </div>

          {readOnly && !project ? (
            <p className="ar-body">{access.message ?? "Project submission isn't open."}</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save(submitted);
              }}
              noValidate
            >
              {!readOnly && !submitted && (
                <div className="mb-7 rounded-2xl border border-white/[0.09] bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-white">Ready to submit</p>
                    <p className="ar-num text-[12.5px] font-semibold text-[color:var(--ar-text-2)]">
                      {ready} of {checklist.length}
                    </p>
                  </div>
                  <div className="dt-bar" data-thin="true" role="presentation">
                    <motion.span initial={false} animate={{ scaleX: ready / checklist.length }} transition={{ duration: 0.6, ease: EASE }} />
                  </div>
                  <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Submission checklist">
                    {checklist.map((c) => (
                      <li key={c.label} className={cn("flex items-center gap-1.5 text-[12.5px] font-medium transition-colors", c.done ? "text-emerald-200" : "text-[color:var(--ar-text-3)]")}>
                        {c.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
                        {c.label}
                        <span className="sr-only">{c.done ? " — done" : " — still needed"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <fieldset disabled={readOnly || busy !== null} className="min-w-0 disabled:opacity-90">
                <Group n={1} title="The basics" hint="What it is, in your own words.">
                  <Field label="Project title" htmlFor="p-title" required error={errors.title} counter={`${form.title.length}/120`}>
                    <input id="p-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className="ar-input" placeholder="e.g. KisanBol" aria-invalid={!!errors.title} />
                  </Field>

                  <Field label="One-line pitch" htmlFor="p-tagline" error={errors.tagline} counter={`${form.tagline.length}/200`} hint="What it does, in a sentence anyone would understand.">
                    <input id="p-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={200} className="ar-input" placeholder="A voice-first crop advisor for farmers, in their own language." />
                  </Field>

                  <Field label="Description" htmlFor="p-desc" required={false} error={errors.description} counter={`${form.description.length}/5000`} hint="The problem, your approach, what works today and what you'd build next. Plain text.">
                    <textarea id="p-desc" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} rows={7} className="ar-input resize-y leading-relaxed" aria-invalid={!!errors.description} />
                  </Field>
                </Group>

                {hasTracks && (
                  <Group n={2} title="Track" hint="Judges compare projects within a track.">
                    <Field label="Track" htmlFor="p-track" error={errors.track}>
                      <select id="p-track" value={form.track} onChange={(e) => set("track", e.target.value)} className="ar-input" aria-invalid={!!errors.track}>
                        <option value="">Choose a track…</option>
                        {hackathon.tracks.map((t) => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </Group>
                )}

                <Group n={hasTracks ? 3 : 2} title="Project Deliverables & Links" hint="Where judges and recruiters can inspect code and test the live build.">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="GitHub Repository URL" htmlFor="p-repo" required error={errors.repo_url} hint="Required. Provide your public GitHub repo link where your local code was pushed.">
                      <LinkInput icon={Github} id="p-repo" value={form.repo_url} onChange={(v) => set("repo_url", v)} placeholder="https://github.com/your-username/hackathon-project" invalid={!!errors.repo_url} />
                    </Field>
                    <Field label="Live Deployed Link" htmlFor="p-demo" error={errors.demo_url} hint="Your live deployment URL (Vercel, Netlify, Render, Railway, AWS, Cloudflare, etc.).">
                      <LinkInput icon={Link2} id="p-demo" value={form.demo_url} onChange={(v) => set("demo_url", v)} placeholder="https://your-app.vercel.app" invalid={!!errors.demo_url} />
                    </Field>
                  </div>

                  <Field label="Demo Video (optional)" htmlFor="p-video" error={errors.video_url} hint="A short walkthrough or demo (YouTube, Loom, Google Drive…)">
                    <LinkInput icon={Video} id="p-video" value={form.video_url} onChange={(v) => set("video_url", v)} placeholder="https://youtu.be/…" invalid={!!errors.video_url} />
                  </Field>
                </Group>

                <Group n={hasTracks ? 4 : 3} title="Built with" hint="The stack, so recruiters know what you can do.">
                  <div>
                    <label htmlFor="p-tech" className="sr-only">
                      Built with
                    </label>
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.17] bg-white/[0.05] p-2 transition-colors hover:border-white/30 focus-within:border-[rgb(var(--ar-a)/0.9)] focus-within:ring-[3px] focus-within:ring-[rgb(var(--ar-a)/0.25)]">
                      {form.tech_stack.map((t) => (
                        <motion.span key={t} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 26 }} className="ar-chip ar-chip-accent">
                          {t}
                          {!readOnly && (
                            <button type="button" onClick={() => set("tech_stack", form.tech_stack.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/20">
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          )}
                        </motion.span>
                      ))}
                      <input
                        id="p-tech"
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={onTagKey}
                        onBlur={() => addTag(tagDraft)}
                        placeholder={form.tech_stack.length === 0 ? "React, Python, Postgres…" : "Add another"}
                        maxLength={30}
                        className="min-w-[8rem] flex-1 bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-[color:var(--ar-text-3)]"
                      />
                    </div>
                    <p className="ar-hint">Press Enter or comma after each one. Up to {MAX_TECH}.</p>
                  </div>
                </Group>
              </fieldset>

              {notice && (
                <div className="mt-6">
                  <PageNotice tone={notice.tone}>{notice.text}</PageNotice>
                </div>
              )}

              {teamTooSmall && team && (
                <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Your team has {team.members.length} of the {team.min_size} members needed to submit. Share your invite code from the team panel.
                  </span>
                </div>
              )}

              {!readOnly && (
                <div className="dt-savebar mt-8">
                  <div className="ar-float flex flex-col gap-2.5 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
                    <p className="flex items-center gap-2.5 px-1 text-[13px] font-medium" role="status" aria-live="polite">
                      {dirty ? (
                        <>
                          <span className="ar-dot text-amber-300" aria-hidden />
                          <span className="text-amber-100">Unsaved changes</span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/40">
                            <Check className="h-3 w-3 text-emerald-300" strokeWidth={3} aria-hidden />
                          </span>
                          <span className="text-[color:var(--ar-text-2)]">All changes saved</span>
                        </>
                      )}
                    </p>
                    <div className={cn("grid gap-2 sm:flex", submitted ? "grid-cols-1" : "grid-cols-2")}>
                      {!submitted && (
                        <button type="button" onClick={() => save(false)} disabled={busy !== null || !dirty} className="ar-btn ar-btn-ghost">
                          {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                          Save draft
                        </button>
                      )}
                      <button type="button" onClick={() => save(true)} disabled={busy !== null || (submitted && !dirty)} className="ar-btn ar-btn-primary dt-cta">
                        {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                        {submitted ? "Save changes" : "Submit project"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!readOnly && !submitted && (
                <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-[color:var(--ar-text-3)]">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Submitting locks your team&apos;s membership so nobody can join after the work is in. You can keep editing the project until the deadline, {formatDateTime(hackathon.ends_at)}.
                  </span>
                </p>
              )}
            </form>
          )}
        </section>
      </Reveal>
    </div>
  );
}

/** A numbered cluster of related fields — the form reads as a few short steps, not one long scroll. */
function Group({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="dt-group">
      <div className="mb-5 flex items-center gap-3">
        <span className="dt-step-badge" aria-hidden>
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-[12.5px] text-[color:var(--ar-text-3)]">{hint}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function LinkInput({ icon: Icon, id, value, onChange, placeholder, invalid }: { icon: LucideIcon; id: string; value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ar-text-3)]" aria-hidden />
      <input id={id} type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} className="ar-input !pl-10" placeholder={placeholder} aria-invalid={invalid} />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  counter,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  counter?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-[color:var(--ar-text-2)]">
          {label}
          {required && (
            <span className="text-rose-300" aria-hidden>
              {" "}
              *
            </span>
          )}
        </label>
        {counter && <span className="ar-num text-[11px] text-[color:var(--ar-text-3)]">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p role="alert" className="ar-error">
          {error}
        </p>
      ) : (
        hint && <p className="ar-hint">{hint}</p>
      )}
    </div>
  );
}

/** The outcome, once the host has published results: placing, score, the marks behind it, and the judges' feedback. */
function ResultCard({ hackathon, project }: { hackathon: HackathonDetail; project: MyProject }) {
  if (project.is_disqualified) {
    return (
      <section className="rounded-3xl border border-rose-400/35 bg-rose-500/10 p-6">
        <p className="flex items-center gap-2 font-semibold text-rose-100">
          <AlertTriangle className="h-5 w-5" aria-hidden /> This project was disqualified
        </p>
        {project.disqualified_reason && <p className="mt-2 text-sm leading-relaxed text-rose-100/90">{project.disqualified_reason}</p>}
      </section>
    );
  }

  if (project.status !== "submitted") {
    return (
      <PageNotice tone="info">
        The results are out, but this team didn&apos;t submit a project before the deadline, so it isn&apos;t ranked.
      </PageNotice>
    );
  }

  const rank = project.rank;
  const metal = rank !== null && rank <= 3 ? rank : null;

  return (
    <section aria-labelledby="result-heading" className="ar-raised ar-hairline relative overflow-hidden p-5 sm:p-7">
      <div aria-hidden className={cn("pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full blur-3xl", metal === 1 ? "bg-amber-300/25" : metal === 2 ? "bg-slate-300/20" : metal === 3 ? "bg-orange-400/20" : "bg-[rgb(var(--ar-a)/0.25)]")} />

      <div className="relative flex flex-wrap items-center gap-4">
        {rank !== null && (
          <span className={cn("dt-medallion ar-shine !h-14 !w-14 shrink-0", metal ? `ar-metal-${metal}` : "!bg-white/10 !text-white")}>
            {metal ? <Medal className="h-6 w-6" aria-hidden strokeWidth={2.2} /> : <span className="text-[17px]">#{rank}</span>}
          </span>
        )}
        <div className="min-w-0">
          <p className="ar-eyebrow mb-2">Your result</p>
          <h3 id="result-heading" className="ar-h1 text-white">
            {rank !== null ? `${ordinal(rank)} place` : "Judged"}
            {project.award_label && <span className="font-medium text-[color:var(--ar-text-2)]"> · {project.award_label}</span>}
          </h3>
        </div>
        {project.score !== null && (
          <div className="ml-auto text-right">
            <p className={cn("ar-num text-[40px] font-extrabold leading-none tracking-[-0.035em]", metal ? `dt-metal-text-${metal}` : "text-white")}>
              <CountUp value={Math.round(project.score * 10)} format={formatScore} duration={1.4} />
            </p>
            <p className="mt-1.5 text-[12px] font-medium uppercase tracking-wider text-[color:var(--ar-text-3)]">out of 100</p>
          </div>
        )}
      </div>

      {hackathon.criteria.length > 0 && Object.keys(project.scores).length > 0 && (
        <ul className="relative mt-6 grid gap-3 sm:grid-cols-2" aria-label="Marks by criterion">
          {hackathon.criteria.map((c, i) => {
            const mark = project.scores[c.name];
            if (mark === undefined) return null;

            return (
              <li key={c.name} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="ar-num font-bold text-white">
                    {mark}
                    <span className="text-[12px] font-medium text-[color:var(--ar-text-3)]"> / 10</span>
                  </span>
                </div>
                <div className="dt-bar mt-3" data-thin="true" role="presentation">
                  <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: Math.min(1, mark / 10) }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.1 + i * 0.07, ease: EASE }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {project.feedback && (
        <figure className="relative mt-6 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-5">
          <Quote className="mb-2 h-5 w-5 text-[rgb(var(--ar-b))]" aria-hidden />
          <blockquote className="text-[15px] leading-relaxed text-[color:var(--ar-text-2)]">{project.feedback}</blockquote>
          <figcaption className="mt-3 text-[12px] font-medium text-[color:var(--ar-text-3)]">Feedback from the judges</figcaption>
        </figure>
      )}

      {project.repo_url && (
        <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="relative mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[rgb(var(--ar-b))] hover:underline">
          Open your repository <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </section>
  );
}
