"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Gavel,
  Building2,
  Github,
  Globe2,
  Megaphone,
  Pencil,
  Play,
  Rocket,
  Send,
  Trash2,
  Trophy,
  Undo2,
  Users,
  Video,
} from "lucide-react";
import { CoverArt } from "@/components/arena/primitives";
import { HostShell, PhasePill, useHostAccess, whenLabel } from "@/components/hackathons/host/hostKit";
import { HpButton, HpCard, HpEmptyState, HpPill, HpSearch, HpSkeleton, HpStatCard, HpTabs, HpToast, hpBtn, hpInput, hpLabel, hpTh } from "@/components/portal/kit";
import { Modal } from "@/components/ui/Modal";
import { accentVars, compactMoney, errorMessage, formatDateTime, formatRange, hackathonHref } from "@/lib/hackathon";
import { hostApi, hostPaths } from "@/lib/hackathonHost";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";
import type { HackathonCriterion, HostHackathonDetail, HostRegistration, HostScope, HostSubmission } from "@/types/hackathon";

type Tab = "overview" | "registrations" | "judging" | "updates";

export function HackathonManage({ scope, id }: { scope: HostScope; id: number }) {
  const { status, hasAccess } = useHostAccess(scope);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paths = hostPaths(scope);
  const api = useMemo(() => hostApi(scope), [scope]);

  const [h, setH] = useState<HostHackathonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "cancel" | "delete" | "publish-results">(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tab = (["overview", "registrations", "judging", "updates"].includes(params.get("tab") ?? "") ? params.get("tab") : "overview") as Tab;

  const refresh = useCallback(async () => {
    try {
      setH((await api.get(id)).hackathon);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load this hackathon."));
    }
  }, [api, id]);

  useEffect(() => {
    if (status === "ready" && hasAccess && id) refresh();
  }, [status, hasAccess, id, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const goTab = (next: Tab) => router.replace(`${pathname}?id=${id}&tab=${next}`, { scroll: false });

  const act = async (fn: () => Promise<{ hackathon: HostHackathonDetail }>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      setH((await fn()).hackathon);
      setToast(done);
      setDialog(null);
    } catch (err) {
      setActionError(errorMessage(err, "That didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HostShell scope={scope} status={status} hasAccess={hasAccess} back={{ href: paths.list, label: "All hackathons" }} title="Manage hackathon" subtitle={h?.title}>
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {!h && !error && (
        <div className="space-y-4" aria-busy="true">
          <HpSkeleton className="h-44 rounded-[20px]" />
          <HpSkeleton className="h-64 rounded-[20px]" />
        </div>
      )}

      {h && (
        <>
          <Header h={h} scope={scope} onCancel={() => setDialog("cancel")} onDelete={() => setDialog("delete")} onAct={act} api={api} setActionError={setActionError} />

          {actionError && !dialog && (
            <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
              {actionError}
            </div>
          )}

          <HpTabs
            value={tab}
            onChange={goTab}
            tabs={[
              { id: "overview", label: "Overview", icon: Rocket },
              { id: "registrations", label: "Registrations", icon: Users, count: h.participants_count },
              { id: "judging", label: "Judging", icon: Gavel, count: h.unscored_count > 0 ? h.unscored_count : undefined },
              { id: "updates", label: "Updates", icon: Megaphone, count: h.announcements.length },
            ]}
          />

          {tab === "overview" && <Overview h={h} editHref={paths.edit(h.id)} />}
          {tab === "registrations" && <Registrations h={h} api={api} />}
          {tab === "judging" && <Judging h={h} api={api} onChanged={refresh} onPublish={() => setDialog("publish-results")} />}
          {tab === "updates" && <Updates h={h} api={api} onChanged={refresh} notify={setToast} />}
        </>
      )}

      {/* Cancel */}
      {h && (
        <CancelDialog
          open={dialog === "cancel"}
          title={h.title}
          registered={h.participants_count}
          busy={busy}
          error={actionError}
          onClose={() => {
            setDialog(null);
            setActionError(null);
          }}
          onConfirm={(reason) => act(() => api.cancel(h.id, reason), "Hackathon cancelled.")}
        />
      )}

      {/* Delete */}
      {h && dialog === "delete" && (
        <Modal
          onClose={() => !busy && setDialog(null)}
          title="Delete this hackathon?"
          subtitle="This permanently removes the draft. It can't be undone."
          icon={Trash2}
          iconClassName="bg-rose-500/10 text-rose-500"
          size="sm"
          footer={
            <>
              <HpButton variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
                Keep it
              </HpButton>
              <HpButton
                variant="danger"
                isLoading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.remove(h.id);
                    router.replace(paths.list);
                  } catch (err) {
                    setActionError(errorMessage(err, "Couldn't delete this hackathon."));
                    setBusy(false);
                  }
                }}
              >
                Delete
              </HpButton>
            </>
          }
        >
          {actionError && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{actionError}</p>}
          <p className="text-13 text-text-secondary">
            “{h.title}” will be removed along with its schedule, prizes and updates.
          </p>
        </Modal>
      )}

      {/* Publish results */}
      {h && dialog === "publish-results" && (
        <Modal
          onClose={() => !busy && setDialog(null)}
          title={h.results_published_at ? "Re-publish results?" : "Publish results?"}
          subtitle="Projects are ranked by score and prizes are attached to each place."
          icon={Trophy}
          iconClassName="bg-amber-500/10 text-amber-500"
          size="md"
          footer={
            <>
              <HpButton variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
                Not yet
              </HpButton>
              <HpButton
                variant="primary"
                isLoading={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError(null);
                  try {
                    const res = await api.publishResults(h.id);
                    setH(res.hackathon);
                    setToast(`Results published — ${res.outcome.ranked} project${res.outcome.ranked === 1 ? "" : "s"} ranked.`);
                    setDialog(null);
                  } catch (err) {
                    setActionError(errorMessage(err, "Couldn't publish results."));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {h.results_published_at ? "Re-publish" : "Publish results"}
              </HpButton>
            </>
          }
        >
          {actionError && <p role="alert" className="mb-3 text-xs font-semibold text-rose-600 dark:text-rose-300">{actionError}</p>}
          <ul className="list-disc space-y-1.5 pl-5 text-13 leading-relaxed text-text-secondary">
            <li>Students see their rank, score and your feedback straight away.</li>
            <li>The leaderboard and podium become public to everyone in the Arena.</li>
            <li>Ties go to the team that submitted first. Disqualified projects are not ranked.</li>
            {h.results_published_at && <li>Ranks are recomputed from the current scores — use this after correcting a score or a disqualification.</li>}
          </ul>
        </Modal>
      )}

      <HpToast message={toast} />
    </HostShell>
  );
}

/* ── Header & lifecycle ───────────────────────────────────────────────────── */

function Header({
  h,
  scope,
  onCancel,
  onDelete,
  onAct,
  api,
  setActionError,
}: {
  h: HostHackathonDetail;
  scope: HostScope;
  onCancel: () => void;
  onDelete: () => void;
  onAct: (fn: () => Promise<{ hackathon: HostHackathonDetail }>, done: string) => Promise<void>;
  api: ReturnType<typeof hostApi>;
  setActionError: (m: string | null) => void;
}) {
  const paths = hostPaths(scope);
  const canUnpublish = h.status === "published" && h.participants_count === 0;
  const canCancel = h.status === "published" && h.phase !== "completed";
  const canDelete = (h.status === "draft" || h.status === "cancelled") && h.participants_count === 0;

  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="relative lg:w-72 lg:shrink-0" style={accentVars(h.accent)}>
          <CoverArt src={h.cover_url} accent={h.accent} title={h.title} className="h-44 lg:h-full lg:min-h-[190px]" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PhasePill phase={h.phase} />
              {h.host.type === "company" && <HpPill tone="teal">Hosted by {h.host.name}</HpPill>}
              <HpPill tone={h.audience === "colleges" ? "sky" : "slate"} icon={h.audience === "colleges" ? Building2 : Globe2}>
                {h.audience === "colleges" ? `${h.college_count} college${h.college_count === 1 ? "" : "s"}` : "All students"}
              </HpPill>
              {h.is_featured && <HpPill tone="amber">Featured</HpPill>}
            </div>
            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-primary">{h.title}</h2>
            <p className="mt-1 text-13 text-text-secondary">
              {formatRange(h.starts_at, h.ends_at)} · deadline {formatDateTime(h.ends_at)} · {compactMoney(h.prize_pool.amount, h.prize_pool.currency)}
            </p>
          </div>

          {h.status === "cancelled" && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Cancelled{h.cancelled_reason ? `: ${h.cancelled_reason}` : "."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {h.status === "draft" && (
              <HpButton variant="primary" leftIcon={<Rocket className="h-4 w-4" />} onClick={() => onAct(() => api.publish(h.id), "Published — students can see it now.")}>
                Publish
              </HpButton>
            )}
            <Link href={paths.edit(h.id)} className={hpBtn("secondary", "md")}>
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <Link href={hackathonHref(h.slug)} className={hpBtn("secondary", "md")}>
              <Eye className="h-4 w-4" /> {h.status === "draft" ? "Preview as a student" : "View in the Arena"}
            </Link>
            {canUnpublish && (
              <HpButton variant="ghost" onClick={() => onAct(() => api.unpublish(h.id), "Moved back to draft.")}>
                Unpublish
              </HpButton>
            )}
            {canCancel && (
              <HpButton
                variant="danger"
                onClick={() => {
                  setActionError(null);
                  onCancel();
                }}
              >
                Cancel hackathon
              </HpButton>
            )}
            {canDelete && (
              <HpButton
                variant="danger"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setActionError(null);
                  onDelete();
                }}
              >
                Delete
              </HpButton>
            )}
          </div>
        </div>
      </div>
    </HpCard>
  );
}

function CancelDialog({ open, title, registered, busy, error, onClose, onConfirm }: { open: boolean; title: string; registered: number; busy: boolean; error: string | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <Modal
      onClose={() => !busy && onClose()}
      title="Cancel this hackathon?"
      subtitle={registered > 0 ? `${registered} student${registered === 1 ? " is" : "s are"} registered. They will no longer see it in the Arena.` : "It will disappear from the Arena."}
      icon={AlertTriangle}
      iconClassName="bg-rose-500/10 text-rose-500"
      size="md"
      footer={
        <>
          <HpButton variant="ghost" onClick={onClose} disabled={busy}>
            Keep it running
          </HpButton>
          <HpButton variant="danger" isLoading={busy} disabled={reason.trim().length < 5} onClick={() => onConfirm(reason.trim())}>
            Cancel hackathon
          </HpButton>
        </>
      }
    >
      <p className="mb-3 text-13 text-text-secondary">“{title}” can&apos;t be reopened once cancelled.</p>
      <label htmlFor="cancel-reason" className={hpLabel}>
        Reason (kept for the record)
      </label>
      <textarea id="cancel-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={hpInput} placeholder="e.g. The venue fell through." />
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
    </Modal>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────────── */

function Overview({ h, editHref }: { h: HostHackathonDetail; editHref: string }) {
  const [copied, setCopied] = useState(false);
  const checks = readiness(h);
  const link = typeof window !== "undefined" ? `${window.location.origin}${hackathonHref(h.slug)}` : hackathonHref(h.slug);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is shown for manual copy */
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HpStatCard label="Registered" value={h.participants_count} icon={Users} tone="emerald" hint={h.max_participants ? `of ${h.max_participants} spots` : "No cap"} />
        <HpStatCard label="Teams" value={h.teams_count} icon={Rocket} tone="violet" hint={`${h.min_team_size}–${h.max_team_size} per team`} />
        <HpStatCard label="Submitted" value={h.submitted_count} icon={Send} tone="indigo" hint={h.teams_count ? `${Math.round((h.submitted_count / h.teams_count) * 100)}% of teams` : "—"} />
        <HpStatCard label="To score" value={h.unscored_count} icon={ClipboardCheck} tone={h.unscored_count > 0 ? "amber" : "teal"} hint={h.unscored_count > 0 ? "Open the Judging tab" : "Nothing waiting"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {h.status === "draft" && (
          <HpCard spotlight={false} className="p-5 sm:p-6">
            <h3 className="text-15 font-extrabold tracking-tight text-primary">Before you publish</h3>
            <ul className="mt-4 space-y-3">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 text-13">
                  {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", c.required ? "text-rose-500" : "text-amber-500")} />}
                  <span>
                    <span className="font-semibold text-primary">{c.label}</span>
                    {!c.ok && <span className="block text-xs text-text-muted">{c.hint}{c.required ? "" : " (recommended)"}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </HpCard>
        )}

        <HpCard spotlight={false} className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-15 font-extrabold tracking-tight text-primary">Audience</h3>
            <Link href={editHref} className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">
              Change
            </Link>
          </div>
          {h.audience === "all" ? (
            <p className="mt-3 flex items-start gap-3 text-13 text-text-secondary">
              <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                <span className="font-bold text-primary">Every student.</span> It is shown to everyone on AptRun, including students who aren&apos;t part of a college.
              </span>
            </p>
          ) : (
            <>
              <p className="mt-3 flex items-start gap-3 text-13 text-text-secondary">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                <span>
                  <span className="font-bold text-primary">
                    {h.college_count} college{h.college_count === 1 ? "" : "s"} only.
                  </span>{" "}
                  Students of these colleges see it{h.status === "published" ? " now" : " the moment you publish"}. Nobody else does, and there&apos;s no approval step.
                </span>
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Colleges this hackathon is mapped to">
                {h.colleges.map((c) => (
                  <li key={c.id} title={c.name} className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
                    {c.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </HpCard>

        <HpCard spotlight={false} className="p-5 sm:p-6">
          <h3 className="text-15 font-extrabold tracking-tight text-primary">Schedule</h3>
          <dl className="mt-4 space-y-3 text-13">
            {[
              ["Registration opens", h.registration_opens_at],
              ["Registration closes", h.registration_closes_at],
              ["Kickoff", h.starts_at],
              ["Submission deadline", h.ends_at],
              [h.results_published_at ? "Results published" : "Results expected", h.results_published_at ?? h.results_expected_at],
            ].map(([label, at]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                <dt className="text-text-secondary">{label}</dt>
                <dd className="font-bold text-primary">{whenLabel(at as string | null)}</dd>
              </div>
            ))}
          </dl>
        </HpCard>

        {h.status === "published" && (
          <HpCard spotlight={false} className="p-5 sm:p-6">
            <h3 className="text-15 font-extrabold tracking-tight text-primary">Share it</h3>
            <p className="mt-1 text-xs text-text-muted">Students find it in the Arena, or you can send them this link (they&apos;ll need to sign in).</p>
            <div className="mt-4 flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Hackathon link" className={cn(hpInput, "min-w-0 flex-1 font-mono text-xs")} />
              <HpButton variant="secondary" onClick={copy} leftIcon={<Copy className="h-4 w-4" />}>
                {copied ? "Copied" : "Copy"}
              </HpButton>
            </div>
          </HpCard>
        )}
      </div>
    </div>
  );
}

/** What stands between a draft and a good launch: required items block publishing, recommended ones just make it better. */
function readiness(h: HostHackathonDetail): { label: string; ok: boolean; required: boolean; hint: string }[] {
  const future = new Date(h.ends_at).getTime() > Date.now();
  const needsLocation = h.mode !== "online";

  return [
    { label: "Deadline is in the future", ok: future, required: true, hint: "Move the dates forward in Edit." },
    ...(needsLocation ? [{ label: "Location added", ok: Boolean(h.location), required: true, hint: "In-person and hybrid hackathons need a location." }] : []),
    { label: "Cover image", ok: h.has_cover, required: false, hint: "A picture makes the card far more clickable." },
    { label: "Prizes listed", ok: h.prizes.length > 0, required: false, hint: "Students want to know what they're competing for." },
    { label: "Rules & eligibility", ok: Boolean(h.rules || h.eligibility), required: false, hint: "Set expectations up front." },
    { label: "Tracks or judging criteria", ok: h.tracks.length > 0 || h.criteria.length > 0, required: false, hint: "Standard criteria are used if you add none." },
  ];
}

/* ── Registrations ────────────────────────────────────────────────────────── */

function Registrations({ h, api }: { h: HostHackathonDetail; api: ReturnType<typeof hostApi> }) {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 350);
  const [rows, setRows] = useState<HostRegistration[] | null>(null);
  const [totals, setTotals] = useState({ participants: 0, teams: 0 });
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    api
      .registrations(h.id, q)
      .then((res) => {
        if (cancelled) return;
        setRows(res.registrations);
        setTotals(res.totals);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Couldn't load registrations.")));

    return () => {
      cancelled = true;
    };
  }, [api, h.id, q]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportRegistrations(h.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${h.slug}-registrations.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "Couldn't export the list."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HpSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or team…" aria-label="Search registrations" wrapperClassName="w-full sm:w-80" />
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-text-muted">
            {totals.participants} student{totals.participants === 1 ? "" : "s"} · {totals.teams} team{totals.teams === 1 ? "" : "s"}
          </p>
          <HpButton variant="secondary" size="sm" onClick={exportCsv} isLoading={exporting} leftIcon={<Download className="h-3.5 w-3.5" />} disabled={totals.participants === 0}>
            Export CSV
          </HpButton>
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

      {rows === null && !error ? (
        <HpSkeleton className="h-64 rounded-[20px]" />
      ) : rows && rows.length === 0 ? (
        <HpEmptyState icon={Users} tone="emerald" title={q ? "No one matches that search" : "No registrations yet"} description={q ? "Try a different name, email or team." : "When students register, they appear here with their team."} />
      ) : (
        <HpCard spotlight={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-13">
              <thead className="border-b border-border-subtle bg-elevated/50">
                <tr>
                  <th className={hpTh}>Student</th>
                  <th className={hpTh}>College</th>
                  <th className={hpTh}>Team</th>
                  <th className={hpTh}>Role</th>
                  <th className={hpTh}>Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows?.map((r) => (
                  <tr key={r.id} className="hover:bg-elevated/40">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-primary">{r.student.name}</p>
                      <p className="text-xs text-text-muted">{r.student.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {r.student.college ?? "—"}
                      {r.student.branch && <span className="block text-xs text-text-muted">{r.student.branch}</span>}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-primary">{r.team.name}</td>
                    <td className="px-5 py-3.5">{r.role === "leader" ? <HpPill tone="amber" size="sm">Leader</HpPill> : <span className="text-text-muted">Member</span>}</td>
                    <td className="px-5 py-3.5 text-text-secondary">{whenLabel(r.registered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HpCard>
      )}
    </div>
  );
}

/* ── Judging ──────────────────────────────────────────────────────────────── */

type Verdict = "all" | "to_score" | "scored" | "dq" | "drafts";

function Judging({ h, api, onChanged, onPublish }: { h: HostHackathonDetail; api: ReturnType<typeof hostApi>; onChanged: () => void; onPublish: () => void }) {
  const [data, setData] = useState<{ submissions: HostSubmission[]; criteria: HackathonCriterion[]; judging_open: boolean; unscored_count: number; results_published: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Verdict>("all");
  const [open, setOpen] = useState<HostSubmission | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.submissions(h.id));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the projects."));
    }
  }, [api, h.id]);

  useEffect(() => {
    load();
  }, [load]);

  const subs = data?.submissions ?? [];
  const inContention = subs.filter((s) => s.status === "submitted" && !s.is_disqualified);
  const scored = inContention.filter((s) => s.final_score !== null);
  const pct = inContention.length ? Math.round((scored.length / inContention.length) * 100) : 0;

  const visible = subs.filter((s) => {
    if (filter === "to_score") return s.status === "submitted" && !s.is_disqualified && s.final_score === null;
    if (filter === "scored") return s.final_score !== null && !s.is_disqualified;
    if (filter === "dq") return s.is_disqualified;
    if (filter === "drafts") return s.status === "draft";
    return true;
  });

  const afterChange = (updated: HostSubmission, unscored: number) => {
    setData((d) => (d ? { ...d, unscored_count: unscored, submissions: d.submissions.map((s) => (s.id === updated.id ? updated : s)) } : d));
    // Keep the dialog on this project only while it is still open (a disqualification or reinstatement changes it in place).
    setOpen((current) => (current && current.id === updated.id ? updated : current));
    onChanged();
  };

  if (error) return <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-300">{error}</p>;
  if (!data) return <HpSkeleton className="h-64 rounded-[20px]" />;

  const canPublish = data.judging_open && inContention.length > 0 && data.unscored_count === 0;

  return (
    <div className="space-y-5">
      {!data.judging_open && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-13 text-sky-800 dark:text-sky-200">
          <Gavel className="mt-0.5 h-4 w-4 shrink-0" /> Judging opens once the submission deadline passes ({formatDateTime(h.ends_at)}). You can browse what teams have saved so far.
        </div>
      )}

      <HpCard spotlight={false} className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-15 font-extrabold tracking-tight text-primary">{h.results_published_at ? "Results are published" : "Scoring progress"}</h3>
            <p className="mt-1 text-xs text-text-muted">
              {inContention.length === 0
                ? "No submitted projects yet."
                : `${scored.length} of ${inContention.length} submitted project${inContention.length === 1 ? "" : "s"} scored${data.unscored_count > 0 ? ` — ${data.unscored_count} to go` : ""}.`}
            </p>
          </div>
          <HpButton
            variant={h.results_published_at ? "secondary" : "primary"}
            leftIcon={<Trophy className="h-4 w-4" />}
            disabled={!canPublish}
            title={!canPublish ? (data.judging_open ? "Score every submitted project first" : "Judging hasn't opened yet") : undefined}
            onClick={onPublish}
          >
            {h.results_published_at ? "Re-publish results" : "Publish results"}
          </HpButton>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Scoring progress">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </HpCard>

      <HpTabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: "all", label: "All", count: subs.length },
          { id: "to_score", label: "To score", count: data.unscored_count },
          { id: "scored", label: "Scored", count: scored.length },
          { id: "dq", label: "Disqualified", count: subs.filter((s) => s.is_disqualified).length },
          { id: "drafts", label: "Not submitted", count: subs.filter((s) => s.status === "draft").length },
        ]}
      />

      {visible.length === 0 ? (
        <HpEmptyState icon={ClipboardCheck} tone="indigo" title="Nothing here" description={subs.length === 0 ? "No project has been saved yet. They'll appear here as teams work." : "No projects match this filter."} />
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li key={s.id}>
              <HpCard spotlight={false} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="flex w-12 shrink-0 flex-col items-center">
                    {s.rank !== null && !s.is_disqualified ? (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-sm font-extrabold text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300">#{s.rank}</span>
                    ) : (
                      <span className="text-lg font-extrabold tabular-nums text-primary">{s.final_score ?? "–"}</span>
                    )}
                    {s.rank !== null && s.final_score !== null && <span className="mt-1 text-2xs font-bold tabular-nums text-text-muted">{s.final_score}</span>}
                  </div>

                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-extrabold text-primary">{s.title}</h4>
                      {s.is_disqualified ? (
                        <HpPill tone="rose" size="sm" icon={Ban}>Disqualified</HpPill>
                      ) : s.status === "draft" ? (
                        <HpPill tone="slate" size="sm">Not submitted</HpPill>
                      ) : s.final_score === null ? (
                        <HpPill tone="amber" size="sm">Needs scoring</HpPill>
                      ) : (
                        <HpPill tone="emerald" size="sm" icon={CheckCircle2}>Scored</HpPill>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {s.team.name} · {s.team.size} member{s.team.size === 1 ? "" : "s"}
                      {s.track ? ` · ${s.track}` : ""}
                      {s.submitted_at ? ` · submitted ${whenLabel(s.submitted_at)}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <HpButton size="sm" variant={s.final_score === null && s.status === "submitted" && !s.is_disqualified ? "primary" : "secondary"} onClick={() => setOpen(s)}>
                      {s.status === "draft" ? "View" : s.final_score === null ? "Score" : "Review"}
                    </HpButton>
                  </div>
                </div>
              </HpCard>
            </li>
          ))}
        </ul>
      )}

      {open && <ScoreDialog h={h} api={api} criteria={data.criteria} submission={open} judgingOpen={data.judging_open} resultsPublished={Boolean(h.results_published_at)} onClose={() => setOpen(null)} onChanged={afterChange} />}
    </div>
  );
}

function ScoreDialog({
  h,
  api,
  criteria,
  submission,
  judgingOpen,
  resultsPublished,
  onClose,
  onChanged,
}: {
  h: HostHackathonDetail;
  api: ReturnType<typeof hostApi>;
  criteria: HackathonCriterion[];
  submission: HostSubmission;
  judgingOpen: boolean;
  resultsPublished: boolean;
  onClose: () => void;
  onChanged: (s: HostSubmission, unscored: number) => void;
}) {
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((c) => [c.name, submission.scores?.[c.name] !== undefined ? String(submission.scores[c.name]) : ""])));
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [reason, setReason] = useState("");
  const [dqOpen, setDqOpen] = useState(false);
  const [busy, setBusy] = useState<null | "score" | "dq" | "reinstate">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarks(Object.fromEntries(criteria.map((c) => [c.name, submission.scores?.[c.name] !== undefined ? String(submission.scores[c.name]) : ""])));
    setFeedback(submission.feedback ?? "");
    setDqOpen(false);
    setReason("");
    setError(null);
    // Re-seed only when switching to another project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission.id]);

  const canScore = judgingOpen && submission.status === "submitted" && !submission.is_disqualified;
  const complete = criteria.every((c) => marks[c.name] !== "" && Number(marks[c.name]) >= 0 && Number(marks[c.name]) <= 10);
  const totalWeight = criteria.reduce((n, c) => n + c.weight, 0) || 100;
  const preview = complete ? Math.round(criteria.reduce((n, c) => n + (Number(marks[c.name]) / 10) * c.weight, 0) * (100 / totalWeight) * 100) / 100 : null;

  const run = async <T,>(kind: "score" | "dq" | "reinstate", fn: () => Promise<T>, done: (r: T) => void) => {
    setBusy(kind);
    setError(null);
    try {
      done(await fn());
    } catch (err) {
      setError(errorMessage(err, "That didn't work. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      onClose={() => !busy && onClose()}
      title={submission.title}
      subtitle={`${submission.team.name} · ${submission.team.members.map((m) => m.name).join(", ")}`}
      icon={Gavel}
      iconClassName="bg-indigo-500/10 text-indigo-500"
      size="3xl"
      footer={
        canScore ? (
          <>
            <HpButton variant="ghost" onClick={onClose} disabled={busy !== null}>
              Close
            </HpButton>
            <HpButton
              variant="primary"
              isLoading={busy === "score"}
              disabled={!complete}
              onClick={() =>
                run(
                  "score",
                  () =>
                    api.score(
                      h.id,
                      submission.id,
                      criteria.map((c) => ({ criterion: c.name, score: Number(marks[c.name]) })),
                      feedback.trim() || null
                    ),
                  (r) => {
                    onChanged(r.submission, r.unscored_count);
                    // A judge is working through a pile: after saving, get back to the list for the next one.
                    onClose();
                  }
                )
              }
            >
              {submission.final_score === null ? "Save score" : "Update score"}
            </HpButton>
          </>
        ) : (
          <HpButton variant="ghost" onClick={onClose}>
            Close
          </HpButton>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-4">
          {submission.tagline && <p className="text-sm font-semibold text-primary">{submission.tagline}</p>}
          <p className="max-h-56 overflow-y-auto whitespace-pre-line text-13 leading-relaxed text-text-secondary">{submission.description ?? "No description."}</p>

          <div className="flex flex-wrap gap-2">
            {submission.repo_url && <ProjectLink href={submission.repo_url} icon={Github} label="Repository" />}
            {submission.demo_url && <ProjectLink href={submission.demo_url} icon={Play} label="Live demo" />}
            {submission.video_url && <ProjectLink href={submission.video_url} icon={Video} label="Video" />}
          </div>

          {(submission.track || submission.tech_stack.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {submission.track && <HpPill tone="indigo" size="sm">{submission.track}</HpPill>}
              {submission.tech_stack.map((t) => (
                <HpPill key={t} tone="slate" size="sm">{t}</HpPill>
              ))}
            </div>
          )}

          {submission.is_disqualified && (
            <p className="flex items-start gap-2 rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
              <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Disqualified: {submission.disqualified_reason}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {submission.status === "draft" ? (
            <p className="rounded-xl bg-elevated px-4 py-3 text-13 text-text-secondary">This team saved a draft but never submitted, so it can&apos;t be scored.</p>
          ) : !judgingOpen ? (
            <p className="rounded-xl bg-elevated px-4 py-3 text-13 text-text-secondary">Scoring opens after the deadline.</p>
          ) : (
            <>
              <fieldset disabled={!canScore || busy !== null} className="space-y-4">
                {criteria.map((c) => (
                  <div key={c.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <label htmlFor={`m-${c.name}`} className="text-xs font-bold text-primary">
                        {c.name} <span className="font-medium text-text-muted">· {c.weight}%</span>
                      </label>
                      <span className="text-xs font-extrabold tabular-nums text-primary">{marks[c.name] === "" ? "–" : Number(marks[c.name]).toFixed(1)}/10</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        id={`m-${c.name}`}
                        type="range"
                        min={0}
                        max={10}
                        step={0.5}
                        value={marks[c.name] === "" ? 5 : marks[c.name]}
                        onChange={(e) => setMarks((m) => ({ ...m, [c.name]: e.target.value }))}
                        className="h-2 flex-1 cursor-pointer accent-indigo-600"
                        aria-label={`${c.name} mark out of 10`}
                      />
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={marks[c.name]}
                        onChange={(e) => setMarks((m) => ({ ...m, [c.name]: e.target.value }))}
                        className={cn(hpInput, "!w-20 !px-2.5 !py-1.5 text-center tabular-nums")}
                        aria-label={`${c.name} mark, 0 to 10`}
                      />
                    </div>
                    {c.description && <p className="mt-1 text-2xs text-text-muted">{c.description}</p>}
                  </div>
                ))}
              </fieldset>

              <div className="flex items-baseline justify-between rounded-xl bg-indigo-500/10 px-4 py-3">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Weighted score</span>
                <span className="text-2xl font-extrabold tabular-nums text-primary">
                  {preview ?? "–"}
                  <span className="text-xs font-semibold text-text-muted"> / 100</span>
                </span>
              </div>

              <div>
                <label htmlFor="feedback" className={hpLabel}>
                  Feedback for the team {resultsPublished ? "" : "(shown when results are published)"}
                </label>
                <textarea id="feedback" rows={4} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={!canScore || busy !== null} className={hpInput} placeholder="What stood out, and what to improve." />
              </div>
            </>
          )}

          {error && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

          {submission.status === "submitted" && (
            <div className="border-t border-border-subtle pt-4">
              {submission.is_disqualified ? (
                <HpButton
                  variant="secondary"
                  size="sm"
                  isLoading={busy === "reinstate"}
                  leftIcon={<Undo2 className="h-3.5 w-3.5" />}
                  onClick={() => run("reinstate", () => api.reinstate(h.id, submission.id), (r) => onChanged(r.submission, r.unscored_count))}
                >
                  Reinstate this project
                </HpButton>
              ) : dqOpen ? (
                <div className="space-y-2.5">
                  <label htmlFor="dq-reason" className={hpLabel}>
                    Reason for disqualifying (the team is told when results are published)
                  </label>
                  <textarea id="dq-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className={hpInput} />
                  <div className="flex gap-2">
                    <HpButton variant="danger" size="sm" disabled={reason.trim().length < 3} isLoading={busy === "dq"} onClick={() => run("dq", () => api.disqualify(h.id, submission.id, reason.trim()), (r) => onChanged(r.submission, r.unscored_count))}>
                      Disqualify
                    </HpButton>
                    <HpButton variant="ghost" size="sm" onClick={() => setDqOpen(false)}>
                      Cancel
                    </HpButton>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setDqOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-rose-600 dark:hover:text-rose-300">
                  <Ban className="h-3.5 w-3.5" /> Disqualify this project
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ProjectLink({ href, icon: Icon, label }: { href: string; icon: typeof Github; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={hpBtn("secondary", "sm")}>
      <Icon className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

/* ── Updates ──────────────────────────────────────────────────────────────── */

function Updates({ h, api, onChanged, notify }: { h: HostHackathonDetail; api: ReturnType<typeof hostApi>; onChanged: () => void; notify: (m: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPost = h.status === "published";

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.postAnnouncement(h.id, { title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      notify("Update posted — students see it on the hackathon page.");
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't post the update."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (announcementId: number) => {
    try {
      await api.deleteAnnouncement(h.id, announcementId);
      notify("Update removed.");
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't remove the update."));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <HpCard spotlight={false} className="h-fit p-5 sm:p-6">
        <h3 className="text-15 font-extrabold tracking-tight text-primary">Post an update</h3>
        <p className="mt-1 text-xs text-text-muted">Schedule changes, mentor office hours, reminders. Shown under the Updates tab.</p>

        {!canPost ? (
          <p className="mt-4 rounded-xl bg-elevated px-4 py-3 text-13 text-text-secondary">Publish the hackathon before posting updates.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              post();
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label htmlFor="u-title" className={hpLabel}>
                Headline
              </label>
              <input id="u-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={hpInput} placeholder="Mentor line-up announced" />
            </div>
            <div>
              <label htmlFor="u-body" className={hpLabel}>
                Message
              </label>
              <textarea id="u-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className={hpInput} />
            </div>
            {error && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
            <HpButton type="submit" variant="primary" isLoading={busy} disabled={title.trim().length < 3 || body.trim().length < 3} leftIcon={<Send className="h-4 w-4" />}>
              Post update
            </HpButton>
          </form>
        )}
      </HpCard>

      <div className="space-y-3">
        {h.announcements.length === 0 ? (
          <HpEmptyState icon={Megaphone} tone="violet" title="No updates yet" description="Keep students in the loop — they get a clear timeline of everything you post." />
        ) : (
          h.announcements.map((a) => (
            <HpCard key={a.id} spotlight={false} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-primary">{a.title}</h4>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    {whenLabel(a.created_at)}
                    {a.author ? ` · ${a.author}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => remove(a.id)} aria-label={`Remove “${a.title}”`} className="rounded-lg p-1.5 text-text-muted hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 whitespace-pre-line text-13 leading-relaxed text-text-secondary">{a.body}</p>
            </HpCard>
          ))
        )}
      </div>
    </div>
  );
}
