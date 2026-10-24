"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Fingerprint, Globe, Loader2, Monitor, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { IntegrityDetail, IntegrityEvidenceItem, IntegrityList, IntegritySummary, IntegrityTimelineEvent, RiskLevel } from "@/types/integrity";

const RISK: Record<RiskLevel, { label: string; chip: string; dot: string }> = {
  low: { label: "Low", chip: "bg-status-success/15 text-status-success", dot: "bg-status-success" },
  medium: { label: "Medium", chip: "bg-status-warning/15 text-status-warning", dot: "bg-status-warning" },
  high: { label: "High", chip: "bg-status-danger/15 text-status-danger", dot: "bg-status-danger" },
  critical: { label: "Critical", chip: "bg-status-danger text-white", dot: "bg-status-danger" },
};

const SEVERITY_DOT: Record<IntegrityTimelineEvent["severity"], string> = {
  info: "bg-slate-400",
  low: "bg-sky-400",
  medium: "bg-status-warning",
  high: "bg-status-danger",
  critical: "bg-status-danger ring-2 ring-status-danger/40",
};

const SOURCE: Record<IntegrityTimelineEvent["source"], string> = { web: "Page", guardian: "Guardian", server: "Server" };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—");

/** One line summarising an event's data for the timeline. Never a raw JSON dump. */
export function summariseData(d: Record<string, unknown>): string {
  const parts: string[] = [];
  const s = (k: string) => (d[k] !== undefined && d[k] !== null && d[k] !== "" ? String(d[k]) : null);

  if (s("name")) parts.push(String(s("name")));
  if (s("process")) parts.push(`${s("process")}${s("title") ? ` “${s("title")}”` : ""}`);
  if (s("what")) parts.push(String(s("what")));
  if (s("category")) parts.push(String(s("category")).replace(/_/g, " "));
  if (s("seconds")) parts.push(`${s("seconds")} s`);
  if (s("duration_ms")) parts.push(`${Math.round(Number(d.duration_ms) / 1000)} s away`);
  if (s("faces")) parts.push(`${s("faces")} faces`);
  if (s("score")) parts.push(`confidence ${s("score")}`);
  if (s("from") && s("to")) parts.push(`${s("from")} → ${s("to")}`);
  if (s("http") && Array.isArray(d.webrtc)) parts.push(`page ${s("http")} · WebRTC ${(d.webrtc as string[]).join(", ")}`);
  if (Array.isArray(d.signals)) parts.push((d.signals as string[]).join(", "));
  if (s("combo")) parts.push(String(s("combo")));
  if (d.merged_into_incident) parts.push("same incident as the strike above");

  return parts.join(" · ");
}

/**
 * Every proctored attempt in a reviewer's scope, riskiest first, with the full story behind each: the tamper-evident
 * activity log, the pictures the camera and screen produced, the network the attempt ran on, and whether the
 * Guardian was watching. Shared by the TPO, Section Coordinator and hiring-company screens — the SERVER decides what
 * each of them may see (`apiBase` differs, nothing else does).
 */
export function IntegrityReview({ apiBase }: { apiBase: string }) {
  const [list, setList] = useState<IntegrityList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [surface, setSurface] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (flaggedOnly) qs.set("only_flagged", "1");
      if (surface) qs.set("surface", surface);
      if (debounced) qs.set("search", debounced);
      setList(await api.get<IntegrityList>(`${apiBase}?${qs.toString()}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the integrity log.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, page, flaggedOnly, surface, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section aria-label="Exam integrity" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-primary" aria-hidden /> Exam integrity
          </h2>
          <p className="text-2xs text-text-muted mt-0.5">Every proctored attempt in your scope, riskiest first — with the log, the pictures and the network behind each.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, e-mail, roll no." aria-label="Search attempts" className="h-8 w-52 rounded-control border border-border-subtle bg-surface pl-8 pr-2 text-2xs text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40" />
          </div>
          <select value={surface} onChange={(e) => { setSurface(e.target.value); setPage(1); }} aria-label="Kind of attempt" className="h-8 rounded-control border border-border-subtle bg-surface px-2 text-2xs text-primary">
            <option value="">All kinds</option>
            <option value="contest">Contests</option>
            <option value="interview">AI interviews</option>
            <option value="soft_skill">Soft Skills tests</option>
            <option value="core_test">Core tests</option>
            <option value="study">Practice sittings</option>
          </select>
          <label className="flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(1); }} /> Flagged only
          </label>
        </div>
      </div>

      {error && <div role="alert" className="rounded-panel border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">{error}</div>}

      {loading && !list ? (
        <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-8 text-xs text-text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
        </div>
      ) : list && list.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
          <ShieldCheck className="h-6 w-6 text-status-success" aria-hidden />
          <span>{flaggedOnly ? "Nothing flagged — every proctored attempt in your scope looks clean." : "No proctored attempts yet."}</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {list?.data.map((s) => (
            <li key={s.uuid}>
              <Row s={s} onOpen={() => setOpen(s.uuid)} />
            </li>
          ))}
        </ul>
      )}

      {list && list.meta.last_page > 1 && (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>{list.meta.total} attempts</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-control border border-border-subtle px-3 py-1 font-semibold disabled:opacity-40">Previous</button>
            <span className="px-1 py-1">{page} / {list.meta.last_page}</span>
            <button type="button" disabled={page >= list.meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-control border border-border-subtle px-3 py-1 font-semibold disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {open && <DetailDrawer apiBase={apiBase} uuid={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function RiskChip({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wide", RISK[level].chip)}>
      {RISK[level].label}
      {score !== undefined && <span className="font-mono opacity-80">{score}</span>}
    </span>
  );
}

function Row({ s, onOpen }: { s: IntegritySummary; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-wrap items-center gap-3 rounded-panel border border-border-subtle bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", RISK[s.risk_level].dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-primary">{s.student?.name ?? "Unknown"}</span>
          {s.student?.roll_number && <span className="font-mono text-3xs text-text-muted">{s.student.roll_number}</span>}
          {s.locked && <span className="inline-flex items-center gap-1 rounded bg-status-danger/15 px-1.5 py-0.5 text-3xs font-bold uppercase text-status-danger"><Ban className="h-3 w-3" /> Ended</span>}
        </div>
        <p className="mt-0.5 truncate text-2xs text-text-muted">
          {s.surface_label}
          {s.title ? ` · ${s.title}` : ""} · {fmt(s.started_at)}
        </p>
      </div>
      <span className={cn("hidden items-center gap-1 text-3xs font-semibold sm:inline-flex", s.assurance === "guardian" ? "text-status-success" : "text-text-muted")} title={s.assurance === "guardian" ? "The Guardian watched this attempt" : "Browser only — no Guardian"}>
        {s.assurance === "guardian" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
        {s.assurance === "guardian" ? "Guardian" : "Web only"}
      </span>
      {s.strikes !== null && <span className="rounded-control border border-border-subtle bg-elevated/50 px-2 py-1 text-3xs font-bold text-text-secondary">{s.strikes}/{s.max_strikes} strikes</span>}
      <RiskChip level={s.risk_level} score={s.risk_score} />
    </button>
  );
}

function DetailDrawer({ apiBase, uuid, onClose }: { apiBase: string; uuid: string; onClose: () => void }) {
  const [detail, setDetail] = useState<IntegrityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"timeline" | "evidence" | "network">("timeline");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<IntegrityDetail>(`${apiBase}/${uuid}`).then((d) => !cancelled && setDetail(d)).catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Couldn't load this attempt."));
    return () => { cancelled = true; };
  }, [apiBase, uuid]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const s = detail?.session;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50" onClick={onClose} role="presentation">
      <aside role="dialog" aria-modal="true" aria-label="Attempt details" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border-strong bg-background shadow-card">
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-primary">{s?.student?.name ?? "Attempt"}</h3>
            <p className="truncate text-2xs text-text-muted">{s ? `${s.surface_label}${s.title ? ` · ${s.title}` : ""} · ${s.student?.email ?? ""}` : ""}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-control p-1.5 text-text-muted hover:bg-elevated hover:text-primary"><X className="h-4 w-4" /></button>
        </header>

        {error && <div role="alert" className="m-4 rounded-panel border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">{error}</div>}
        {!detail && !error && <div className="flex flex-1 items-center justify-center gap-2 text-xs text-text-muted" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}

        {detail && s && (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Risk" value={<RiskChip level={s.risk_level} score={s.risk_score} />} />
              <Stat label="Strikes" value={s.strikes === null ? "—" : `${s.strikes}/${s.max_strikes}`} />
              <Stat label="Watched by" value={detail.guardian.covered ? "Guardian + page" : "Page only"} />
              <Stat label="Events" value={String(detail.integrity.event_count)} />
            </div>

            <div className={cn("flex items-start gap-2 rounded-panel border p-3 text-2xs", detail.integrity.chain_ok ? "border-status-success/25 bg-status-success/10 text-status-success" : "border-status-danger/30 bg-status-danger/10 text-status-danger")}>
              {detail.integrity.chain_ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>
                {detail.integrity.chain_ok
                  ? "The activity log is intact: every entry is chained to the one before it, so none was edited or removed after the fact."
                  : `The activity log does NOT verify — entry #${detail.integrity.chain_break?.seq}: ${detail.integrity.chain_break?.reason}. Treat everything below with caution.`}
              </span>
            </div>

            {detail.flags.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Why it was flagged</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.flags.filter((f) => f.severity !== "info").map((f) => (
                    <span key={f.type} className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated/50 px-2 py-1 text-2xs text-text-secondary">
                      <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_DOT[f.severity])} aria-hidden /> {f.label}
                      {f.count > 1 && <span className="font-mono text-text-muted">×{f.count}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div role="tablist" className="flex gap-1 border-b border-border-subtle">
              {([["timeline", `Timeline (${detail.timeline.length})`], ["evidence", `Pictures (${detail.evidence.length})`], ["network", "Network & device"]] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={cn("-mb-px border-b-2 px-3 py-2 text-2xs font-bold", tab === id ? "border-accent-primary text-primary" : "border-transparent text-text-muted hover:text-primary")}>{label}</button>
              ))}
            </div>

            {tab === "timeline" && <Timeline events={detail.timeline} />}
            {tab === "evidence" && <Evidence apiBase={apiBase} uuid={uuid} items={detail.evidence} />}
            {tab === "network" && <Network detail={detail} />}
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border-subtle bg-surface px-3 py-2">
      <p className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <div className="mt-1 text-xs font-bold text-primary">{value}</div>
    </div>
  );
}

function Timeline({ events }: { events: IntegrityTimelineEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? events : events.filter((e) => e.severity !== "info" || e.strike > 0);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Include routine entries ({events.length - events.filter((e) => e.severity !== "info" || e.strike > 0).length} hidden)
      </label>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-2xs text-text-muted">Nothing notable was logged.</p>
      ) : (
        <ol className="relative space-y-1.5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border-strong">
          {shown.map((e) => (
            <li key={e.seq} className="relative flex items-start gap-3">
              <span className={cn("relative z-[1] mt-2 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-[rgb(var(--bg-surface-rgb))]", SEVERITY_DOT[e.severity])} aria-hidden />
              <div className="min-w-0 flex-1 rounded-control border border-border-subtle bg-elevated/30 px-3 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3">
                  <p className="text-xs font-semibold text-primary">{e.label}</p>
                  <div className="flex items-center gap-1.5">
                    {e.strike > 0 && <span className="rounded bg-status-danger/15 px-1.5 py-0.5 text-3xs font-bold uppercase text-status-danger">{e.strike >= 99 ? "Ended attempt" : "Strike"}</span>}
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-3xs font-semibold text-text-muted">{SOURCE[e.source]}</span>
                    <span className="font-mono text-3xs text-text-muted">{e.occurred_at ? new Date(e.occurred_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : ""}</span>
                  </div>
                </div>
                {summariseData(e.data) && <p className="mt-0.5 break-words text-2xs text-text-muted">{summariseData(e.data)}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Stills are fetched one by one through the authenticated API (an <img src> cannot carry the login) and shown from object URLs. */
function Evidence({ apiBase, uuid, items }: { apiBase: string; uuid: string; items: IntegrityEvidenceItem[] }) {
  const [urls, setUrls] = useState<Record<number, string | "gone">>({});
  const [big, setBig] = useState<IntegrityEvidenceItem | null>(null);
  const made = useRef<string[]>([]);
  const flaggedFirst = useMemo(() => [...items].sort((a, b) => Number(b.flagged) - Number(a.flagged) || (a.captured_at ?? "").localeCompare(b.captured_at ?? "")), [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of flaggedFirst) {
        if (cancelled) return;
        try {
          const blob = await api.getFile(`${apiBase}/${uuid}/evidence/${item.id}`);
          const url = URL.createObjectURL(blob);
          made.current.push(url);
          if (!cancelled) setUrls((u) => ({ ...u, [item.id]: url }));
        } catch {
          if (!cancelled) setUrls((u) => ({ ...u, [item.id]: "gone" }));
        }
      }
    })();
    return () => {
      cancelled = true;
      made.current.forEach((u) => URL.revokeObjectURL(u));
      made.current = [];
    };
  }, [apiBase, uuid, flaggedFirst]);

  if (items.length === 0) return <p className="py-6 text-center text-2xs text-text-muted">No pictures were sent for this attempt.</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {flaggedFirst.map((item) => {
          const url = urls[item.id];
          return (
            <button key={item.id} type="button" onClick={() => url && url !== "gone" && setBig(item)} className={cn("overflow-hidden rounded-control border bg-black text-left", item.flagged ? "border-status-danger/60" : "border-border-subtle")}>
              <div className="flex aspect-video items-center justify-center bg-elevated text-text-muted">
                {url && url !== "gone" ? <img src={url} alt={`${item.kind} picture`} className="h-full w-full object-cover" /> : url === "gone" ? <span className="text-3xs">No longer stored</span> : <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              </div>
              <div className="flex items-center justify-between gap-1 bg-surface px-2 py-1">
                <span className="flex items-center gap-1 text-3xs font-semibold text-text-secondary">{item.kind === "screen" ? <Monitor className="h-3 w-3" /> : <Fingerprint className="h-3 w-3" />}{item.kind === "screen" ? "Screen" : "Camera"}</span>
                <span className="font-mono text-3xs text-text-muted">{item.captured_at ? new Date(item.captured_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : ""}</span>
              </div>
              {item.flagged && <div className="bg-status-danger/15 px-2 py-0.5 text-3xs font-bold uppercase text-status-danger">{(item.reason ?? "flagged").replace(/_/g, " ")}</div>}
            </button>
          );
        })}
      </div>
      {big && urls[big.id] && urls[big.id] !== "gone" && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-6" onClick={() => setBig(null)} role="presentation">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[big.id]} alt={`${big.kind} picture, enlarged`} className="max-h-full max-w-full rounded-control" />
        </div>
      )}
    </>
  );
}

function Network({ detail }: { detail: IntegrityDetail }) {
  const n = detail.network;
  return (
    <div className="space-y-3 text-xs">
      <div>
        <h4 className="mb-1.5 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Addresses used</h4>
        <ul className="space-y-1">
          {n.addresses.map((a) => (
            <li key={a.ip} className="flex items-center justify-between rounded-control border border-border-subtle bg-surface px-3 py-1.5">
              <span className="font-mono text-primary">{a.ip}{a.ip === n.bound_ip && <span className="ml-2 text-3xs font-sans text-text-muted">at the start</span>}</span>
              <span className="text-3xs text-text-muted">{a.class.replace("_", " ")} · {a.beats} reports</span>
            </li>
          ))}
        </ul>
        {n.addresses.length > 1 && <p className="mt-1 flex items-center gap-1 text-2xs text-status-warning"><ShieldAlert className="h-3 w-3" /> The address changed during the attempt.</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Silence while the page was open" value={`${n.gap_seconds}s in ${n.gap_count} gap${n.gap_count === 1 ? "" : "s"}`} />
        <Stat label="Guardian silence" value={detail.guardian.covered ? `${detail.guardian.gap_seconds}s` : "not used"} />
      </div>
      {detail.guardian.covered && <p className="text-2xs text-text-muted">The Guardian reported from {fmt(detail.guardian.first_at)} to {fmt(detail.guardian.last_at)}.</p>}
    </div>
  );
}
