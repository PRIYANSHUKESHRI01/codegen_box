"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Newspaper } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ArticleTopicCard } from "@/components/dashboard/articles/ArticleTopicCard";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { ArticleTopicSummary } from "@/types/article";

/**
 * The knowledge-base landing page — every topic Mellow Ops has published at
 * least one article in, each a self-paced reading path (see the reader at
 * dashboard/articles/[articleSlug]). Same visibility for every student —
 * no college/company scoping, unlike Contests/Interviews.
 */
export default function ArticlesTopicsPage() {
  const { status } = useAuthGuard(["user"]);
  const [topics, setTopics] = useState<ArticleTopicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ topics: ArticleTopicSummary[] }>("/articles/topics");
      setTopics(res.topics);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load articles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Articles"
      subtitle="Curated, topic-by-topic knowledge from Mellow — read at your own pace, one article to the next."
    >
      {loading ? (
        <div className="p-16 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading articles...
        </div>
      ) : error ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">{error}</div>
      ) : topics.length === 0 ? (
        <div className="p-16 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
          <Newspaper className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-xs text-text-muted">No articles published yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((topic) => (
            <ArticleTopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
