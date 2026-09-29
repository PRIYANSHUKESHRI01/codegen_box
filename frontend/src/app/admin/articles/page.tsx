"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Trash2, Pencil, Eye, EyeOff, FolderPlus, Newspaper } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { TopicIcon } from "@/components/dashboard/articles/topicIcons";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TOPIC_COLORS, TOPIC_ICON_NAMES, type ArticleTopicSummary, type AdminArticleSummary, type TopicColor, type TopicIconName } from "@/types/article";

const COLORS: TopicColor[] = ["indigo", "emerald", "amber", "sky", "rose"];

export default function AdminArticlesPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "articles");
  const router = useRouter();

  const [topics, setTopics] = useState<ArticleTopicSummary[]>([]);
  const [articles, setArticles] = useState<AdminArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [showTopicModal, setShowTopicModal] = useState<ArticleTopicSummary | "new" | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [topicsRes, articlesRes] = await Promise.all([
        api.get<{ topics: ArticleTopicSummary[] }>("/admin/article-topics"),
        api.get<{ articles: AdminArticleSummary[] }>(`/admin/articles${topicFilter ? `?topic=${topicFilter}` : ""}`),
      ]);
      setTopics(topicsRes.topics);
      setArticles(articlesRes.articles);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load articles.");
    } finally {
      setLoading(false);
    }
  }, [topicFilter]);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Articles">
        <AccessDeniedNotice section="Articles" />
      </DashboardShell>
    );
  }

  const handleTogglePublish = async (article: AdminArticleSummary) => {
    const nextStatus = article.status === "published" ? "draft" : "published";
    try {
      await api.post(`/admin/articles/${article.slug}`, { status: nextStatus });
      triggerToast(nextStatus === "published" ? `"${article.title}" is now published.` : `"${article.title}" moved back to draft.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update status.");
    }
  };

  const handleDeleteArticle = async (article: AdminArticleSummary) => {
    if (!window.confirm(`Delete "${article.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`/admin/articles/${article.slug}`);
      triggerToast(`"${article.title}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete article.");
    }
  };

  const handleDeleteTopic = async (topic: ArticleTopicSummary) => {
    if (!window.confirm(`Delete the "${topic.name}" topic?`)) return;
    try {
      await api.delete(`/admin/article-topics/${topic.slug}`);
      triggerToast(`"${topic.name}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete topic.");
    }
  };

  return (
    <DashboardShell
      role="admin_internal"
      title="Articles"
      subtitle="The Articles knowledge base — organized into topics, read topic-by-topic by every student."
      actionButton={{ label: "New Article", icon: Plus, onClick: () => router.push("/admin/articles/new") }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Topics</h3>
          <button
            onClick={() => setShowTopicModal("new")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Topic
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTopicFilter("")}
            className={cn(
              "px-3 py-1.5 rounded-control text-[11px] font-bold border transition-colors",
              topicFilter === "" ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
            )}
          >
            All
          </button>
          {topics.map((topic) => (
            <div key={topic.id} className="group relative">
              <button
                onClick={() => setTopicFilter(topic.slug)}
                className={cn(
                  "flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-control text-[11px] font-bold border transition-colors",
                  topicFilter === topic.slug
                    ? "bg-accent-primary text-white border-accent-primary"
                    : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                )}
              >
                <TopicIcon name={topic.icon} className="w-3.5 h-3.5" />
                {topic.name}
                <span className="opacity-60">({topic.articles_count ?? 0})</span>
              </button>
              <div className="hidden group-hover:flex absolute -top-2 -right-2 items-center gap-0.5">
                <button
                  onClick={() => setShowTopicModal(topic)}
                  title="Edit topic"
                  className="w-5 h-5 rounded-full bg-surface border border-border-strong flex items-center justify-center text-text-muted hover:text-accent-primary shadow-subtle"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
                <button
                  onClick={() => handleDeleteTopic(topic)}
                  title="Delete topic"
                  className="w-5 h-5 rounded-full bg-surface border border-border-strong flex items-center justify-center text-text-muted hover:text-status-danger shadow-subtle"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading articles...
        </div>
      ) : articles.length === 0 ? (
        <div className="p-16 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
          <Newspaper className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-xs text-text-muted">No articles yet — click &quot;New Article&quot; to write the first one.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {articles.map((article) => (
            <div
              key={article.id}
              className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-primary truncate">{article.title}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                      article.status === "published" ? "bg-status-success/15 text-status-success" : "bg-elevated text-text-muted"
                    )}
                  >
                    {article.status}
                  </span>
                  <span className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded border", TOPIC_COLORS[article.article_topic.color ?? "indigo"])}>
                    {article.article_topic.name}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  {article.reading_time_minutes} min read · {article.view_count} view{article.view_count === 1 ? "" : "s"} · order {article.display_order}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleTogglePublish(article)}
                  title={article.status === "published" ? "Unpublish" : "Publish"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  {article.status === "published" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {article.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => router.push(`/admin/articles/edit?slug=${article.slug}`)}
                  className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteArticle(article)}
                  title="Delete article"
                  className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showTopicModal && (
        <TopicModal
          topic={showTopicModal === "new" ? null : showTopicModal}
          onClose={() => setShowTopicModal(null)}
          onSaved={() => {
            setShowTopicModal(null);
            load();
          }}
          onToast={triggerToast}
        />
      )}
    </DashboardShell>
  );
}

function TopicModal({
  topic,
  onClose,
  onSaved,
  onToast,
}: {
  topic: ArticleTopicSummary | null;
  onClose: () => void;
  onSaved: () => void;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState(topic?.name ?? "");
  const [description, setDescription] = useState(topic?.description ?? "");
  const [icon, setIcon] = useState<TopicIconName>(topic?.icon ?? "Binary");
  const [color, setColor] = useState<TopicColor>(topic?.color ?? "indigo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (topic) {
        await api.post(`/admin/article-topics/${topic.slug}`, { name, description: description || undefined, icon, color });
      } else {
        await api.post("/admin/article-topics", { name, description: description || undefined, icon, color });
      }
      onToast(topic ? `"${name}" updated.` : `"${name}" created.`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save topic.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary">{topic ? "Edit Topic" : "New Topic"}</h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. System Design"
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {TOPIC_ICON_NAMES.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  title={iconName}
                  className={cn(
                    "w-9 h-9 rounded-control border flex items-center justify-center transition-colors",
                    icon === iconName ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                  )}
                >
                  <TopicIcon name={iconName} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-[11px] font-bold border capitalize transition-all",
                    TOPIC_COLORS[c],
                    color === c ? "ring-2 ring-offset-1 ring-offset-surface ring-accent-primary" : "opacity-60 hover:opacity-100"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
              {saving ? "Saving..." : topic ? "Save Changes" : "Create Topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
