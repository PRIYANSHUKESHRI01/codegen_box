"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, ClipboardList, FileUp, Flag, ListChecks, Network } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CoreCoveragePanel } from "@/components/admin/core/CoreCoveragePanel";
import { CoreImportPanel } from "@/components/admin/core/CoreImportPanel";
import { CoreQuestionEditor } from "@/components/admin/core/CoreQuestionEditor";
import { CoreQuestionsPanel } from "@/components/admin/core/CoreQuestionsPanel";
import { CoreReportsPanel } from "@/components/admin/core/CoreReportsPanel";
import { CoreTaxonomyPanel } from "@/components/admin/core/CoreTaxonomyPanel";
import { CoreTestsPanel } from "@/components/admin/core/CoreTestsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CoreQuestion, CoreTaxonomyResponse } from "@/types/core";

type Tab = "questions" | "tests" | "import" | "coverage" | "reports" | "taxonomy";

const TABS: { id: Tab; label: string; icon: typeof ListChecks }[] = [
  { id: "questions", label: "Questions", icon: ListChecks },
  { id: "tests", label: "Tests", icon: ClipboardList },
  { id: "import", label: "Import", icon: FileUp },
  { id: "coverage", label: "Coverage & go-live", icon: BarChart3 },
  { id: "reports", label: "Student reports", icon: Flag },
  { id: "taxonomy", label: "Subjects & topics", icon: Network },
];

/**
 * Mellow Ops → Core Prep. Where the technical questions ECE, EEE, Mechanical and Civil students practise and are
 * tested on are written, reviewed and bulk-imported. Nothing here reaches a student until a question is published
 * AND a superadmin switches that branch live (Coverage & go-live), so the bank can be built up safely.
 */
export default function CorePrepAdminPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "core_prep");

  const [tab, setTab] = useState<Tab>("questions");
  const [taxonomy, setTaxonomy] = useState<CoreTaxonomyResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [opened, setOpened] = useState<CoreQuestion | null>(null);
  const [version, setVersion] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadTaxonomy = useCallback(async () => {
    try {
      setTaxonomy(await api.get<CoreTaxonomyResponse>("/admin/core/taxonomy"));
    } catch {
      setTaxonomy(null);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && hasAccess) void loadTaxonomy();
  }, [status, hasAccess, loadTaxonomy]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_internal"
      title="Domain Prep"
      subtitle="Subject questions and tests for every department — Core Prep for engineering, Management, Commerce and Arts prep — written, reviewed and bulk-imported here."
    >
      {toast && (
        <div role="status" className="fixed right-6 top-20 z-[100] max-w-sm rounded-panel border border-accent-primary/40 bg-surface px-4 py-3 text-xs font-semibold text-primary shadow-card">
          {toast}
        </div>
      )}

      {!hasAccess ? (
        <AccessDeniedNotice section="Core Prep" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle bg-elevated p-1 w-fit" role="tablist" aria-label="Core Prep sections">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-control px-3.5 py-1.5 text-2xs font-bold transition-colors", tab === t.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary")}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
                </button>
              );
            })}
          </div>

          {!taxonomy ? (
            <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />
          ) : (
            <>
              {tab === "questions" && <CoreQuestionsPanel key={version} taxonomy={taxonomy} onToast={showToast} />}
              {tab === "tests" && <CoreTestsPanel mode="admin" onToast={showToast} />}
              {tab === "import" && <CoreImportPanel onToast={showToast} onImported={() => { setVersion((v) => v + 1); void loadTaxonomy(); }} />}
              {tab === "coverage" && <CoreCoveragePanel isSuperadmin={user?.role === "superadmin"} onToast={showToast} />}
              {tab === "reports" && <CoreReportsPanel onToast={showToast} onOpen={setOpened} />}
              {tab === "taxonomy" && <CoreTaxonomyPanel taxonomy={taxonomy} onChanged={() => void loadTaxonomy()} onToast={showToast} />}
            </>
          )}

          {opened && taxonomy && (
            <CoreQuestionEditor
              key={opened.id}
              question={opened}
              taxonomy={taxonomy}
              defaultDiscipline={opened.discipline_code}
              onClose={() => setOpened(null)}
              onSaved={() => setVersion((v) => v + 1)}
              onDeleted={() => { setOpened(null); setVersion((v) => v + 1); }}
              onToast={showToast}
            />
          )}
        </>
      )}
    </DashboardShell>
  );
}
