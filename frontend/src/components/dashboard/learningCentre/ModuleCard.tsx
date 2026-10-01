"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_GRADIENTS, MODULE_COLORS, type ModuleColor } from "@/types/learningCentre";

interface ModuleCardProps {
  href: string;
  icon: LucideIcon;
  color: ModuleColor;
  title: string;
  description: string;
  /** e.g. "12 passages" or "Best score 82%" — footer meta text, left side. */
  meta: string;
  /** 0-100, omitted entirely when there's nothing to show yet (a brand-new student). */
  progressPct?: number;
  badge?: string;
}

/** The generalized ArticleTopicCard for the Learning Centre's four module tiles — same shell, gradient icon tile, and progress-bar language so nothing looks foreign next to Reading Hub. */
export function ModuleCard({ href, icon: Icon, color, title, description, meta, progressPct, badge }: ModuleCardProps) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={href}
        className="group block h-full rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-card transition-all p-5 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className={cn("w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br", MODULE_GRADIENTS[color], MODULE_COLORS[color])}>
            <Icon className="w-5 h-5" />
          </div>
          {badge && (
            <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide border", MODULE_COLORS[color])}>
              {badge}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors">{title}</h3>
          <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{description}</p>
        </div>

        <div className="flex items-center justify-between text-2xs text-text-muted pt-1">
          <span>{meta}</span>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {progressPct !== undefined && (
          <div className="h-1 rounded-full bg-elevated overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500", progressPct > 0 ? "bg-accent-primary" : "bg-transparent")}
              style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
            />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
