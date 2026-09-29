"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopicIcon } from "./topicIcons";
import type { ArticleAdjacent } from "@/types/article";

export function PrevNextArticleNav({ previous, next }: { previous: ArticleAdjacent | null; next: ArticleAdjacent | null }) {
  if (!previous && !next) return null;

  return (
    <div className={cn("grid gap-3 pt-2", previous && next ? "grid-cols-2" : "grid-cols-1")}>
      {previous && (
        <Link
          href={`/dashboard/articles/view?articleSlug=${previous.slug}`}
          className="group flex items-center gap-3 p-4 rounded-panel bg-surface border border-border-subtle hover:border-accent-primary/30 hover:bg-elevated/40 transition-all"
        >
          <ArrowLeft className="w-4 h-4 text-text-muted group-hover:-translate-x-0.5 group-hover:text-accent-primary transition-all shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Previous</div>
            <div className="text-xs font-bold text-primary truncate">{previous.title}</div>
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={`/dashboard/articles/view?articleSlug=${next.slug}`}
          className="group flex items-center gap-3 p-4 rounded-panel bg-accent-primary/[0.06] border border-accent-primary/25 hover:border-accent-primary/50 hover:bg-accent-primary/10 transition-all text-right justify-end"
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-accent-primary">Keep Reading</div>
            <div className="text-xs font-bold text-primary truncate">{next.title}</div>
          </div>
          <TopicIcon name={next.icon} className="w-4 h-4 text-accent-primary shrink-0" />
          <ArrowRight className="w-4 h-4 text-accent-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      )}
    </div>
  );
}
