import type { ReactNode } from "react";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

interface SectionIntroProps {
  eyebrow: string;
  title: ReactNode;
  /** The part of the title drawn in the gradient. */
  highlight?: string;
  description?: ReactNode;
  id?: string;
  align?: "center" | "left";
  className?: string;
}

/** The head of a content section: a small label, one headline (the last words in the gradient) and one sentence under it. Rises in once. */
export function SectionIntro({ eyebrow, title, highlight, description, id, align = "center", className }: SectionIntroProps) {
  return (
    <Reveal className={cn("mb-10 max-w-3xl sm:mb-14", align === "center" ? "mx-auto text-center" : "text-left", className)}>
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary">
        {eyebrow}
      </span>
      <h2 id={id} className="text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.6rem]">
        {title}
        {highlight && (
          <>
            {" "}
            <span className="bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary bg-clip-text text-transparent">{highlight}</span>
          </>
        )}
      </h2>
      {description && (
        <p className={cn("mt-4 max-w-2xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]", align === "center" && "mx-auto")}>{description}</p>
      )}
    </Reveal>
  );
}
