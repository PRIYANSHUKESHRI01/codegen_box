"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ChevronLeft } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ArticleListRow } from "@/components/dashboard/articles/ArticleListRow";
import { TopicIcon } from "@/components/dashboard/articles/topicIcons";
import { TOPIC_COLORS } from "@/types/article";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ArticleListItem, ArticleTopicSummary } from "@/types/article";

/** One topic's reading path, syllabus-style — click any article to start, or resume where a checkmark leaves off. */
export default function ArticleTopicPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ArticleTopicPageContent />
    </Suspense>
  );
}

function ArticleTopicPageContent() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const topicSlug = searchParams.get("topicSlug") ?? "";
  const router = useRouter();

  const [topic, setTopic] = useState<ArticleTopicSummary | null>(null);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ topic: ArticleTopicSummary; articles: ArticleListItem[] }>(`/articles/topics/${topicSlug}`);
      setTopic(res.topic);
      setArticles(res.articles);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load this topic.");
    } finally {
      setLoading(false);
    }
  }, [topicSlug]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const readCount = articles.filter((a) => a.is_read).length;

  return (
    <DashboardShell role="user" title="Articles">
      <button
        onClick={() => router.push("/dashboard/articles")}
        className="flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors -mt-2"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        All Topics
      </button>

      {loading ? (
        <div className="p-16 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : error || !topic ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">
          {error ?? "Topic not found."}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 shrink-0 rounded-control flex items-center justify-center border",
                TOPIC_COLORS[topic.color ?? "indigo"]
              )}
            >
              <TopicIcon name={topic.icon} className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-primary">{topic.name}</h2>
              {topic.description && <p className="text-xs text-text-muted mt-0.5 max-w-2xl">{topic.description}</p>}
              <p className="text-2xs text-text-muted mt-1">
                {readCount} of {articles.length} read
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {articles.map((article, idx) => (
              <ArticleListRow key={article.slug} article={article} index={idx} />
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
