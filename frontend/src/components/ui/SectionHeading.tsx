import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./Badge";

export interface SectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  badge?: string;
  title: string;
  highlight?: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeading({
  badge,
  title,
  highlight,
  description,
  align = "center",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl mb-10 sm:mb-14",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
      {...props}
    >
      {badge && (
        <div className="mb-4">
          <Badge variant="primary" size="md">
            {badge}
          </Badge>
        </div>
      )}
      {/* 28 -> 40px, bold, tight tracking. Section titles are one short
          line of benefit copy; the old 48px/bold stack out-shouted the
          product visuals beneath it. */}
      <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl lg:text-[2.5rem] font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
        {title}{" "}
        {highlight && (
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary">
            {highlight}
          </span>
        )}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 max-w-2xl text-base sm:text-[1.0625rem] font-medium text-text-secondary leading-relaxed text-balance",
            align === "center" && "mx-auto"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
