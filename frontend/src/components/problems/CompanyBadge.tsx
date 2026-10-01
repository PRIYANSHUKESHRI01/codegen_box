import { COMPANY_ICONS } from "@/components/icons/CompanyIcons";
import { cn } from "@/lib/utils";

interface CompanyBadgeProps {
  company: string;
  size?: "xs" | "sm";
  className?: string;
}

const sizeClasses: Record<NonNullable<CompanyBadgeProps["size"]>, string> = {
  xs: "px-1.5 py-0.5 text-3xs gap-1",
  sm: "px-2 py-1 text-2xs gap-1.5",
};

const iconSizeClasses: Record<NonNullable<CompanyBadgeProps["size"]>, string> = {
  xs: "w-2.5 h-2.5",
  sm: "w-3.5 h-3.5",
};

/**
 * "Asked at {company}" badge — visually a sibling of the topic-tag pill
 * (same rounded/border/fill language) but bumped to font-semibold +
 * text-secondary so it reads as a distinct, slightly higher-signal category
 * rather than blending into topic tags like "Array" or "Dynamic Programming".
 */
export function CompanyBadge({ company, size = "xs", className }: CompanyBadgeProps) {
  const Icon = COMPANY_ICONS[company];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-elevated border border-border-subtle font-semibold text-text-secondary whitespace-nowrap",
        sizeClasses[size],
        className
      )}
    >
      {Icon && <Icon className={cn(iconSizeClasses[size], "shrink-0")} />}
      {company}
    </span>
  );
}

export function CompanyBadgeList({
  companies,
  size = "xs",
  className,
}: {
  companies: string[] | null | undefined;
  size?: "xs" | "sm";
  className?: string;
}) {
  if (!companies || companies.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {companies.map((company) => (
        <CompanyBadge key={company} company={company} size={size} />
      ))}
    </div>
  );
}
