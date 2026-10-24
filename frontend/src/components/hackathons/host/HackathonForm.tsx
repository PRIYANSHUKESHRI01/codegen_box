"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Info, Loader2, Lock, Plus, Rocket, Save, Trash2, X } from "lucide-react";
import { CoverArt } from "@/components/arena/primitives";
import { AudiencePicker } from "@/components/hackathons/host/AudiencePicker";
import { HostShell, useHostAccess } from "@/components/hackathons/host/hostKit";
import { HpButton, HpCard, HpSkeleton, hpBtn, hpInput, hpLabel } from "@/components/portal/kit";
import { ApiError } from "@/lib/api";
import { ACCENTS, MODE_LABEL, accentSwatch, accentVars, errorMessage } from "@/lib/hackathon";
import { emptyForm, flattenErrors, formFromHackathon, hostApi, hostPaths, payloadFromForm, validateForm, type FormState } from "@/lib/hackathonHost";
import { cn } from "@/lib/utils";
import type { HackathonMode, HostHackathonDetail, HostScope } from "@/types/hackathon";

const MAX_COVER_BYTES = 4 * 1024 * 1024;

/** The create / edit screen for a hackathon. `hackathonId` makes it an edit. */
export function HackathonForm({ scope, hackathonId }: { scope: HostScope; hackathonId?: number }) {
  const { status, hasAccess } = useHostAccess(scope);
  const router = useRouter();
  const paths = hostPaths(scope);
  const api = useMemo(() => hostApi(scope), [scope]);
  const canFeature = scope === "admin";

  const [existing, setExisting] = useState<HostHackathonDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(Boolean(hackathonId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | "save" | "publish">(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "ready" || !hasAccess || !hackathonId) return;
    let cancelled = false;

    api
      .get(hackathonId)
      .then((res) => {
        if (cancelled) return;
        setExisting(res.hackathon);
        setForm(formFromHackathon(res.hackathon));
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err, "Couldn't load this hackathon.")))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [status, hasAccess, hackathonId, api]);

  // Free the in-memory preview when it is replaced or the screen closes.
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const { [key as string]: _drop, ...rest } = e;
      return rest;
    });
    setSaved(null);
  };

  const setAudience = (audience: FormState["audience"], collegeIds: number[]) => {
    setForm((f) => ({ ...f, audience, collegeIds }));
    setErrors((e) => {
      const { audience: _drop, ...rest } = e;
      return rest;
    });
    setSaved(null);
  };

  /* What may no longer be changed, mirroring the server's rules (which remain the real enforcement). */
  const phase = existing?.phase;
  const started = phase === "live" || phase === "judging" || phase === "completed";
  const ended = phase === "judging" || phase === "completed";
  const hasPeople = (existing?.participants_count ?? 0) > 0;
  const judgingBegan = !!existing && existing.submitted_count > existing.unscored_count;
  const resultsOut = phase === "completed";
  const locked = {
    teamSize: hasPeople,
    starts: started,
    ends: ended,
    criteria: judgingBegan || resultsOut,
    prizes: resultsOut,
    cancelled: phase === "cancelled",
  };

  const sumWeights = form.criteria.filter((c) => c.name.trim()).reduce((n, c) => n + (Number(c.weight) || 0), 0);

  const pickCover = (file: File | null) => {
    setCoverError(null);
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setCoverError("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_COVER_BYTES) return setCoverError("That image is over 4 MB. Choose a smaller one.");

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      if (img.naturalWidth < 600 || img.naturalHeight < 300) {
        URL.revokeObjectURL(url);
        setCoverError("The image should be at least 600 × 300 pixels.");
        return;
      }

      if (existing) {
        setCoverBusy(true);
        try {
          const res = await api.uploadCover(existing.id, file);
          setExisting(res.hackathon);
          setSaved("Cover updated.");
        } catch (err) {
          setCoverError(errorMessage(err, "Couldn't upload the cover."));
        } finally {
          setCoverBusy(false);
          URL.revokeObjectURL(url);
        }
      } else {
        setPendingCover(file);
        setCoverPreview(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setCoverError("That file couldn't be read as an image.");
    };
    img.src = url;
  };

  const removeCover = async () => {
    setCoverError(null);

    if (!existing) {
      setPendingCover(null);
      setCoverPreview(null);
      return;
    }

    setCoverBusy(true);
    try {
      setExisting((await api.deleteCover(existing.id)).hackathon);
      setSaved("Cover removed.");
    } catch (err) {
      setCoverError(errorMessage(err, "Couldn't remove the cover."));
    } finally {
      setCoverBusy(false);
    }
  };

  const submit = async (publish: boolean) => {
    const found = validateForm(form);
    setErrors(found);
    setServerErrors([]);
    setSaved(null);

    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }

    setBusy(publish ? "publish" : "save");

    try {
      const body = payloadFromForm(form, canFeature);
      let record = existing ? (await api.update(existing.id, body)).hackathon : (await api.create(body)).hackathon;

      if (pendingCover) {
        try {
          record = (await api.uploadCover(record.id, pendingCover)).hackathon;
          setPendingCover(null);
        } catch {
          // The hackathon is saved; the cover can be added from the edit screen.
        }
      }

      if (publish && record.status === "draft") record = (await api.publish(record.id)).hackathon;

      if (!existing) {
        router.replace(paths.manage(record.id));
        return;
      }

      setExisting(record);
      setForm(formFromHackathon(record));
      setSaved(publish ? "Published — students can see it now." : "Changes saved.");
    } catch (err) {
      const messages = err instanceof ApiError ? [...flattenErrors(err.errors)] : [];
      setServerErrors(messages.length > 0 ? messages : [errorMessage(err, "Couldn't save the hackathon. Please try again.")]);
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } finally {
      setBusy(null);
    }
  };

  const title = hackathonId ? "Edit hackathon" : "New hackathon";
  const problems = [...Object.values(errors), ...serverErrors];
  const isDraft = !existing || existing.status === "draft";

  if (status === "ready" && hasAccess && loading) {
    return (
      <HostShell scope={scope} status={status} hasAccess={hasAccess} back={{ href: existing ? paths.manage(existing.id) : paths.list, label: existing ? "This hackathon" : "All hackathons" }} title={title}>
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <HpSkeleton key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      </HostShell>
    );
  }

  return (
    <HostShell scope={scope} status={status} hasAccess={hasAccess} title={title} subtitle={existing ? existing.title : "Describe the challenge, set the schedule and prizes, then publish when you're ready."}>
      {loadError && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
          {loadError}
        </div>
      )}

      {locked.cancelled && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" /> This hackathon was cancelled, so it can no longer be edited.
        </div>
      )}

      {problems.length > 0 && (
        <div ref={summaryRef} role="alert" tabIndex={-1} className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-100">
          <p className="font-bold">Please fix the following before saving:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-6 pb-28"
        noValidate
      >
        <fieldset disabled={locked.cancelled || busy !== null} className="space-y-6 disabled:opacity-80">
          {/* 1 ─ Basics */}
          <Section n={1} title="The basics" description="What students see first on the card and the top of the page.">
            <Field label="Title" htmlFor="h-title" error={errors.title}>
              <input id="h-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={160} className={hpInput} placeholder="e.g. AI for Bharat Build Sprint" />
            </Field>
            <Field label="Tagline" htmlFor="h-tagline" error={errors.tagline} hint="One line that makes someone want to click.">
              <input id="h-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={200} className={hpInput} placeholder="Ship an AI product that works for a billion people — in 72 hours." />
            </Field>
            <Field
              label="Description"
              htmlFor="h-desc"
              error={errors.description}
              hint="Markdown is supported: ## headings, **bold**, - bullet lists, [links](https://…). Explain the challenge, the format and why it's worth entering."
            >
              <textarea id="h-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={10} maxLength={20000} className={cn(hpInput, "resize-y font-mono text-xs leading-relaxed")} />
            </Field>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <span className={hpLabel}>Colour theme</span>
                <div role="radiogroup" aria-label="Colour theme" className="flex flex-wrap gap-2.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="radio"
                      aria-checked={form.accent === a}
                      aria-label={a}
                      title={a}
                      onClick={() => set("accent", a)}
                      style={{ background: accentSwatch(a) }}
                      className={cn("h-9 w-9 rounded-full ring-offset-2 ring-offset-[rgb(var(--bg-surface-rgb))] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", form.accent === a && "scale-110 ring-2 ring-primary")}
                    />
                  ))}
                </div>
                <p className="mt-2 text-2xs text-text-muted">Tints the card, the hero and the buttons on the hackathon page.</p>
              </div>

              <ThemesInput value={form.themes} onChange={(v) => set("themes", v)} />
            </div>

            <CoverPicker
              accent={form.accent}
              title={form.title || "Hackathon"}
              url={coverPreview ?? existing?.cover_url ?? null}
              hasCover={Boolean(coverPreview || existing?.has_cover)}
              pending={Boolean(pendingCover)}
              busy={coverBusy}
              error={coverError}
              onPick={pickCover}
              onRemove={removeCover}
            />
          </Section>

          {/* 2 ─ Format */}
          <Section n={2} title="Format & teams" description="Where it happens and how students enter.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Format" htmlFor="h-mode">
                <select id="h-mode" value={form.mode} onChange={(e) => set("mode", e.target.value as HackathonMode)} className={hpInput}>
                  {(Object.keys(MODE_LABEL) as HackathonMode[]).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={form.mode === "online" ? "Location (optional)" : "Location"} htmlFor="h-loc" error={errors.location} hint={form.mode === "online" ? "Leave blank for fully online." : "Venue and city, e.g. “Nimbus HQ, Bengaluru”."}>
                <input id="h-loc" value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={160} className={hpInput} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Min team size" htmlFor="h-min" error={errors.min_team_size} hint={form.min_team_size === "1" ? "1 allows solo entries." : undefined}>
                <input id="h-min" type="number" min={1} max={10} value={form.min_team_size} onChange={(e) => set("min_team_size", e.target.value)} disabled={locked.teamSize} className={hpInput} />
              </Field>
              <Field label="Max team size" htmlFor="h-max" error={errors.max_team_size} hint={form.max_team_size === "1" ? "Solo only." : undefined}>
                <input id="h-max" type="number" min={1} max={10} value={form.max_team_size} onChange={(e) => set("max_team_size", e.target.value)} disabled={locked.teamSize} className={hpInput} />
              </Field>
              <Field label="Participant cap" htmlFor="h-cap" error={errors.max_participants} hint="Students, not teams. Blank = no limit.">
                <input id="h-cap" type="number" min={2} value={form.max_participants} onChange={(e) => set("max_participants", e.target.value)} className={hpInput} placeholder="No limit" />
              </Field>
            </div>
            {locked.teamSize && <LockNote>Team size is locked because students have already registered.</LockNote>}
          </Section>

          {/* 3 ─ Audience */}
          <Section n={3} title="Who can join" description="Show it to every student, or only to the colleges you choose.">
            <AudiencePicker scope={scope} audience={form.audience} collegeIds={form.collegeIds} onChange={setAudience} error={errors.audience} hasRegistered={hasPeople} />
          </Section>

          {/* 3 ─ Schedule */}
          <Section n={4} title="Schedule" description="Times are in your local time zone; students see them in theirs.">
            {errors.schedule && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{errors.schedule}</p>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Registration opens" htmlFor="h-ropen" error={errors.registration_opens_at}>
                <input id="h-ropen" type="datetime-local" value={form.registration_opens_at} onChange={(e) => set("registration_opens_at", e.target.value)} className={hpInput} />
              </Field>
              <Field label="Registration closes" htmlFor="h-rclose" error={errors.registration_closes_at} hint="Can be after kickoff to allow late sign-ups.">
                <input id="h-rclose" type="datetime-local" value={form.registration_closes_at} onChange={(e) => set("registration_closes_at", e.target.value)} className={hpInput} />
              </Field>
              <Field label="Kickoff — building starts" htmlFor="h-start" error={errors.starts_at}>
                <input id="h-start" type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} disabled={locked.starts} className={hpInput} />
              </Field>
              <Field label="Submission deadline" htmlFor="h-end" error={errors.ends_at}>
                <input id="h-end" type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} disabled={locked.ends} className={hpInput} />
              </Field>
              <Field label="Results expected (optional)" htmlFor="h-res" error={errors.results_expected_at} hint="Shown on the schedule as “expected”. You publish results when judging is done.">
                <input id="h-res" type="datetime-local" value={form.results_expected_at} onChange={(e) => set("results_expected_at", e.target.value)} className={hpInput} />
              </Field>
            </div>
            {(locked.starts || locked.ends) && <LockNote>{locked.ends ? "The deadline has passed, so the schedule can't change." : "The hackathon has started, so its kickoff can't move — you can still extend the deadline."}</LockNote>}
          </Section>

          {/* 4 ─ Prizes */}
          <Section n={5} title="Prizes" description="What winners get. Prizes attach to ranks automatically when you publish results.">
            <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
              <Field label="Total prize pool" htmlFor="h-pool" error={errors.prize_pool_amount} hint="Enter 0 for a hackathon with perks but no cash.">
                <input id="h-pool" type="number" min={0} value={form.prize_pool_amount} onChange={(e) => set("prize_pool_amount", e.target.value)} className={hpInput} />
              </Field>
              <Field label="Currency" htmlFor="h-cur">
                <select id="h-cur" value={form.currency} onChange={(e) => set("currency", e.target.value)} className={hpInput}>
                  {["INR", "USD", "EUR", "GBP"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>

            {errors.prizes && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{errors.prizes}</p>}
            <div className="space-y-3">
              {form.prizes.map((p, i) => (
                <div key={i} className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-[84px_1fr_1fr]">
                    <Field label="Place" htmlFor={`pz-place-${i}`}>
                      <input id={`pz-place-${i}`} type="number" min={1} value={p.place} disabled={locked.prizes} onChange={(e) => set("prizes", form.prizes.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)))} className={hpInput} />
                    </Field>
                    <Field label="Title" htmlFor={`pz-title-${i}`}>
                      <input id={`pz-title-${i}`} value={p.title} disabled={locked.prizes} maxLength={80} onChange={(e) => set("prizes", form.prizes.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={hpInput} placeholder="Grand Champion" />
                    </Field>
                    <Field label="Reward" htmlFor={`pz-reward-${i}`}>
                      <input id={`pz-reward-${i}`} value={p.reward} disabled={locked.prizes} maxLength={80} onChange={(e) => set("prizes", form.prizes.map((x, j) => (j === i ? { ...x, reward: e.target.value } : x)))} className={hpInput} placeholder="₹75,000" />
                    </Field>
                  </div>
                  <Field label="Perks (one per line)" htmlFor={`pz-perks-${i}`}>
                    <textarea id={`pz-perks-${i}`} rows={2} value={p.perks} disabled={locked.prizes} onChange={(e) => set("prizes", form.prizes.map((x, j) => (j === i ? { ...x, perks: e.target.value } : x)))} className={hpInput} placeholder={"Fast-track interview\nAptRun Pro for a year"} />
                  </Field>
                  {!locked.prizes && <RemoveButton label="Remove prize" onClick={() => set("prizes", form.prizes.filter((_, j) => j !== i))} />}
                </div>
              ))}
              {!locked.prizes && form.prizes.length < 12 && (
                <AddButton onClick={() => set("prizes", [...form.prizes, { place: String(form.prizes.length + 1), title: "", reward: "", perks: "" }])}>Add a prize</AddButton>
              )}
              {locked.prizes && <LockNote>Results are published, so prizes are locked.</LockNote>}
            </div>
          </Section>

          {/* 5 ─ Judging */}
          <Section n={6} title="Judging criteria" description="How projects are marked. Leave this empty to use the standard four (Innovation, Technical depth, Impact, Presentation).">
            {errors.criteria && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{errors.criteria}</p>}
            <div className="space-y-3">
              {form.criteria.map((c, i) => (
                <div key={i} className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <Field label="Criterion" htmlFor={`cr-name-${i}`}>
                      <input id={`cr-name-${i}`} value={c.name} disabled={locked.criteria} maxLength={60} onChange={(e) => set("criteria", form.criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={hpInput} placeholder="Technical execution" />
                    </Field>
                    <Field label="Weight" htmlFor={`cr-w-${i}`}>
                      <input id={`cr-w-${i}`} type="number" min={1} max={100} value={c.weight} disabled={locked.criteria} onChange={(e) => set("criteria", form.criteria.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} className={hpInput} />
                    </Field>
                  </div>
                  <Field label="What judges look for" htmlFor={`cr-d-${i}`}>
                    <input id={`cr-d-${i}`} value={c.description} disabled={locked.criteria} maxLength={200} onChange={(e) => set("criteria", form.criteria.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={hpInput} />
                  </Field>
                  {!locked.criteria && <RemoveButton label="Remove criterion" onClick={() => set("criteria", form.criteria.filter((_, j) => j !== i))} />}
                </div>
              ))}

              {form.criteria.length > 0 && (
                <p className={cn("text-xs font-bold tabular-nums", Math.abs(sumWeights - 100) < 0.01 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300")} aria-live="polite">
                  Total weight: {Math.round(sumWeights * 100) / 100} / 100
                </p>
              )}

              {!locked.criteria && form.criteria.length < 8 && <AddButton onClick={() => set("criteria", [...form.criteria, { name: "", weight: form.criteria.length === 0 ? "100" : "", description: "" }])}>Add a criterion</AddButton>}
              {locked.criteria && <LockNote>Judging has started, so the criteria are locked.</LockNote>}
            </div>
          </Section>

          {/* 6 ─ Tracks */}
          <Section n={7} title="Tracks" description="Optional themes teams choose between. When set, a team must pick one to submit.">
            {errors.tracks && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{errors.tracks}</p>}
            <div className="space-y-3">
              {form.tracks.map((t, i) => (
                <div key={i} className="grid gap-3 rounded-2xl border border-border-subtle bg-elevated/40 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                  <Field label="Track name" htmlFor={`tr-n-${i}`}>
                    <input id={`tr-n-${i}`} value={t.name} maxLength={80} onChange={(e) => set("tracks", form.tracks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={hpInput} placeholder="Agri & Rural AI" />
                  </Field>
                  <Field label="Short description" htmlFor={`tr-d-${i}`}>
                    <input id={`tr-d-${i}`} value={t.description} maxLength={300} onChange={(e) => set("tracks", form.tracks.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={hpInput} />
                  </Field>
                  <RemoveButton label="Remove track" inline onClick={() => set("tracks", form.tracks.filter((_, j) => j !== i))} />
                </div>
              ))}
              {form.tracks.length < 12 && <AddButton onClick={() => set("tracks", [...form.tracks, { name: "", description: "" }])}>Add a track</AddButton>}
            </div>
          </Section>

          {/* 7 ─ Rules & FAQ */}
          <Section n={8} title="Rules, eligibility & FAQ" description="Set expectations up front so students don't have to ask.">
            <Field label="Who can take part" htmlFor="h-elig" hint="e.g. Final-year students; all branches welcome.">
              <input id="h-elig" value={form.eligibility} onChange={(e) => set("eligibility", e.target.value)} maxLength={1000} className={hpInput} />
            </Field>
            <Field label="Rules" htmlFor="h-rules" hint="Markdown supported — a bulleted list works well.">
              <textarea id="h-rules" rows={6} value={form.rules} onChange={(e) => set("rules", e.target.value)} maxLength={20000} className={cn(hpInput, "resize-y font-mono text-xs leading-relaxed")} />
            </Field>

            <div>
              <span className={hpLabel}>Frequently asked questions</span>
              <div className="space-y-3">
                {form.faqs.map((q, i) => (
                  <div key={i} className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
                    <Field label="Question" htmlFor={`fq-q-${i}`}>
                      <input id={`fq-q-${i}`} value={q.question} maxLength={200} onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} className={hpInput} />
                    </Field>
                    <Field label="Answer" htmlFor={`fq-a-${i}`}>
                      <textarea id={`fq-a-${i}`} rows={2} value={q.answer} maxLength={1000} onChange={(e) => set("faqs", form.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} className={hpInput} />
                    </Field>
                    <RemoveButton label="Remove question" onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))} />
                  </div>
                ))}
                {form.faqs.length < 15 && <AddButton onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}>Add a question</AddButton>}
              </div>
            </div>
          </Section>

          {/* 8 ─ Resources */}
          <Section n={9} title="Resources" description="Starter repos, API credits, guides — links students will want.">
            {errors.resources && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{errors.resources}</p>}
            <div className="space-y-3">
              {form.resources.map((r, i) => (
                <div key={i} className="grid gap-3 rounded-2xl border border-border-subtle bg-elevated/40 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                  <Field label="Label" htmlFor={`rs-l-${i}`}>
                    <input id={`rs-l-${i}`} value={r.label} maxLength={80} onChange={(e) => set("resources", form.resources.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={hpInput} placeholder="Starter repository" />
                  </Field>
                  <Field label="Link" htmlFor={`rs-u-${i}`}>
                    <input id={`rs-u-${i}`} type="url" value={r.url} maxLength={300} onChange={(e) => set("resources", form.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} className={hpInput} placeholder="https://…" />
                  </Field>
                  <RemoveButton label="Remove resource" inline onClick={() => set("resources", form.resources.filter((_, j) => j !== i))} />
                </div>
              ))}
              {form.resources.length < 10 && <AddButton onClick={() => set("resources", [...form.resources, { label: "", url: "" }])}>Add a resource</AddButton>}
            </div>
          </Section>

          {canFeature && (
            <Section n={10} title="Front-page placement" description="Only Ops can feature a hackathon.">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border-strong accent-indigo-600" />
                <span className="text-13">
                  <span className="font-bold text-primary">Feature this hackathon</span>
                  <span className="mt-0.5 block text-xs text-text-muted">It appears in the big hero at the top of the Arena lobby (when it&apos;s live or upcoming).</span>
                </span>
              </label>
            </Section>
          )}
        </fieldset>

        {/* Sticky action bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-[rgb(var(--bg-surface-rgb))]/92 px-4 py-3 backdrop-blur-xl md:pl-[calc(theme(spacing.rail)+1rem)]">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted" aria-live="polite">
              {saved ? <span className="font-bold text-emerald-600 dark:text-emerald-300">{saved}</span> : isDraft ? "Drafts are only visible to you." : "Changes go live as soon as you save."}
            </p>
            <div className="flex items-center gap-2.5">
              <Link href={existing ? paths.manage(existing.id) : paths.list} className={hpBtn("ghost", "md")}>
                Cancel
              </Link>
              <HpButton type="submit" variant="secondary" isLoading={busy === "save"} disabled={locked.cancelled} leftIcon={<Save className="h-4 w-4" />}>
                {isDraft ? "Save draft" : "Save changes"}
              </HpButton>
              {isDraft && (
                <HpButton type="button" variant="primary" onClick={() => submit(true)} isLoading={busy === "publish"} disabled={locked.cancelled} leftIcon={<Rocket className="h-4 w-4" />}>
                  Save & publish
                </HpButton>
              )}
            </div>
          </div>
        </div>
      </form>

    </HostShell>
  );
}

/* ── Building blocks ──────────────────────────────────────────────────────── */

function Section({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <HpCard spotlight={false} className="p-5 sm:p-7">
      <header className="mb-5 flex items-start gap-3.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-extrabold text-white">{n}</span>
        <div>
          <h2 className="text-15 font-extrabold tracking-tight text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </HpCard>
  );
}

function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={hpLabel}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-2xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}

function LockNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-200">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {children}
    </p>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-2.5 text-xs font-bold text-text-secondary transition-colors hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-300">
      <Plus className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function RemoveButton({ label, onClick, inline = false }: { label: string; onClick: () => void; inline?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-text-muted transition-colors hover:text-rose-600 dark:hover:text-rose-300", inline ? "h-10 w-10 justify-center" : "mt-3")}
    >
      <Trash2 className="h-3.5 w-3.5" /> {!inline && label}
    </button>
  );
}

function ThemesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "").slice(0, 30);
    if (!tag || value.length >= 8 || value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor="h-themes" className={hpLabel}>
        Themes
      </label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))] p-2 focus-within:border-indigo-500/60 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="rounded-full p-0.5 hover:bg-indigo-500/20">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input id="h-themes" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} placeholder={value.length === 0 ? "AI, Climate, FinTech…" : "Add another"} maxLength={30} className="min-w-[7rem] flex-1 bg-transparent px-1.5 py-1 text-13 text-primary outline-none placeholder:text-text-muted" />
      </div>
      <p className="mt-1.5 text-2xs text-text-muted">Students can filter by these. Press Enter or comma after each; up to 8.</p>
    </div>
  );
}

function CoverPicker({
  accent,
  title,
  url,
  hasCover,
  pending,
  busy,
  error,
  onPick,
  onRemove,
}: {
  accent: FormState["accent"];
  title: string;
  url: string | null;
  hasCover: boolean;
  pending: boolean;
  busy: boolean;
  error: string | null;
  onPick: (file: File | null) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div>
      <span className={hpLabel}>Cover image</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div style={accentVars(accent)} className="relative w-full overflow-hidden rounded-2xl border border-border-subtle sm:w-64">
          <CoverArt src={url} accent={accent} title={title} className="aspect-[16/9]" />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} onClick={(e) => ((e.target as HTMLInputElement).value = "")} aria-label="Upload a cover image" />
            <HpButton type="button" variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy} leftIcon={<ImagePlus className="h-3.5 w-3.5" />}>
              {hasCover ? "Replace image" : "Upload image"}
            </HpButton>
            {hasCover && (
              <HpButton type="button" variant="ghost" size="sm" onClick={onRemove} disabled={busy} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                Remove
              </HpButton>
            )}
          </div>
          <p className="flex items-start gap-1.5 text-2xs text-text-muted">
            <Info className="mt-px h-3 w-3 shrink-0" /> JPG, PNG or WebP, up to 4 MB, at least 600 × 300. 16:9 works best. Without one, a cover in your colour theme is generated.
          </p>
          {pending && <p className="text-2xs font-semibold text-indigo-600 dark:text-indigo-300">This image will be uploaded when you save.</p>}
          {error && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
