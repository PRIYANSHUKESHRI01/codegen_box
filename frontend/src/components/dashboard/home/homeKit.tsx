"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { hpBtn } from "@/components/portal/kit";

/**
 * The one link that sits at the right of a section heading and leads to the full version of it ("All drives", "Open report").
 * A ghost button from the portal kit, with its arrow nudging forward on hover.
 */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={hpBtn("ghost", "sm", "group -mr-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200")}>
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
