"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Briefcase, Building2, Check, GraduationCap, Rocket, Sparkles } from "lucide-react";

type View = "student" | "tpo";

const VIEWS: { id: View; label: string }[] = [
  { id: "student", label: "Student View" },
  { id: "tpo", label: "TPO View" },
];

/**
 * Replaces the old fake Monaco IDE mockup with an honest preview of what
 * this platform actually is — a dual-role placement product, not a
 * competitive-programming judge. All values below are static marketing
 * mock data (no API calls), auto-rotating between the two real dashboards
 * this session built: the student's "Prepare" flow and the TPO's drive
 * mapping screen. Same window-chrome treatment as the component it
 * replaces (traffic-light title bar, top hairline) — only the content
 * inside changes.
 */
export function ProductPreview() {
  const [view, setView] = useState<View>("student");

  useEffect(() => {
    const id = setInterval(() => {
      setView((v) => (v === "student" ? "tpo" : "student"));
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      id="platform-preview"
      className="relative w-full max-w-5xl mx-auto rounded-card lg:rounded-panel bg-surface border border-border-strong shadow-2xl overflow-hidden transition-all duration-300 group hover:border-accent-primary/40"
    >
      {/* Top ambient hairline */}
      <div className="absolute top-0 inset-x-0 h-px gradient-hairline opacity-75" />

      {/* Window Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface/90 backdrop-blur-sm border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-2.5 text-xs font-mono text-text-muted hidden sm:inline-flex items-center gap-1.5">
            <span className="text-primary font-bold">CodeGen Box Platform</span>
          </span>
        </div>

        {/* Manual view switcher — also auto-rotates */}
        <div className="flex items-center gap-1 p-0.5 rounded-control bg-elevated border border-border-subtle">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1 rounded-[6px] text-3xs sm:text-2xs font-bold transition-colors ${
                view === v.id ? "bg-accent-primary text-white" : "text-text-muted hover:text-primary"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative min-h-[360px] sm:min-h-[400px] p-5 sm:p-8 bg-background/40">
        <AnimatePresence mode="wait">
          {view === "student" ? (
            <motion.div
              key="student"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-4 h-4 text-accent-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Upcoming Placement Drive
                </span>
              </div>

              <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-primary truncate">Nova Systems</h3>
                      <p className="text-xs text-text-muted truncate">Systems Engineer &bull; ₹3.6 - 6.25 LPA</p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 text-3xs font-bold whitespace-nowrap">
                    Eligible
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Starts In", value: "3d 14h" },
                    { label: "Rounds", value: "3" },
                    { label: "Prep Qs", value: "12" },
                  ].map((stat) => (
                    <div key={stat.label} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-center">
                      <div className="text-sm font-bold text-primary font-mono">{stat.value}</div>
                      <div className="text-3xs uppercase tracking-wide text-text-muted mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <button className="w-full py-2.5 rounded-btn bg-accent-primary/10 border border-accent-primary/25 text-accent-primary text-xs font-bold flex items-center justify-center gap-1.5">
                  <span>Prepare for Nova Systems</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-center text-2xs text-text-muted mt-4">
                Company overview, hiring rounds, and previous-year interview questions — all in one place.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="tpo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="max-w-2xl mx-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-accent-secondary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Campus Drives &bull; Apex Institute
                  </span>
                </div>
                <span className="text-3xs font-mono text-text-muted">12 Mapped &bull; 3 Available</span>
              </div>

              <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                      <Building2 className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-primary">Nova Systems</div>
                      <div className="text-2xs text-text-muted">Systems Engineer &bull; Sept 16</div>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 text-3xs font-bold">
                    <Check className="w-3 h-3" />
                    Mapped
                  </span>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-control bg-accent-secondary/10 border border-accent-secondary/25 flex items-center justify-center text-accent-secondary shrink-0">
                      <Rocket className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-primary">Quantica Labs</div>
                      <div className="text-2xs text-text-muted">Software Engineer &bull; CTC 7 LPA</div>
                    </div>
                  </div>
                  <button className="shrink-0 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors">
                    Map to College
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-control bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
                      <Briefcase className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-primary">Orbit Technologies</div>
                      <div className="text-2xs text-text-muted">Project Engineer &bull; CTC 4.5 LPA</div>
                    </div>
                  </div>
                  <button className="shrink-0 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors">
                    Map to College
                  </button>
                </div>
              </div>

              <p className="text-center text-2xs text-text-muted mt-4 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent-primary" />
                Opt into a recruiter, set eligibility, and it's live for your students instantly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
