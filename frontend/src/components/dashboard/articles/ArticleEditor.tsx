"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock3, Eye, Code2 } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminArticleDetail, ArticleStatus, ArticleTopicSummary } from "@/types/article";

const WORDS_PER_MINUTE = 200;

function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

interface ArticleEditorProps {
  mode: "create" | "edit";
  initialArticle?: AdminArticleDetail;
}

/**
 * The full-page authoring surface for one article — split markdown-source /
 * live-preview (same MarkdownRenderer the student reader uses, so what an
 * Ops author sees here is exactly what a student will see), a compact meta
 * panel, and a sticky save bar. Shared between /admin/articles/new and
 * /admin/articles/[slug]/edit.
 */
export function ArticleEditor({ mode, initialArticle }: ArticleEditorProps) {
  const router = useRouter();

  const [topics, setTopics] = useState<ArticleTopicSummary[]>([]);
  const [title, setTitle] = useState(initialArticle?.title ?? "");
  const [articleTopicId, setArticleTopicId] = useState(initialArticle?.article_topic_id ? String(initialArticle.article_topic_id) : "");
  const [excerpt, setExcerpt] = useState(initialArticle?.excerpt ?? "");
  const [content, setContent] = useState(initialArticle?.content ?? "");
  const [status, setStatus] = useState<ArticleStatus>(initialArticle?.status ?? "draft");
  const [displayOrder, setDisplayOrder] = useState(String(initialArticle?.display_order ?? 0));
  const [view, setView] = useState<"source" | "preview">("source");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ topics: ArticleTopicSummary[] }>("/admin/article-topics")
      .then((res) => {
        setTopics(res.topics);
        if (!articleTopicId && res.topics.length > 0) setArticleTopicId(String(res.topics[0].id));
      })
      .catch(() => setTopics([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readingMinutes = useMemo(() => estimateReadingMinutes(content), [content]);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);

  const handleSave = async (targetStatus?: ArticleStatus) => {
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      article_topic_id: Number(articleTopicId),
      excerpt: excerpt.trim(),
      content,
      status: targetStatus ?? status,
      display_order: Number(displayOrder) || 0,
    };

    try {
      if (mode === "create") {
        const res = await api.post<{ article: AdminArticleDetail }>("/admin/articles", payload);
        router.push(`/admin/articles/edit?slug=${res.article.slug}`);
      } else if (initialArticle) {
        await api.post(`/admin/articles/${initialArticle.slug}`, payload);
        router.push("/admin/articles");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this article.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = title.trim().length > 0 && articleTopicId !== "" && excerpt.trim().length > 0 && content.trim().length >= 100;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Sticky meta + save bar */}
      <div className="border-b border-border-subtle bg-surface px-4 sm:px-6 py-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title..."
          className="w-full text-xl font-extrabold text-primary bg-transparent outline-none placeholder:text-text-muted"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={articleTopicId}
            onChange={(e) => setArticleTopicId(e.target.value)}
            className="px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary text-[11px] font-semibold outline-none focus:border-accent-primary"
          >
            <option value="">Select topic...</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            title="Order within topic"
            className="w-16 px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary text-[11px] font-semibold outline-none focus:border-accent-primary"
          />
          <div className="flex gap-1 p-0.5 rounded-control bg-elevated border border-border-subtle">
            {(["draft", "published"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "px-2.5 py-1 rounded-control text-[10.5px] font-bold capitalize transition-all",
                  status === s ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-[10.5px] text-text-muted ml-auto">
            <Clock3 className="w-3 h-3" />
            {readingMinutes} min read · {wordCount} words
          </span>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving || !canSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === "create" ? "Create Article" : "Save Changes"}
          </button>
        </div>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          placeholder="Excerpt — a 1-2 sentence summary shown on cards and in search previews..."
          maxLength={500}
          className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary resize-none"
        />
        {error && <p className="text-[11px] text-status-danger">{error}</p>}
      </div>

      {/* Source / Preview toggle (mobile) */}
      <div className="lg:hidden flex gap-1 p-2 border-b border-border-subtle bg-surface">
        <button
          type="button"
          onClick={() => setView("source")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-control text-[11px] font-bold transition-colors",
            view === "source" ? "bg-accent-primary text-white" : "bg-elevated text-text-secondary"
          )}
        >
          <Code2 className="w-3.5 h-3.5" />
          Source
        </button>
        <button
          type="button"
          onClick={() => setView("preview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-control text-[11px] font-bold transition-colors",
            view === "preview" ? "bg-accent-primary text-white" : "bg-elevated text-text-secondary"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
      </div>

      {/* Split editor */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle overflow-hidden">
        <div className={cn("min-h-0 overflow-y-auto bg-background", view === "preview" && "hidden lg:block")}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write in Markdown — # headings, **bold**, `code`, ```language fenced code blocks```, tables, lists..."
            className="w-full h-full min-h-[60vh] p-4 sm:p-6 bg-transparent text-[13px] font-mono text-primary leading-relaxed outline-none resize-none"
            spellCheck={false}
          />
        </div>
        <div className={cn("min-h-0 overflow-y-auto bg-surface", view === "source" && "hidden lg:block")}>
          <div className="max-w-[680px] mx-auto p-4 sm:p-6">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-xs text-text-muted italic">Preview appears here as you write...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
