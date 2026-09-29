"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CheckCircle2, Circle, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleListItem } from "@/types/article";

/**
 * Optional, secondary polish — lets a reader jump around non-linearly.
 * Prev/Next (see PrevNextArticleNav) remains the primary reading path.
 * Collapsed by default so it never competes with the article itself.
 */
export function TopicSidebarNav({
  topicName,
  articles,
  currentSlug,
}: {
  topicName: string;
  articles: ArticleListItem[];
  currentSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-bold text-text-secondary hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <ListTree className="w-3.5 h-3.5" />
          In this topic — {topicName}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border-subtle divide-y divide-border-subtle">
          {articles.map((a, idx) => (
            <Link
              key={a.slug}
              href={`/dashboard/articles/view?articleSlug=${a.slug}`}
              className={cn(
                "flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors",
                a.slug === currentSlug ? "bg-accent-primary/[0.06] text-accent-primary font-bold" : "text-text-secondary hover:bg-elevated/60 hover:text-primary"
              )}
            >
              {a.is_read ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-text-muted shrink-0" />
              )}
              <span className="truncate">
                {idx + 1}. {a.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
