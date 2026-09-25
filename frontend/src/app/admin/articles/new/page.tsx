"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { ArticleEditor } from "@/components/dashboard/articles/ArticleEditor";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";

export default function NewArticlePage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "articles");

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="New Article">
        <AccessDeniedNotice section="Articles" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin_internal" title="New Article" fullBleed>
      <ArticleEditor mode="create" />
    </DashboardShell>
  );
}
