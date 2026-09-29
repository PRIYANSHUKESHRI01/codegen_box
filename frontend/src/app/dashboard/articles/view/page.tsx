"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ChevronLeft, Clock3, CalendarDays, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MarkdownRenderer } from "@/components/dashboard/articles/MarkdownRenderer";
import { ReadingProgressBar } from "@/components/dashboard/articles/ReadingProgressBar";
import { PrevNextArticleNav } from "@/components/dashboard/articles/PrevNextArticleNav";
import { TopicSidebarNav } from "@/components/dashboard/articles/TopicSidebarNav";
import { TopicIcon } from "@/components/dashboard/articles/topicIcons";
import { TOPIC_COLORS } from "@/types/article";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ArticleAdjacent, ArticleDetail, ArticleListItem } from "@/types/article";

const READ_THRESHOLD = 0.9;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * The reader. fullBleed only to skip the generic page heading (the
 * article's own styled title/byline replaces it) — otherwise this is a
 * normal, naturally-scrolling page: DashboardSidebar is independently
 * `fixed`-positioned, so letting the page grow taller than the viewport and
 * scroll normally (rather than fighting for an internal fixed-height scroll
 * pane the way the Monaco-editor/exam-mode pages do) is both simpler and
 * correct here — see ReadingProgressBar's own docblock.
 */
export default function ArticleReaderPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ArticleReaderPageContent />
    </Suspense>
  );
}

function ArticleReaderPageContent() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const articleSlug = searchParams.get("articleSlug") ?? "";
  const router = useRouter();

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [previous, setPrevious] = useState<ArticleAdjacent | null>(null);
  const [next, setNext] = useState<ArticleAdjacent | null>(null);
  const [topicArticles, setTopicArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const markedReadRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    markedReadRef.current = false;
    try {
      const res = await api.get<{ article: ArticleDetail; previous: ArticleAdjacent | null; next: ArticleAdjacent | null }>(
        `/articles/${articleSlug}`
      );
      setArticle(res.article);
      setPrevious(res.previous);
      setNext(res.next);
      markedReadRef.current = res.article.is_read;

      api
        .get<{ articles: ArticleListItem[] }>(`/articles/topics/${res.article.article_topic.slug}`)
        .then((topicRes) => setTopicArticles(topicRes.articles))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this article.");
    } finally {
      setLoading(false);
    }
  }, [articleSlug]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  useEffect(() => {
    if (article) document.title = `${article.title} — Articles — CodeGen Box`;
  }, [article]);

  const markRead = useCallback(() => {
    if (markedReadRef.current || !article) return;
    markedReadRef.current = true;
    api.post(`/articles/${article.slug}/read`, {}).catch(() => {
      markedReadRef.current = false; // allow a retry on the next threshold crossing if the request failed
    });
  }, [article]);

  useEffect(() => {
    if (!article) return;

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const ratio = scrollable > 0 ? doc.scrollTop / scrollable : 1;
      if (ratio >= READ_THRESHOLD) markRead();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [article, markRead]);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell role="user" title="Article" fullBleed>
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
        <>
          <ReadingProgressBar />
          <div className="max-w-[720px] mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
            <button
              onClick={() => router.push(`/dashboard/articles/topic?topicSlug=${article.article_topic.slug}`)}
              className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {article.article_topic.name}
            </button>

            <div className="space-y-3">
              <div
                className={cn(
                  "inline-flex w-9 h-9 rounded-control items-center justify-center border",
                  TOPIC_COLORS[article.article_topic.color ?? "indigo"]
                )}
              >
                <TopicIcon name={article.icon ?? article.article_topic.icon} className="w-4.5 h-4.5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-text-muted">
                {article.created_by && <span className="font-semibold text-text-secondary">{article.created_by.name}</span>}
                {article.published_at && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(article.published_at)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  {article.reading_time_minutes} min read
                </span>
                {article.is_read && (
                  <span className="flex items-center gap-1 text-status-success font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Read
                  </span>
                )}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            <MarkdownRenderer content={article.content} />

            <div className="pt-4 space-y-4">
              <PrevNextArticleNav previous={previous} next={next} />
              {topicArticles.length > 1 && (
                <TopicSidebarNav topicName={article.article_topic.name} articles={topicArticles} currentSlug={article.slug} />
              )}
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
