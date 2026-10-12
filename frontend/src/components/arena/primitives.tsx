"use client";

/* eslint-disable @next/next/no-img-element -- static export: next/image's optimiser is unavailable, and covers/avatars are plain files */

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, Clock, Flag, Gavel, Hourglass, Medal as MedalIcon, Radio, Rocket, Ban, FileEdit, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { MEDALS, PHASE_META, accentVars, initialsOf, timeLeft, useNow, type PhaseTone } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonAccent, HackathonHost, HackathonPhase } from "@/types/hackathon";

/* ── Avatar ───────────────────────────────────────────────────────────────── */

const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-rose-500",
  "from-cyan-400 to-blue-500",
  "from-pink-500 to-orange-400",
];

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** A person: their photo, or a coloured set of initials that is the same colour every time. */
export function ArenaAvatar({ name, url, size = 36, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };

  if (url && !failed) {
    return <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} style={box} className={cn("shrink-0 rounded-full object-cover ring-2 ring-white/15", className)} />;
  }

  return (
    <span
      aria-hidden
      style={box}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-extrabold text-white ring-2 ring-white/15", AVATAR_GRADIENTS[hashOf(name) % AVATAR_GRADIENTS.length], className)}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Overlapping avatars for a team. */
export function AvatarStack({ people, max = 4, size = 28 }: { people: { name: string; avatar_url: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className={i === 0 ? "" : "-ml-2"} title={p.name}>
          <ArenaAvatar name={p.name} url={p.avatar_url} size={size} className="!ring-[#0b0d18]" />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ width: size, height: size, fontSize: 11 }} className="-ml-2 inline-flex items-center justify-center rounded-full bg-white/10 font-bold text-white ring-2 ring-[#0b0d18]">
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ── Phase badge ──────────────────────────────────────────────────────────── */

const PHASE_ICON: Record<HackathonPhase, LucideIcon> = {
  draft: FileEdit,
  cancelled: Ban,
  upcoming: Clock,
  registration_open: Rocket,
  starting_soon: Hourglass,
  live: Radio,
  judging: Gavel,
  completed: Flag,
};

export function PhaseBadge({ phase, className }: { phase: HackathonPhase; className?: string }) {
  const meta = PHASE_META[phase];
  const Icon = PHASE_ICON[phase];

  return (
    <span className={cn("ar-chip ar-phase", className)} data-tone={meta.tone} title={meta.hint}>
      {meta.tone === "live" ? <span className="ar-dot" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />}
      {meta.label}
    </span>
  );
}

export function toneOf(phase: HackathonPhase): PhaseTone {
  return PHASE_META[phase].tone;
}

/* ── Cover art ────────────────────────────────────────────────────────────── */

/**
 * A hackathon's picture. When it has none — or the file fails to load — a generated cover in the
 * hackathon's own colours stands in, so a card is never a grey box.
 */
export function CoverArt({ src, accent, title, className, eager = false }: { src: string | null; accent: HackathonAccent; title: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-[#0b0d18]", className)} style={accentVars(accent)}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgb(var(--ar-a) / 0.85), rgb(var(--ar-b) / 0.7))" }}>
          <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border border-white/25" />
          <div className="absolute -right-2 -top-8 h-44 w-44 rounded-full border border-white/20" />
          <div className="absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-black/20 blur-2xl" />
          <span className="absolute bottom-3 left-5 select-none text-6xl font-black tracking-tighter text-white/25">{initialsOf(title)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Countdown ────────────────────────────────────────────────────────────── */

export function Countdown({ target, size = "md", className }: { target: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const now = useNow(1000);
  const left = timeLeft(target, now || Date.now());

  const units: [string, number][] = [
    ["Days", left.days],
    ["Hrs", left.hours],
    ["Min", left.minutes],
    ["Sec", left.seconds],
  ];

  const dims = {
    sm: { tile: "min-w-[44px] px-2 py-1.5 rounded-xl", num: "text-lg", lab: "text-[9px]" },
    md: { tile: "min-w-[58px] px-2.5 py-2 rounded-2xl", num: "text-2xl", lab: "text-[10px]" },
    lg: { tile: "min-w-[72px] px-3 py-3 rounded-2xl sm:min-w-[84px]", num: "text-3xl sm:text-4xl", lab: "text-[10px]" },
  }[size];

  // The visual digits tick every second; screen readers get a calm, minute-level summary instead.
  const spoken = `${left.days} days, ${left.hours} hours and ${left.minutes} minutes`;

  return (
    <div role="timer" aria-label={spoken} className={cn("flex items-stretch gap-2", className)}>
      {units.map(([label, value]) => (
        <div key={label} aria-hidden className={cn("flex flex-col items-center border border-white/[0.12] bg-white/[0.06] text-center backdrop-blur", dims.tile)}>
          <span className={cn("font-extrabold tabular-nums leading-none text-white", dims.num)}>{String(value).padStart(2, "0")}</span>
          <span className={cn("mt-1.5 font-bold uppercase tracking-[0.14em] text-[color:var(--ar-text-3)]", dims.lab)}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** "1d 18h" / "5h 12m" / "9m" — a small inline countdown for cards. */
export function CompactTimeLeft({ target }: { target: string }) {
  const now = useNow(30_000);
  const t = timeLeft(target, now || Date.now());

  if (t.total <= 0) return <>now</>;
  if (t.days > 0) return <>{t.days}d {t.hours}h</>;
  if (t.hours > 0) return <>{t.hours}h {t.minutes}m</>;
  return <>{Math.max(1, t.minutes)}m</>;
}

/* ── Host ─────────────────────────────────────────────────────────────────── */

/** Who is running the hackathon: the AptRun mark, or a hiring partner's logo (an emoji, an image, or a monogram). */
export function HostMark({ host, size = 28 }: { host: HackathonHost; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, fontSize: Math.round(size * 0.55) };

  if (host.type === "platform") {
    return (
      <span style={box} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
        <LogoMark className="h-[70%] w-[70%]" />
      </span>
    );
  }

  const isUrl = !!host.logo && /^(https?:)?\/\//.test(host.logo);

  if (host.logo && isUrl && !failed) {
    return <img src={host.logo} alt="" width={size} height={size} onError={() => setFailed(true)} style={box} className="shrink-0 rounded-lg bg-white object-cover ring-1 ring-white/20" />;
  }

  if (host.logo && !isUrl) {
    return (
      <span aria-hidden style={box} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white/90 leading-none ring-1 ring-white/20">
        {host.logo}
      </span>
    );
  }

  return (
    <span aria-hidden style={{ ...box, fontSize: Math.round(size * 0.4) }} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-indigo-500 font-black text-white ring-1 ring-white/20">
      {initialsOf(host.name)}
    </span>
  );
}

/* ── Medals ───────────────────────────────────────────────────────────────── */

export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const medal = MEDALS[rank];

  if (!medal) {
    return (
      <span className={cn("inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-white/10 px-2 text-xs font-extrabold tabular-nums text-white ring-1 ring-white/15", className)}>
        #{rank}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-gradient-to-br px-2 text-xs font-extrabold text-slate-900 ring-2", medal.fill, medal.ring, className)} title={`${medal.label} place`}>
      <MedalIcon className="mr-1 h-3.5 w-3.5" aria-hidden />
      {rank}
    </span>
  );
}

/* ── Layout bits ──────────────────────────────────────────────────────────── */

export function SectionHeader({ eyebrow, title, description, action, id }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="ar-eyebrow mb-2">{eyebrow}</p>}
        <h2 id={id} className="text-xl font-extrabold tracking-[-0.02em] text-white sm:text-2xl">
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[color:var(--ar-text-2)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ar-glass flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgb(var(--ar-a)/0.25)] to-[rgb(var(--ar-b)/0.2)] ring-1 ring-white/15">
        <Icon className="h-7 w-7 text-white" aria-hidden />
      </span>
      <h3 className="text-lg font-extrabold text-white">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm leading-relaxed text-[color:var(--ar-text-2)]">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function StatTile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="ar-glass flex items-center gap-3.5 px-4 py-3.5">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--ar-a)/0.3)] to-[rgb(var(--ar-b)/0.2)] ring-1 ring-white/15">
        <Icon className="h-5 w-5 text-white" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold tabular-nums leading-none text-white">{value}</p>
        <p className="mt-1.5 truncate text-xs font-semibold text-[color:var(--ar-text-3)]" title={hint}>
          {label}
        </p>
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("ar-glass overflow-hidden", className)} aria-hidden>
      <div className="ar-skeleton aspect-[16/9] !rounded-none" />
      <div className="space-y-3 p-5">
        <div className="ar-skeleton h-5 w-3/4" />
        <div className="ar-skeleton h-4 w-full" />
        <div className="ar-skeleton h-4 w-2/3" />
        <div className="ar-skeleton mt-5 h-10 w-full" />
      </div>
    </div>
  );
}

export function PageNotice({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : Flag;
  const styles = {
    error: "border-rose-400/35 bg-rose-500/10 text-rose-100",
    success: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
    info: "border-sky-400/35 bg-sky-500/10 text-sky-100",
  }[tone];

  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium", styles)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Markdown ─────────────────────────────────────────────────────────────── */

/**
 * Host-written Markdown, rendered safely: raw HTML is never interpreted (react-markdown's default),
 * unsafe link protocols are dropped, links open in a new tab, and images are not loaded — a
 * hackathon page written by a partner should not be able to phone home from a student's browser.
 */
export function ArenaMarkdown({ children }: { children: string }) {
  return (
    <div className="ar-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        unwrapDisallowed
        components={{
          a: ({ href, children: kids }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {kids}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
