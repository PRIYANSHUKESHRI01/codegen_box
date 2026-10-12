"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Card-shaped placeholder: same cover ratio, same rows, same footer — so nothing moves when the data lands. */
export function LobbyCardSkeleton() {
  return (
    <div className="lb-skel-card" aria-hidden>
      <div className="ar-skeleton aspect-[16/9] !rounded-none" />
      <div className="p-5 pt-6">
        <div className="ar-skeleton h-[18px] w-3/4" />
        <div className="ar-skeleton mt-3 h-3.5 w-full" />
        <div className="ar-skeleton mt-2 h-3.5 w-2/3" />
        <div className="ar-skeleton mt-5 h-3.5 w-1/2" />
        <div className="ar-skeleton mt-2.5 h-3.5 w-2/5" />
        <div className="ar-skeleton mt-5 h-1.5 w-full !rounded-full" />
        <div className="mt-5 flex gap-1.5">
          <div className="ar-skeleton h-6 w-14 !rounded-full" />
          <div className="ar-skeleton h-6 w-20 !rounded-full" />
          <div className="ar-skeleton h-6 w-16 !rounded-full" />
        </div>
        <div className="ar-skeleton mt-5 h-10 w-full !rounded-[14px]" />
      </div>
    </div>
  );
}

/** Reserves the featured hero's footprint while the home payload loads. */
export function HeroSkeleton() {
  return (
    <div className="lb-skel-card !rounded-[28px] p-6 sm:p-9 lg:min-h-[437px] lg:px-12 lg:py-9" aria-hidden>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-14">
        <div>
          <div className="flex gap-3">
            <div className="ar-skeleton h-7 w-24 !rounded-full" />
            <div className="ar-skeleton h-7 w-28 !rounded-full" />
          </div>
          <div className="ar-skeleton mt-5 h-12 w-4/5" />
          <div className="ar-skeleton mt-5 h-4 w-3/5" />
          <div className="ar-skeleton mt-2.5 h-4 w-2/5" />
          <div className="ar-skeleton mt-6 h-4 w-1/2" />
          <div className="mt-6 flex gap-3">
            <div className="ar-skeleton h-12 w-44 !rounded-[14px]" />
            <div className="ar-skeleton h-12 w-40 !rounded-[14px]" />
          </div>
        </div>
        <div className="ar-skeleton h-[330px] w-full !rounded-[22px]" />
      </div>
    </div>
  );
}

/** An empty result: a quiet radar ping around an icon, one line of explanation, and the way out. */
export function LobbyEmpty({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ar-raised flex flex-col items-center rounded-[24px] px-6 py-16 text-center">
      <div className="relative mb-7 h-24 w-24" aria-hidden>
        <span className="lb-ring" />
        <span className="lb-ring" style={{ animationDelay: "1.06s" }} />
        <span className="lb-ring" style={{ animationDelay: "2.12s" }} />
        <span className="absolute inset-[22px] inline-flex items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--ar-a)/0.35)] to-[rgb(var(--ar-b)/0.22)] ring-1 ring-white/20 shadow-[0_0_30px_-6px_rgb(var(--ar-a)/0.6)]">
          <Icon className="h-6 w-6 text-white" />
        </span>
      </div>
      <h3 className="ar-h2 text-white">{title}</h3>
      {children && <div className="ar-body mt-2 max-w-md">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
