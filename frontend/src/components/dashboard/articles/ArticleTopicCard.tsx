"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOPIC_GRADIENTS, TOPIC_COLORS, type ArticleTopicSummary, type TopicColor } from "@/types/article";
import { TopicIcon } from "./topicIcons";

export function ArticleTopicCard({ topic }: { topic: ArticleTopicSummary }) {
  const color: TopicColor = topic.color ?? "indigo";
  const total = topic.published_articles_count ?? 0;
  const read = topic.read_count ?? 0;
  const progressPct = total > 0 ? Math.round((read / total) * 100) : 0;

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={`/dashboard/articles/topic/${topic.slug}`}
        className="group block h-full rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-card transition-all p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className={cn("w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br", TOPIC_GRADIENTS[color], TOPIC_COLORS[color])}>
            <TopicIcon name={topic.icon} className="w-5 h-5" />
          </div>
          {total > 0 && read >= total && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-status-success">
              <BookOpenCheck className="w-3.5 h-3.5" />
              Complete
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors">{topic.name}</h3>
          {topic.description && <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{topic.description}</p>}
        </div>

        <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
          <span>
            {total} article{total === 1 ? "" : "s"}
            {topic.total_reading_minutes ? <> · {topic.total_reading_minutes} min</> : null}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {total > 0 && (
          <div className="h-1 rounded-full bg-elevated overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", read > 0 ? "bg-accent-primary" : "bg-transparent")}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
