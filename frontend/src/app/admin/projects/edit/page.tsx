"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { TopicEditor } from "@/components/admin/projectLab/TopicEditor";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api } from "@/lib/api";
import { userHasPermission } from "@/lib/auth";
import { errorMessage } from "@/lib/projectLab";
import { useAuthGuard } from "@/lib/useAuthGuard";
import type { AdminTopicFull } from "@/types/projectLab";

export default function EditProjectPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <EditProjectContent />
    </Suspense>
  );
}

/** `?id=12` edits a project; no id starts a new one. */
function EditProjectContent() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "project_lab");
  const id = useSearchParams().get("id");

  const [topic, setTopic] = useState<AdminTopicFull | undefined>();
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !hasAccess || !id) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<{ topic: AdminTopicFull }>(`/admin/project-lab/topics/${encodeURIComponent(id)}`)
      .then((res) => !cancelled && setTopic(res.topic))
      .catch((err) => !cancelled && setError(errorMessage(err, "We couldn't load this project.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, hasAccess, id]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Project Lab">
        <AccessDeniedNotice section="Project Lab" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin_internal" title={id ? "Edit project" : "New project"} subtitle="Write the SOW, list the milestones, then publish when it's ready.">
      <Link href="/admin/projects" className="-mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        All projects
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-xs text-text-secondary" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading project…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
          {error}
        </div>
      ) : (
        // Keyed so moving between projects (or creating → editing) rebuilds the form from scratch.
        <TopicEditor key={topic?.id ?? "new"} topic={topic} />
      )}
    </DashboardShell>
  );
}
