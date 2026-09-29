"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { ArticleEditor } from "@/components/dashboard/articles/ArticleEditor";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { AdminArticleDetail } from "@/types/article";

export default function EditArticlePage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <EditArticlePageContent />
    </Suspense>
  );
}

function EditArticlePageContent() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "articles");
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";

  const [article, setArticle] = useState<AdminArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ article: AdminArticleDetail }>(`/admin/articles/${slug}`);
      setArticle(res.article);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load this article.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Edit Article">
        <AccessDeniedNotice section="Articles" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin_internal" title="Edit Article" fullBleed>
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading article...
        </div>
      ) : error || !article ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle max-w-sm">
            {error ?? "Article not found."}
          </div>
        </div>
      ) : (
        <ArticleEditor mode="edit" initialArticle={article} />
      )}
    </DashboardShell>
  );
}
