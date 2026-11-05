"use client";

import { useState } from "react";
import { Activity, Building2, Grid3x3, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { CollegeDetail } from "./CollegeDetail";
import { CollegesPanel } from "./CollegesPanel";
import { LivePanel } from "./LivePanel";
import { PatternsPanel } from "./PatternsPanel";
import { PersonDrawer } from "./PersonDrawer";
import { SignInsPanel } from "./SignInsPanel";

type View = "live" | "colleges" | "signins" | "patterns";

const VIEWS: { id: View; label: string; icon: typeof Activity }[] = [
  { id: "live", label: "Live now", icon: Activity },
  { id: "colleges", label: "Colleges & logins", icon: Building2 },
  { id: "signins", label: "Sign-in log", icon: LogIn },
  { id: "patterns", label: "Usage patterns", icon: Grid3x3 },
];

/**
 * Superadmin -> Live Activity. One place to answer: who is on AptRun right now, how many came today / this week / this month, did the
 * college we gave a demo login to ever open it, did they set a password, and what did they do after — down to the screen, the time on
 * it and how far they scrolled. Read-only; the numbers come from what each signed-in browser reports (lib/activityTracker) and from the
 * sign-in log. A college (or a person) can be opened from anywhere on this tab, and from the Overview's attention list.
 */
export function ActivityPanel({ initialCollegeId = null }: { initialCollegeId?: number | null }) {
  const [view, setView] = useState<View>(initialCollegeId ? "colleges" : "live");
  const [collegeId, setCollegeId] = useState<number | null>(initialCollegeId);
  const [personId, setPersonId] = useState<number | null>(null);

  const openCollege = (id: number) => {
    setCollegeId(id);
    setView("colleges");
    setPersonId(null);
  };

  return (
    <div className="min-w-0 space-y-5">
      <div role="tablist" aria-label="Live activity views" className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => {
              setView(v.id);
              if (v.id !== "colleges") setCollegeId(null);
            }}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-control px-3 py-1.5 text-2xs font-bold transition-colors", view === v.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary")}
          >
            <v.icon className="h-3.5 w-3.5" aria-hidden /> {v.label}
          </button>
        ))}
      </div>

      {view === "live" && <LivePanel onOpenPerson={setPersonId} onOpenCollege={openCollege} />}
      {view === "colleges" && (collegeId ? <CollegeDetail collegeId={collegeId} onBack={() => setCollegeId(null)} onOpenPerson={setPersonId} /> : <CollegesPanel onOpenCollege={openCollege} />)}
      {view === "signins" && <SignInsPanel onOpenPerson={setPersonId} onOpenCollege={openCollege} />}
      {view === "patterns" && <PatternsPanel />}

      {personId !== null && <PersonDrawer userId={personId} onClose={() => setPersonId(null)} />}
    </div>
  );
}
