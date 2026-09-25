export type ArticleStatus = "draft" | "published";

/** Kept in eyeball-lockstep with backend ArticleTopic::COLORS. */
export type TopicColor = "indigo" | "emerald" | "amber" | "sky" | "rose";

/** Kept in eyeball-lockstep with backend ArticleTopic::ICONS. */
export const TOPIC_ICON_NAMES = ["Binary", "Code2", "Terminal", "Cpu", "Network", "Database", "GitBranch", "Layers"] as const;
export type TopicIconName = (typeof TOPIC_ICON_NAMES)[number];

export const TOPIC_COLORS: Record<TopicColor, string> = {
  indigo: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  sky: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

/** Matching gradient pair per topic color, for the topic card's icon badge. */
export const TOPIC_GRADIENTS: Record<TopicColor, string> = {
  indigo: "from-accent-primary/25 to-accent-primary/5",
  emerald: "from-emerald-500/25 to-emerald-500/5",
  amber: "from-amber-500/25 to-amber-500/5",
  sky: "from-sky-500/25 to-sky-500/5",
  rose: "from-rose-500/25 to-rose-500/5",
};

export interface ArticleTopicSummary {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: TopicIconName | null;
  color: TopicColor | null;
  display_order: number;
  articles_count?: number;
  published_articles_count?: number;
  read_count?: number;
  total_reading_minutes?: number;
}

export interface ArticleListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  icon: TopicIconName | null;
  display_order: number;
  reading_time_minutes: number;
  view_count: number;
  is_read: boolean;
}

/** Admin list shape — every status, no `is_read` (that's a student concept), a nested topic ref instead. */
export interface AdminArticleSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  status: ArticleStatus;
  display_order: number;
  reading_time_minutes: number;
  view_count: number;
  published_at: string | null;
  article_topic: { id: number; name: string; slug: string; color: TopicColor | null };
}

export interface AdminArticleDetail extends AdminArticleSummary {
  article_topic_id: number;
  content: string;
  icon: TopicIconName | null;
}

export interface ArticleAdjacent {
  title: string;
  slug: string;
  icon: TopicIconName | null;
}

export interface ArticleDetail {
  id: number;
  article_topic_id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  icon: TopicIconName | null;
  reading_time_minutes: number;
  view_count: number;
  published_at: string | null;
  is_read: boolean;
  article_topic: { id: number; name: string; slug: string; color: TopicColor | null; icon: TopicIconName | null };
  created_by: { id: number; name: string } | null;
}
