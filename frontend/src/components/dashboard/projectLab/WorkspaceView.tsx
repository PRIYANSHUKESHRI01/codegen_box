"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  FileText,
  ListChecks,
  Loader2,
  Lock,
  Maximize2,
  MessagesSquare,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  ShieldAlert,
  Square,
  Terminal,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MarkdownRenderer } from "@/components/dashboard/articles/MarkdownRenderer";
import { AuthorshipChip } from "@/components/dashboard/projectLab/AuthorshipChip";
import { MilestonePanel } from "@/components/dashboard/projectLab/MilestonePanel";
import { Splitter } from "@/components/dashboard/projectLab/Splitter";
import { SubmissionHistory } from "@/components/dashboard/projectLab/SubmissionHistory";
import { SubmitDialog } from "@/components/dashboard/projectLab/SubmitDialog";
import { useAuthorshipGuard } from "@/components/dashboard/projectLab/useAuthorshipGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { errorMessage, formatHours, isProjectLabRequired, stopReasonText } from "@/lib/projectLab";
import { extractCommandBlocks } from "@/lib/projectLabGuard";
import {
  DEFAULT_PREFS,
  PANEL_DEFAULT,
  PANEL_DEFAULT_SOW,
  PANEL_MAX,
  PANEL_MIN,
  PREVIEW_MAX,
  PREVIEW_MIN,
  loadPrefs,
  savePrefs,
  type WorkspacePrefs,
} from "@/lib/projectLabLayout";
import {
  type EnrollmentData,
  type EnrollmentMilestone,
  type EnrollmentResponse,
  type HeartbeatResponse,
  type ProjectLabSummary,
  type WorkspaceResponse,
  type WorkspaceState,
} from "@/types/projectLab";

const HEARTBEAT_MS = 60_000;
const POLL_MS = 2_000;
/** The page learns when VS Code's HTML has loaded, not when it has finished painting; this covers the gap. */
const IDE_PAINT_GRACE_MS = 3_500;
/** After this long without the editor loading, offer a reload. */
const IDE_SLOW_MS = 25_000;
/** A first click on Stop only arms it; the button disarms itself after this long. */
const STOP_CONFIRM_MS = 4_000;

type PanelTab = "milestones" | "sow" | "submissions";

/** Both iframes are sandboxed: they may run, store and open popups, but can never navigate OUR page away. */
const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox";

interface WorkspaceViewProps {
  enrollmentId: number;
}

/**
 * The build screen: a real VS Code in an iframe, with the SOW and milestones
 * beside it.
 *
 * The page is pinned to the window (DashboardShell `fitViewport`): the guide
 * panel scrolls on its own and the editor gets exactly the remaining height.
 * Never let the content decide the page height here — a long milestone list used
 * to stretch the editor to well beyond the window, which pushed its status bar and
 * terminal off-screen, and a mouse wheel over an iframe never reaches the page,
 * so the overflow could not be scrolled to.
 *
 * The page is also the workspace's life support. While it is open and the
 * workspace is live it heartbeats once a minute — the server counts that as
 * "someone is here" (idle detection) and as time used (the hours meter) — so
 * closing the tab is what eventually stops the container, and a sleeping laptop
 * can neither bill nor bank hours. Nothing here decides who may open a
 * workspace; every gate is the API's, and this screen only reports it.
 */
export function WorkspaceView({ enrollmentId }: WorkspaceViewProps) {
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [summary, setSummary] = useState<ProjectLabSummary | null>(null);
  const [ws, setWs] = useState<WorkspaceState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<PanelTab>("milestones");
  const [preview, setPreview] = useState(false);
  // Empty until the student picks a port: requesting one nothing listens on would just show an error page.
  const [previewPort, setPreviewPort] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  // "Continue anyway" on the update notice: lasts until the editor is reloaded or restarted.
  const [updateNoticeDismissed, setUpdateNoticeDismissed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingMilestones, setPendingMilestones] = useState<Set<number>>(new Set());
  const [submitOpen, setSubmitOpen] = useState(false);

  // Remembered layout choices (panel open/width, preview width, focus mode, dismissed tip).
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const patchPrefs = useCallback((patch: Partial<WorkspacePrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const { panelOpen, focus } = prefs;

  // The editor frame: remounted to reload it, and covered by a loading veil until it has painted.
  const [editorKey, setEditorKey] = useState(0);
  const [ideReady, setIdeReady] = useState(false);
  const [ideSlow, setIdeSlow] = useState(false);
  const ideRef = useRef<HTMLIFrameElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);

  const base = `/project-lab/enrollments/${enrollmentId}`;

  // ── remembered layout ─────────────────────────────────────────────────────
  useEffect(() => {
    const saved = loadPrefs();
    // The guide opens as a drawer below lg, so it starts closed there whatever was saved on a desktop.
    const small = window.matchMedia("(max-width: 1023px)").matches;
    setPrefs(small ? { ...saved, panelOpen: false } : saved);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (prefsLoaded) savePrefs(prefs);
  }, [prefs, prefsLoaded]);

  // Esc leaves focus mode — only when the key is pressed on OUR page; inside the editor Esc belongs to VS Code.
  useEffect(() => {
    if (!focus || submitOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") patchPrefs({ focus: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, submitOpen, patchPrefs]);

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await api.get<EnrollmentResponse>(base);
      setEnrollment(res.enrollment);
      setSummary(res.project_lab);
      setWs(res.enrollment.workspace);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? "This project wasn't found." : errorMessage(err, "We couldn't load this project."));
    }
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const live = ws !== null && (ws.status === "starting" || ws.status === "running");
  // The editor is only ever shown for a project that is in progress: once it is handed in (or reviewed,
  // or set aside) the workspace is stopped, and a stale live URL must not bring the editor back.
  const running = ws?.status === "running" && !!ws.ide_url && enrollment?.status === "active";
  const inProgress = enrollment?.status === "active";
  const entitled = summary?.enabled ?? false;
  const ideUrl = running ? ws?.ide_url ?? null : null;

  // The editor's paste guard: the SERVER says what it should do; the SOW's bash blocks are the commands that may be pasted.
  const guardMode = ws?.guard_mode ?? "enforce";
  const commandBlocks = useMemo(() => extractCommandBlocks(enrollment?.topic.sow_markdown), [enrollment?.topic.sow_markdown]);
  const guard = useAuthorshipGuard({ ideUrl, frameRef: ideRef, mode: guardMode, commands: commandBlocks, enrollmentId, resetKey: editorKey });

  // ── boot poll: while the editor is coming up ───────────────────────────────
  useEffect(() => {
    if (ws?.status !== "starting") return;
    let cancelled = false;

    const timer = setInterval(async () => {
      try {
        const res = await api.get<WorkspaceResponse>(`${base}/workspace`);
        if (cancelled) return;
        setWs(res.workspace);
        setSummary(res.project_lab);
      } catch {
        /* transient — the next tick retries */
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ws?.status, base]);

  // ── heartbeat: idle detection + the hours meter ────────────────────────────
  useEffect(() => {
    if (!live) return;
    let cancelled = false;

    const beat = async () => {
      try {
        const res = await api.post<HeartbeatResponse>(`${base}/workspace/heartbeat`);
        if (cancelled) return;
        if (res.hours) setSummary((s) => (s ? { ...s, hours: res.hours! } : s));
        if (res.status !== "running" && res.status !== "starting") {
          // The server stopped it (idle, hours used up, plan ended…). Fetch the full state for the reason.
          const full = await api.get<WorkspaceResponse>(`${base}/workspace`);
          if (!cancelled) {
            setWs(full.workspace);
            setSummary(full.project_lab);
          }
        }
      } catch (err) {
        if (!cancelled && isProjectLabRequired(err)) load();
      }
    };

    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [live, base, load]);

  // ── editor loading veil ────────────────────────────────────────────────────
  // Each new editor frame (first start, or "reload") begins covered; it is lifted once the frame has loaded
  // plus a short grace for VS Code to paint. If that never happens, a reload is offered.
  useEffect(() => {
    setIdeReady(false);
    setIdeSlow(false);
    if (!ideUrl) return;
    const slow = setTimeout(() => setIdeSlow(true), IDE_SLOW_MS);
    return () => clearTimeout(slow);
  }, [ideUrl, editorKey]);

  const paintTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(paintTimer.current), []);

  const handleIdeLoad = () => {
    guard.frameLoaded();
    clearTimeout(paintTimer.current);
    paintTimer.current = setTimeout(() => {
      setIdeReady(true);
      setIdeSlow(false);
      // So the student can type straight away instead of clicking into the editor first.
      ideRef.current?.focus();
    }, IDE_PAINT_GRACE_MS);
  };

  const reloadEditor = () => {
    setUpdateNoticeDismissed(false);
    setEditorKey((k) => k + 1);
  };

  // ── actions ───────────────────────────────────────────────────────────────
  const startWorkspace = async () => {
    setStarting(true);
    setActionError(null);
    try {
      const res = await api.post<WorkspaceResponse>(`${base}/workspace/start`);
      setWs(res.workspace);
      setSummary(res.project_lab);
    } catch (err) {
      if (isProjectLabRequired(err)) await load();
      setActionError(errorMessage(err, "We couldn't start your workspace. Please try again."));
    } finally {
      setStarting(false);
    }
  };

  const stopWorkspace = async () => {
    setConfirmStop(false);
    setStopping(true);
    setActionError(null);
    try {
      const res = await api.post<WorkspaceResponse>(`${base}/workspace/stop`);
      setWs(res.workspace);
      setSummary(res.project_lab);
      setPreview(false);
    } catch (err) {
      setActionError(errorMessage(err, "We couldn't stop your workspace. Please try again."));
    } finally {
      setStopping(false);
    }
  };

  // A container keeps the editor it was created with, so a workspace started before an editor update has to be stopped
  // and started again to get the new one. The student's files live on the volume and are kept; the page then follows
  // the usual starting → running flow.
  const restartWorkspace = async () => {
    setRestarting(true);
    setActionError(null);
    try {
      const stopped = await api.post<WorkspaceResponse>(`${base}/workspace/stop`);
      setWs(stopped.workspace);
      setSummary(stopped.project_lab);
      setPreview(false);
      setUpdateNoticeDismissed(false);

      const started = await api.post<WorkspaceResponse>(`${base}/workspace/start`);
      setWs(started.workspace);
      setSummary(started.project_lab);
    } catch (err) {
      if (isProjectLabRequired(err)) await load();
      setActionError(errorMessage(err, "We couldn't restart your workspace. Please try again."));
    } finally {
      setRestarting(false);
    }
  };

  // Stopping ends any dev server the student has running, so the first click only arms the button.
  useEffect(() => {
    if (!confirmStop) return;
    const t = setTimeout(() => setConfirmStop(false), STOP_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirmStop]);

  const toggleMilestone = async (m: EnrollmentMilestone) => {
    if (!enrollment || pendingMilestones.has(m.id)) return;

    // Optimistic: flip it now, restore on failure.
    const apply = (done: boolean) =>
      setEnrollment((prev) => {
        if (!prev) return prev;
        const milestones = prev.milestones.map((x) => (x.id === m.id ? { ...x, done } : x));
        return { ...prev, milestones, progress: { ...prev.progress, done: milestones.filter((x) => x.done).length } };
      });

    setPendingMilestones((p) => new Set(p).add(m.id));
    apply(!m.done);
    try {
      await api.post(`${base}/milestones/${m.id}/toggle`);
    } catch (err) {
      apply(m.done);
      setActionError(errorMessage(err, "We couldn't save that tick. Please try again."));
    } finally {
      setPendingMilestones((p) => {
        const next = new Set(p);
        next.delete(m.id);
        return next;
      });
    }
  };

  const handleSubmitted = (next: EnrollmentData) => {
    setEnrollment(next);
    setWs(next.workspace);
    setSubmitOpen(false);
    setTab("submissions");
    patchPrefs({ panelOpen: true });
    api.get<EnrollmentResponse>(base).then((res) => setSummary(res.project_lab)).catch(() => {});
  };

  const previewUrl = useMemo(() => {
    if (!ws?.preview_url_template) return null;
    const port = Number(previewPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === ws.ide_port) return null;
    return ws.preview_url_template.replace("{port}", String(port));
  }, [ws, previewPort]);

  // The sandboxed iframe can't be told to reload from outside; changing its key remounts it.
  const reloadPreview = () => setPreviewKey((k) => k + 1);

  const hoursLow = summary?.hours.remaining !== null && summary?.hours.remaining !== undefined && summary.hours.remaining <= 0.5 && running;
  const showTip = !!ideUrl && inProgress && !prefs.tipDismissed && (enrollment?.progress.done ?? 0) === 0;

  // ── render ────────────────────────────────────────────────────────────────
  const title = enrollment?.topic.title ?? "Workspace";
  const panelWidth = prefs.panelWidth ?? (tab === "sow" ? PANEL_DEFAULT_SOW : PANEL_DEFAULT);

  return (
    <DashboardShell role="user" title={title} fullBleed fitViewport hideChrome={focus} defaultSidebarCollapsed>
      {/* ── Top bar ── */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-3 sm:px-4">
        <Link
          href={enrollment ? `/dashboard/projects/view?slug=${encodeURIComponent(enrollment.topic.slug)}` : "/dashboard/projects"}
          className="flex items-center gap-1.5 rounded-control px-2 py-1.5 text-xs font-bold text-text-secondary transition-colors hover:bg-elevated hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Project</span>
        </Link>

        <button
          type="button"
          onClick={() => patchPrefs({ panelOpen: !panelOpen })}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? "Hide SOW and milestones" : "Show SOW and milestones"}
          title={panelOpen ? "Hide the guide" : "Show the guide (SOW, milestones, results)"}
          className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-primary"
        >
          {panelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>

        <h1 className="min-w-0 flex-1 truncate text-sm font-extrabold text-primary">{title}</h1>

        <StatusPill ws={ws} />

        {running && <AuthorshipChip
            status={guard.status}
            mode={guardMode}
            counters={guard.counters}
            onReloadEditor={reloadEditor}
            onRestartWorkspace={restartWorkspace}
            restarting={restarting}
          />}

        {enrollment && enrollment.progress.total > 0 && (
          <button
            type="button"
            onClick={() => {
              setTab("milestones");
              patchPrefs({ panelOpen: true });
            }}
            title="Milestones completed — open the checklist"
            className="hidden items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-bold tabular-nums text-text-secondary transition-colors hover:text-primary lg:inline-flex"
          >
            <ListChecks className="h-3.5 w-3.5" />
            {enrollment.progress.done}/{enrollment.progress.total}
          </button>
        )}

        {summary && summary.hours.limit !== null && (
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-control border px-2.5 py-1 text-2xs font-bold tabular-nums md:inline-flex",
              hoursLow ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-border-subtle bg-elevated text-text-secondary"
            )}
            title="Workspace hours left this period"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatHours(summary.hours.remaining ?? 0)} left
          </span>
        )}

        {running && (
          <>
            <button
              type="button"
              onClick={reloadEditor}
              aria-label="Reload the editor"
              title="Reload the editor (your files and running programs are not affected)"
              className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-primary"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              aria-pressed={preview}
              title="See your running app next to the editor"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-bold transition-colors",
                preview ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </>
        )}

        {inProgress && entitled && (
          <button
            type="button"
            onClick={() => setSubmitOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Submit</span>
          </button>
        )}

        {live && (
          <button
            type="button"
            onClick={() => (confirmStop ? stopWorkspace() : setConfirmStop(true))}
            disabled={stopping}
            title={confirmStop ? "Click again to stop — running programs end, your files are kept" : "Stop the workspace (your files are kept)"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-60",
              confirmStop
                ? "border-status-danger bg-status-danger/10 text-status-danger hover:bg-status-danger/15"
                : "border-border-strong bg-elevated text-primary hover:bg-surface-hover"
            )}
          >
            {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            <span className={cn(!confirmStop && "hidden sm:inline")}>{confirmStop ? "Confirm stop" : "Stop"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => patchPrefs({ focus: !focus })}
          aria-pressed={focus}
          aria-label={focus ? "Leave focus mode" : "Focus mode: hide the dashboard"}
          title={focus ? "Leave focus mode (Esc)" : "Focus mode: hide the dashboard"}
          className="rounded-control p-1.5 text-text-secondary transition-colors hover:bg-elevated hover:text-primary"
        >
          {focus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {(actionError || hoursLow) && (
        <div role="alert" className="flex shrink-0 items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{actionError ?? "Less than 30 minutes of workspace time left in this period. Your files stay safe when it runs out."}</span>
          {actionError && (
            <button type="button" onClick={() => setActionError(null)} className="font-bold underline">
              Dismiss
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div role="alert" className="max-w-sm rounded-panel border border-status-danger/30 bg-status-danger/10 p-6 text-center text-sm text-status-danger">
            {loadError}
          </div>
        </div>
      )}

      {!loadError && !enrollment && (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-text-secondary" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your project…
        </div>
      )}

      {enrollment && (
        <div className="relative flex min-h-0 flex-1">
          {/* ── Guide panel: a drawer below lg, a resizable column from lg up ── */}
          {panelOpen && (
            <>
              <button
                type="button"
                aria-label="Close the guide"
                onClick={() => patchPrefs({ panelOpen: false })}
                className="fixed inset-0 z-30 cursor-default bg-black/40 lg:hidden"
              />
              <aside
                ref={asideRef}
                aria-label="Project guide"
                style={{ "--panel-w": `${panelWidth}px` } as CSSProperties}
                className={cn(
                  "fixed inset-y-0 left-0 z-40 flex w-[min(92vw,380px)] flex-col border-r border-border-subtle bg-background shadow-2xl",
                  "lg:static lg:z-auto lg:w-[var(--panel-w)] lg:min-w-[280px] lg:max-w-[60%] lg:shrink-0 lg:border-r-0 lg:shadow-none"
                )}
              >
                <div role="tablist" aria-label="Project guide sections" className="flex shrink-0 items-center border-b border-border-subtle bg-surface">
                  {(
                    [
                      ["milestones", "Milestones", ListChecks],
                      ["sow", "SOW", FileText],
                      ["submissions", "Results", MessagesSquare],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => setTab(key)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-bold transition-colors",
                        tab === key ? "border-accent-primary text-accent-primary" : "border-transparent text-text-secondary hover:text-primary"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {key === "milestones" && enrollment.progress.total > 0 && (
                        <span className="rounded-full bg-elevated px-1.5 text-3xs tabular-nums">
                          {enrollment.progress.done}/{enrollment.progress.total}
                        </span>
                      )}
                      {key === "submissions" && enrollment.submissions.length > 0 && (
                        <span className="rounded-full bg-elevated px-1.5 text-3xs tabular-nums">{enrollment.submissions.length}</span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => patchPrefs({ panelOpen: false })}
                    aria-label="Close the guide"
                    className="mx-1 rounded-control p-1.5 text-text-secondary hover:bg-elevated hover:text-primary lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {enrollment.sow_outdated && tab !== "submissions" && (
                    <p className="m-4 mb-0 flex items-start gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      The SOW was updated after you started (v{enrollment.sow_version} → v{enrollment.topic.sow_version}). You&apos;re shown the latest version.
                    </p>
                  )}
                  {tab === "milestones" && (
                    <MilestonePanel milestones={enrollment.milestones} editable={inProgress && entitled} onToggle={toggleMilestone} pending={pendingMilestones} />
                  )}
                  {tab === "sow" &&
                    (enrollment.topic.sow_markdown ? (
                      <div className="p-5">
                        <MarkdownRenderer content={enrollment.topic.sow_markdown} className="text-[14px]" />
                      </div>
                    ) : (
                      <p className="p-6 text-xs text-text-secondary">The SOW is available while Project Lab is active.</p>
                    ))}
                  {tab === "submissions" && <SubmissionHistory submissions={enrollment.submissions} />}
                </div>
              </aside>

              <Splitter
                label="Resize the guide panel"
                className="hidden lg:block"
                direction={1}
                min={PANEL_MIN}
                max={PANEL_MAX}
                getSize={() => asideRef.current?.getBoundingClientRect().width ?? panelWidth}
                onResize={(px) => patchPrefs({ panelWidth: px })}
                onReset={() => patchPrefs({ panelWidth: null })}
              />
            </>
          )}

          {/* ── Editor (and, optionally, the live preview beside it) ── */}
          <section aria-label="Workspace" className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            {ideUrl ? (
              <>
                {showTip && <QuickStartTip guardOn={guardMode !== "open" && guard.status !== "outdated"} onDismiss={() => patchPrefs({ tipDismissed: true })} />}

                <div className={cn("flex min-h-0 flex-1", preview ? "flex-col lg:flex-row" : "flex-col")}>
                  {/* The frame is absolutely positioned inside a box whose height comes from the layout, so the
                      editor can never be sized by its own content. */}
                  <div className="relative min-h-0 min-w-0 flex-1 bg-[#1e1e1e] lg:min-w-[360px]">
                    <iframe
                      key={editorKey}
                      ref={ideRef}
                      title="VS Code workspace"
                      src={ideUrl}
                      sandbox={IFRAME_SANDBOX}
                      allow="clipboard-read; clipboard-write; fullscreen"
                      onLoad={handleIdeLoad}
                      className="absolute inset-0 h-full w-full border-0"
                    />
                    <EditorLoadingVeil visible={!ideReady} slow={ideSlow} onReload={reloadEditor} />
                    {guard.status === "outdated" && !updateNoticeDismissed && (
                      <EditorUpdateNotice restarting={restarting} onRestart={restartWorkspace} onContinue={() => setUpdateNoticeDismissed(true)} />
                    )}
                  </div>

                  {preview && (
                    <>
                      <Splitter
                        label="Resize the preview"
                        className="hidden lg:block"
                        direction={-1}
                        min={PREVIEW_MIN}
                        max={PREVIEW_MAX}
                        getSize={() => previewPaneRef.current?.getBoundingClientRect().width ?? PREVIEW_MIN}
                        onResize={(px) => patchPrefs({ previewWidth: px })}
                        onReset={() => patchPrefs({ previewWidth: null })}
                      />
                      <div
                        ref={previewPaneRef}
                        style={{ "--preview-w": prefs.previewWidth ? `${prefs.previewWidth}px` : "42%" } as CSSProperties}
                        className="flex h-[45%] min-h-0 shrink-0 flex-col border-t border-border-subtle bg-surface lg:h-auto lg:w-[var(--preview-w)] lg:min-w-[320px] lg:max-w-[70%] lg:border-t-0"
                      >
                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-text-secondary">
                            Port
                            <input
                              value={previewPort}
                              onChange={(e) => setPreviewPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
                              inputMode="numeric"
                              aria-label="Port your app is listening on"
                              className="w-20 rounded-control border border-border-subtle bg-elevated px-2 py-1 font-mono text-xs text-primary outline-none focus:border-accent-primary"
                            />
                          </label>
                          <button type="button" onClick={reloadPreview} aria-label="Reload preview" title="Reload the preview" className="rounded-control p-1.5 text-text-secondary hover:bg-elevated hover:text-primary">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex items-center gap-1" role="group" aria-label="Common ports">
                            {["3000", "5173", "8000", "8080"].map((port) => (
                              <button
                                key={port}
                                type="button"
                                onClick={() => setPreviewPort(port)}
                                aria-pressed={previewPort === port}
                                className={cn(
                                  "rounded-control border px-2 py-1 font-mono text-2xs font-bold transition-colors",
                                  previewPort === port ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle text-text-secondary hover:text-primary"
                                )}
                              >
                                {port}
                              </button>
                            ))}
                          </div>
                          <div className="ml-auto flex items-center gap-1">
                            {previewUrl && (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open the preview in a new tab"
                                title="Open the preview in a new tab"
                                className="rounded-control p-1.5 text-text-secondary hover:bg-elevated hover:text-primary"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreview(false)}
                              aria-label="Close the preview"
                              title="Close the preview"
                              className="rounded-control p-1.5 text-text-secondary hover:bg-elevated hover:text-primary"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {previewUrl ? (
                          <iframe key={`${previewUrl}-${previewKey}`} title="App preview" src={previewUrl} sandbox={IFRAME_SANDBOX} className="min-h-0 flex-1 border-0 bg-white" />
                        ) : (
                          <p className="p-5 text-xs leading-relaxed text-text-secondary">
                            Start your app in the VS Code terminal, bound to <code className="font-mono">0.0.0.0</code> — for example{" "}
                            <code className="font-mono">npm run dev -- --host</code> or <code className="font-mono">php artisan serve --host=0.0.0.0</code> — then pick
                            the port it prints above (or type any port from 1024 to 65535).
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <WorkspaceStateScreen
                enrollment={enrollment}
                ws={ws}
                summary={summary}
                entitled={entitled}
                starting={starting}
                onStart={startWorkspace}
              />
            )}
          </section>
        </div>
      )}

      {submitOpen && enrollment && (
        <SubmitDialog
          enrollment={enrollment}
          workspaceRunning={running}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={handleSubmitted}
          beforeSubmit={guard.flush}
          authorshipChecked={guardMode !== "open"}
        />
      )}
    </DashboardShell>
  );
}

// ───────────────────────────── pieces ─────────────────────────────

function StatusPill({ ws }: { ws: WorkspaceState | null }) {
  const status = ws?.status ?? "stopped";
  const meta: Record<string, { label: string; dot: string }> = {
    running: { label: "Running", dot: "bg-emerald-500" },
    starting: { label: "Starting", dot: "bg-amber-500 animate-pulse" },
    failed: { label: "Problem", dot: "bg-rose-500" },
    stopped: { label: "Stopped", dot: "bg-text-muted" },
    destroyed: { label: "Removed", dot: "bg-text-muted" },
  };
  const m = meta[status] ?? meta.stopped;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-bold text-text-secondary" role="status">
      <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

/** Covers the editor frame while VS Code loads (it takes several seconds to paint), so the student never stares at a blank box. */
function EditorLoadingVeil({ visible, slow, onReload }: { visible: boolean; slow: boolean; onReload: () => void }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center transition-opacity duration-500",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-accent-primary" />
      <p className="text-sm font-extrabold text-primary">Loading VS Code…</p>
      <p className="max-w-xs text-xs leading-relaxed text-text-secondary">The first start of a workspace can take up to 30 seconds. Your files are safe.</p>
      {slow && (
        <button
          type="button"
          onClick={onReload}
          className="mt-1 inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Taking long? Reload the editor
        </button>
      )}
    </div>
  );
}

/**
 * Over the editor when it loaded without the paste protection: nearly always a workspace started before the protection
 * was added to the editor image. One click brings it up again on the current editor. "Continue" stays available because
 * the same symptom can come from a browser extension blocking the script, and a student must never be locked out of
 * their own work: the reviewer is told when the protection was not running, which is the real consequence.
 */
function EditorUpdateNotice({ restarting, onRestart, onContinue }: { restarting: boolean; onRestart: () => void; onContinue: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="editor-update-title" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center backdrop-blur-sm">
      <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden />
      <h2 id="editor-update-title" className="text-base font-extrabold text-primary">
        Your workspace needs an update
      </h2>
      <p className="max-w-md text-xs leading-relaxed text-text-secondary">
        It was started with an older editor that can’t stop pasting from outside, which this project requires. Restart it to get the current one: your files are kept and it
        takes about half a minute.
      </p>
      <button
        type="button"
        disabled={restarting}
        onClick={onRestart}
        className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
      >
        {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        {restarting ? "Restarting…" : "Restart workspace"}
      </button>
      <button type="button" onClick={onContinue} className="text-2xs font-semibold text-text-secondary underline underline-offset-2 hover:text-primary">
        Continue without the protection
      </button>
      <p className="max-w-xs text-2xs leading-relaxed text-text-muted">If you continue, your reviewer will see that the protection wasn’t running.</p>
    </div>
  );
}

/** One line of orientation above a brand-new, empty editor. Dismissed for good, and gone once a milestone is ticked. */
function QuickStartTip({ onDismiss, guardOn }: { onDismiss: () => void; guardOn: boolean }) {
  const kbd = "rounded border border-border-subtle bg-elevated px-1 font-mono text-2xs text-primary";

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle bg-accent-primary/5 px-4 py-1.5 text-xs text-text-secondary">
      <Terminal className="h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">
        <strong className="text-primary">Quick start:</strong> open the terminal with <kbd className={kbd}>Ctrl</kbd>+<kbd className={kbd}>`</kbd> and follow the setup steps in the{" "}
        <strong className="text-primary">SOW</strong> tab. <strong className="text-primary">Preview</strong> shows your running app beside the editor.
        {guardOn && " You write the code yourself: pasting from outside your workspace is turned off, but copy-and-paste inside it works."}
      </p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss this tip" className="rounded-control p-1 text-text-secondary hover:bg-elevated hover:text-primary">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface StateScreenProps {
  enrollment: EnrollmentData;
  ws: WorkspaceState | null;
  summary: ProjectLabSummary | null;
  entitled: boolean;
  starting: boolean;
  onStart: () => void;
}

/** Everything the centre of the screen can be when it isn't a running editor. */
function WorkspaceStateScreen({ enrollment, ws, summary, entitled, starting, onStart }: StateScreenProps) {
  const boot = useBootMessages(ws?.status === "starting" || starting);

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-background p-6">
      <div className="w-full max-w-md rounded-panel border border-border-subtle bg-surface p-7 text-center shadow-card">{children}</div>
    </div>
  );

  if (!entitled) {
    return shell(
      <>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-text-secondary">
          <Lock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-base font-extrabold text-primary">Your Project Lab access has ended</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
          Your files are safe and will be here when you renew. Your submissions and feedback stay visible in the Results tab.
        </p>
        <Link href="/dashboard/projects" className="mt-5 inline-flex rounded-btn bg-accent-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-primary-hover">
          Renew Project Lab
        </Link>
      </>
    );
  }

  if (enrollment.status === "submitted") {
    return shell(
      <>
        <h2 className="text-base font-extrabold text-primary">Submitted — waiting for review</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
          A reviewer will check your project against each milestone&apos;s acceptance criteria. You&apos;ll see the score and feedback in the Results tab.
        </p>
      </>
    );
  }

  if (enrollment.status === "reviewed") {
    const last = enrollment.submissions[0];
    return shell(
      <>
        <h2 className="text-base font-extrabold text-primary">Project reviewed</h2>
        {last?.score !== null && last?.score !== undefined && (
          <p className="mt-3 font-mono text-4xl font-black text-primary">
            {last.score}
            <span className="text-base font-semibold text-text-secondary"> / 100</span>
          </p>
        )}
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">Open the Results tab for the full feedback.</p>
      </>
    );
  }

  if (enrollment.status === "abandoned") {
    return shell(
      <>
        <h2 className="text-base font-extrabold text-primary">You set this project aside</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">Resume it from the project page to keep building where you left off.</p>
      </>
    );
  }

  if (starting || ws?.status === "starting") {
    return shell(
      <>
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent-primary" />
        <h2 className="mt-4 text-base font-extrabold text-primary">Starting your workspace</h2>
        <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-text-secondary" aria-live="polite">
          {boot}
        </p>
      </>
    );
  }

  const outOfHours = summary?.hours.remaining !== null && summary?.hours.remaining !== undefined && summary.hours.remaining <= 0;
  const reason = ws?.status === "stopped" || ws?.status === "failed" ? stopReasonText(ws.stop_reason) : null;

  return shell(
    <>
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary">
        <Play className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-primary">
        {ws?.stop_reason || ws?.status === "failed" ? "Your workspace is stopped" : "Open your workspace"}
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
        {reason ??
          (ws?.error ||
            "A full VS Code with a terminal, git, Node, PHP/Laravel, Python and Java. It takes about ten seconds, and your files are always kept.")}
      </p>

      {outOfHours ? (
        <p className="mt-4 rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-900 dark:text-amber-200">
          You&apos;ve used all your workspace hours for this period. They reset when you renew Project Lab.
        </p>
      ) : (
        <button
          type="button"
          onClick={onStart}
          className="mt-5 inline-flex items-center gap-2 rounded-btn bg-accent-primary px-6 py-2.5 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
        >
          <Play className="h-4 w-4" />
          {ws?.status === "failed" || ws?.stop_reason ? "Start workspace again" : "Open workspace"}
        </button>
      )}

      {summary && summary.hours.limit !== null && summary.hours.remaining !== null && !outOfHours && (
        <p className="mt-3 text-2xs font-semibold text-text-secondary">
          {formatHours(summary.hours.remaining)} of {summary.hours.limit} h left this period · time only counts while the page is open
        </p>
      )}
    </>
  );
}

/** Rotating reassurance while the container boots, so ten quiet seconds don't read as a hang. */
function useBootMessages(active: boolean): string {
  const messages = [
    "Creating your private workspace…",
    "Mounting your files…",
    "Starting VS Code…",
    "Almost there…",
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!active) {
      setI(0);
      return;
    }
    const t = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return messages[i];
}
