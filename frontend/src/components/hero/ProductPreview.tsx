"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  Eye,
  GraduationCap,
  Mic,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type View = "candidate" | "employer" | "college";

const VIEWS: { id: View; label: string; icon: typeof Users2 }[] = [
  { id: "college", label: "Placement Cell", icon: Building2 },
  { id: "candidate", label: "Student", icon: GraduationCap },
  { id: "employer", label: "Recruiter", icon: Briefcase },
];

const ROTATE_MS = 6000;

/**
 * An honest, illustrative preview of the three real dashboards — the
 * candidate's job/drive view, the employer's hiring pipeline, and the TPO's
 * campus view. Every name and number below is static sample data (no API
 * calls), and the footer of the frame says so out loud. Auto-rotates until
 * the visitor picks a tab themselves, then stays put.
 */
export function ProductPreview() {
  const [view, setView] = useState<View>("college");
  const [userPicked, setUserPicked] = useState(false);

  useEffect(() => {
    if (userPicked) return;
    const id = setInterval(() => {
      setView((v) => (v === "college" ? "candidate" : v === "candidate" ? "employer" : "college"));
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [userPicked]);

  const pick = (v: View) => {
    setUserPicked(true);
    setView(v);
  };

  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [2.5, -2.5]), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-3, 3]), { stiffness: 120, damping: 18 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      className="relative w-full max-w-5xl mx-auto [perspective:1400px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Coloured glow under the frame so it floats off the page */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -bottom-6 top-10 -z-10 rounded-[40px] bg-gradient-to-r from-accent-primary/30 via-violet-400/25 to-accent-secondary/30 blur-3xl opacity-60 dark:opacity-40"
      />
    <motion.div
      id="platform-preview"
      style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="relative w-full rounded-card lg:rounded-panel bg-surface border border-border-strong shadow-[0_30px_80px_-20px_rgba(39,47,92,0.35)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-75" />

      {/* Window title bar + role switcher */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface/90 backdrop-blur-sm border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-block w-3 h-3 rounded-full bg-rose-500/80" />
          <span className="hidden sm:inline-block w-3 h-3 rounded-full bg-amber-500/80" />
          <span className="hidden sm:inline-block w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2.5 text-xs font-mono text-text-muted hidden md:inline truncate">
            <span className="text-primary font-bold">AptRun</span> · one sandbox, three views
          </span>
        </div>

        <div role="tablist" aria-label="Preview as" className="flex items-center gap-1 mx-auto sm:mx-0 p-0.5 rounded-control bg-elevated border border-border-subtle">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => pick(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-2xs font-bold whitespace-nowrap transition-colors",
                  view === v.id ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary"
                )}
              >
                <Icon className="w-3 h-3 hidden xs:block" />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-rotate progress — disappears once the visitor picks a tab */}
      <div className="h-0.5 bg-transparent overflow-hidden">
        {!userPicked && (
          <div
            key={view}
            className="h-full origin-left bg-gradient-to-r from-accent-primary to-accent-secondary"
            style={{ animation: `lp-progress ${ROTATE_MS}ms linear forwards` }}
          />
        )}
      </div>

      {/* Content */}
      <div className="relative min-h-[430px] sm:min-h-[470px] p-4 sm:p-8 bg-background/40 text-left">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {view === "college" && <CollegeView />}
            {view === "candidate" && <CandidateView />}
            {view === "employer" && <EmployerView />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-4 py-2 border-t border-border-subtle bg-surface/90 text-center text-2xs font-medium text-text-secondary">
        Illustrative preview &middot; sample names and numbers
      </div>
    </motion.div>
    </div>
  );
}

/* ----------------------------- Candidate ----------------------------- */

function CandidateView() {
  const matches = [
    { company: "Nova Systems", role: "Systems Engineer", ctc: "₹3.6–6.25 LPA", status: "Eligible", tone: "success" },
    { company: "Quantica Labs", role: "Software Engineer", ctc: "₹7 LPA", status: "Interview invite", tone: "primary" },
    { company: "Orbit Technologies", role: "Project Engineer", ctc: "₹4.5 LPA", status: "Applied", tone: "muted" },
  ] as const;

  return (
    <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
      {/* Readiness */}
      <div className="lg:col-span-2 p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <BadgeCheck className="w-4 h-4 text-accent-primary" />
          Your learning centre
        </div>
        <div className="flex items-center gap-4 mb-5">
          <ProgressRing value={82} />
          <div>
            <div className="text-sm font-bold text-primary">Placement readiness</div>
            <div className="text-xs text-text-secondary">Top 15% of your cohort</div>
          </div>
        </div>
        <div className="space-y-2.5 mb-5">
          {[
            ["Coding assessment", 91],
            ["AI interview", 78],
            ["Soft skills", 84],
          ].map(([label, score]) => (
            <div key={label as string}>
              <div className="flex justify-between text-2xs font-semibold text-text-secondary mb-1">
                <span>{label}</span>
                <span className="font-mono text-primary">{score}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
                <GrowBar pct={Number(score)} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-status-success/10 border border-status-success/25 text-2xs font-bold text-status-success">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Visible to recruiters
          </span>
          <span className="text-text-secondary font-semibold">You control this</span>
        </div>
      </div>

      {/* Matches */}
      <div className="lg:col-span-3 rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Drives you're eligible for</span>
          <span className="text-2xs font-mono font-semibold text-text-secondary">3 new</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {matches.map((m) => (
            <div key={m.company} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary truncate">{m.company}</div>
                  <div className="text-2xs text-text-secondary truncate">
                    {m.role} &bull; {m.ctc}
                  </div>
                </div>
              </div>
              <StatusPill tone={m.tone}>{m.status}</StatusPill>
            </div>
          ))}
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="mt-auto m-4 py-2.5 rounded-btn bg-accent-primary/10 border border-accent-primary/25 text-accent-primary text-xs font-bold flex items-center justify-center gap-1.5"
        >
          Prepare for Quantica Labs interview
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- Employer ------------------------------ */

function EmployerView() {
  const funnel = [
    { label: "Invited", value: 120 },
    { label: "Assessed", value: 84 },
    { label: "Shortlisted", value: 22 },
    { label: "Interviewed", value: 9 },
    { label: "Hired", value: 3 },
  ];
  const max = funnel[0].value;
  const candidates = [
    { name: "Aarav S.", college: "Apex Institute", score: 94, tag: "Shortlisted" },
    { name: "Meera K.", college: "Northfield College", score: 91, tag: "Interview booked" },
    { name: "Rohan D.", college: "Apex Institute", score: 88, tag: "Assessed" },
  ];

  return (
    <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
      {/* Funnel */}
      <div className="lg:col-span-2 p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
            <Briefcase className="w-4 h-4 text-accent-secondary" />
            Software Engineer
          </div>
          <span className="px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 text-3xs font-bold">
            Open
          </span>
        </div>
        <div className="space-y-2.5">
          {funnel.map((f, i) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-[82px] shrink-0 text-2xs font-semibold text-text-secondary">{f.label}</span>
              <div className="flex-1 h-6 rounded-md bg-elevated overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max((f.value / max) * 100, 12)}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.1, ease: "easeOut" }}
                  className="h-full rounded-md flex items-center justify-end pr-2 text-2xs font-bold font-mono text-white bg-gradient-to-r from-accent-primary to-accent-secondary"
                  style={{ opacity: 1 - i * 0.12 }}
                >
                  {f.value}
                </motion.div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
          Every assessment score is proctored
        </div>
      </div>

      {/* Ranked candidates */}
      <div className="lg:col-span-3 rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Candidates from partner campuses</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {candidates.map((c) => (
            <div key={c.name} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accent-secondary/10 border border-accent-secondary/25 flex items-center justify-center text-accent-secondary text-xs font-bold shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary truncate">{c.name}</div>
                  <div className="text-2xs text-text-secondary truncate">{c.college}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="hidden sm:inline text-sm font-bold font-mono text-primary">{c.score}%</span>
                <StatusPill tone={c.tag === "Assessed" ? "muted" : "primary"}>{c.tag}</StatusPill>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto m-4 grid grid-cols-2 gap-2.5">
          <button type="button" tabIndex={-1} className="py-2.5 rounded-btn bg-accent-primary text-white text-xs font-bold inline-flex items-center justify-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Invite to AI interview
          </button>
          <button type="button" tabIndex={-1} className="py-2.5 rounded-btn bg-surface border border-border-strong text-primary text-xs font-bold">
            Propose to campuses
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ College ------------------------------ */

function CollegeView() {
  const branches = [
    { label: "CSE", value: 86 },
    { label: "IT", value: 79 },
    { label: "ECE", value: 68 },
    { label: "Mech", value: 54 },
  ];
  const drives = [
    { company: "Nova Systems", meta: "Systems Engineer · Sept 16", state: "Mapped" },
    { company: "Quantica Labs", meta: "Software Engineer · 7 LPA", state: "Map to College" },
    { company: "Orbit Technologies", meta: "Project Engineer · 4.5 LPA", state: "Map to College" },
  ];

  const kpis = [
    { label: "Students onboarded", value: "480" },
    { label: "Live drives", value: "12" },
    { label: "Mock tests run", value: "36" },
    { label: "Offers recorded", value: "58" },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className="px-4 py-3 rounded-card bg-surface border border-border-subtle shadow-subtle">
          <div className="text-xl font-black font-mono text-primary">{k.value}</div>
          <div className="text-2xs font-semibold text-text-secondary">{k.label}</div>
        </div>
      ))}
    </div>
    <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
      <div className="lg:col-span-3 rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Placement cell &bull; Apex Institute</span>
          <span className="text-2xs font-mono font-semibold text-text-secondary">12 mapped &bull; 3 available</span>
        </div>
        <div className="divide-y divide-border-subtle">
          {drives.map((d) => (
            <div key={d.company} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary truncate">{d.company}</div>
                  <div className="text-2xs text-text-secondary truncate">{d.meta}</div>
                </div>
              </div>
              {d.state === "Mapped" ? (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 text-3xs font-bold">
                  <Check className="w-3 h-3" /> Mapped
                </span>
              ) : (
                <span className="shrink-0 px-3 py-1.5 rounded-control bg-accent-primary text-white text-2xs font-bold">
                  <span className="sm:hidden">Map</span>
                  <span className="hidden sm:inline">{d.state}</span>
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="px-5 py-3 border-t border-border-subtle text-2xs font-medium text-text-secondary">
          Set CGPA, backlog and branch eligibility — it&apos;s live for students instantly.
        </p>
      </div>

      <div className="lg:col-span-2 p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-text-secondary">
          <BarChart3 className="w-4 h-4 text-accent-primary" />
          Readiness by branch
        </div>
        <div className="space-y-3">
          {branches.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-2xs font-semibold text-text-secondary mb-1">
                <span>{b.label}</span>
                <span className="font-mono text-primary">{b.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-elevated overflow-hidden">
                <GrowBar pct={b.value} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
          <Users2 className="w-3.5 h-3.5 text-accent-primary" />
          Bulk-import a whole batch from one CSV
        </div>
      </div>
    </div>
    </div>
  );
}

/* ------------------------------ Helpers ------------------------------ */

function StatusPill({ tone, children }: { tone: "success" | "primary" | "muted"; children: React.ReactNode }) {
  const styles = {
    success: "bg-status-success/15 text-status-success border-status-success/30",
    primary: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
    muted: "bg-elevated text-text-secondary border-border-subtle",
  };
  return (
    <span className={cn("shrink-0 px-2 py-0.5 rounded-full border text-3xs font-bold whitespace-nowrap", styles[tone])}>
      {children}
    </span>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[68px] h-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-elevated" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-accent-primary"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-black font-mono text-primary">{value}</span>
    </div>
  );
}

function GrowBar({ pct }: { pct: number }) {
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.9, delay: 0.15, ease: "easeOut" }}
      className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
    />
  );
}
