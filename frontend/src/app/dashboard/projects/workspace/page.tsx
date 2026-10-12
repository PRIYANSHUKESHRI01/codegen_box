"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceView } from "@/components/dashboard/projectLab/WorkspaceView";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";

export default function ProjectWorkspacePage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <WorkspacePageContent />
    </Suspense>
  );
}

function WorkspacePageContent() {
  const { status } = useAuthGuard(["user"]);
  const id = Number(useSearchParams().get("id"));

  if (status !== "ready") return <SessionLoader />;

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-text-secondary">
        No project selected. <a className="ml-1 font-bold text-accent-primary underline" href="/dashboard/projects">Back to Project Lab</a>
      </div>
    );
  }

  return <WorkspaceView enrollmentId={id} />;
}
