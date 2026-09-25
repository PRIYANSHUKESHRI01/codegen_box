"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArticleListItem } from "@/types/article";

export function ArticleListRow({ article, index }: { article: ArticleListItem; index: number }) {
  return (
    <Link
      href={`/dashboard/articles/${article.slug}`}
      className="group flex items-center gap-4 p-4 rounded-panel bg-surface border border-border-subtle hover:border-accent-primary/30 hover:bg-elevated/40 shadow-subtle transition-all"
    >
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border",
          article.is_read
            ? "bg-status-success/10 text-status-success border-status-success/25"
            : "bg-elevated text-text-muted border-border-subtle"
        )}
      >
        {article.is_read ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors truncate">{article.title}</h4>
        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{article.excerpt}</p>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <span className="flex items-center gap-1 text-[11px] text-text-muted">
          <Clock3 className="w-3 h-3" />
          {article.reading_time_minutes} min
        </span>
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}
