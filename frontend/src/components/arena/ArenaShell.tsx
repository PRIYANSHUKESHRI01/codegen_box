"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Compass, DoorOpen, Eye, Rocket, TriangleAlert, Trophy } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { ArenaAvatar } from "@/components/arena/primitives";
import { homeRouteForRole, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import "@/app/arena/arena.css";
import "@/app/arena/lobby.css";

/* ── Unsaved-work guard ────────────────────────────────────────────────────
 * A page with an unsaved project registers itself dirty; the Exit button then
 * asks before leaving, and closing the tab triggers the browser's own prompt.
 */
interface GuardContext {
  setDirty: (dirty: boolean) => void;
}

const ArenaGuard = createContext<GuardContext>({ setDirty: () => {} });

/** Call with `true` while the page holds changes that have not been saved. */
export function useArenaDirty(dirty: boolean) {
  const { setDirty } = useContext(ArenaGuard);

  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
}

export type ArenaSection = "discover" | "mine";

const NAV: { key: ArenaSection; href: string; label: string; icon: typeof Compass }[] = [
  { key: "discover", href: "/arena", label: "Discover", icon: Compass },
  { key: "mine", href: "/arena/my", label: "My hackathons", icon: Trophy },
];

interface ArenaShellProps {
  user: AuthUser;
  /** Which top-bar tab to light up; omit on pages that sit under no tab. */
  section?: ArenaSection;
  /** Re-tints the whole page (--ar-a/--ar-b) — a hackathon's detail page uses its own accent. */
  accentStyle?: CSSProperties;
  children: ReactNode;
}

export function ArenaShell({ user, section, accentStyle, children }: ArenaShellProps) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isStudent = user.role === "user";
  const dashboard = homeRouteForRole(user.role);
  const nav = NAV.filter((n) => isStudent || n.key === "discover");

  // Closing or reloading the tab with an unsaved project: let the browser ask.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The top bar's bottom border only appears once the page has actually scrolled under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const exit = useCallback(() => {
    if (dirty) setConfirming(true);
    else router.push(dashboard);
  }, [dirty, router, dashboard]);

  const guard = useMemo<GuardContext>(() => ({ setDirty }), []);

  return (
    <ArenaGuard.Provider value={guard}>
      <div className="arena-root" style={accentStyle}>
        <div className="ar-aurora" aria-hidden />

        <a
          href="#arena-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
        >
          Skip to content
        </a>

        <header className="lb-topbar" data-scrolled={scrolled}>
          <div className="mx-auto flex h-full w-full max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/arena" className="group flex shrink-0 items-center gap-2.5 rounded-xl" aria-label="Hack Arena home">
              <LogoMark className="h-8 w-8 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
              <span className="flex flex-col leading-none">
                <span className="text-[16.5px] font-bold tracking-[-0.02em] text-white">
                  Hack <span className="ar-grad-text">Arena</span>
                </span>
                <span className="mt-[5px] hidden text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--ar-text-3)] min-[420px]:block">by AptRun</span>
              </span>
            </Link>

            <ArenaNav items={nav} section={section} className="ml-3 hidden md:flex" />

            <div className="flex-1" />

            {isStudent ? (
              <div className="hidden items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] p-1 transition-colors hover:bg-white/[0.07] md:flex lg:pr-4" title={`${user.name} · ${user.email}`}>
                <ArenaAvatar name={user.name} url={user.avatar_url} size={32} />
                <div className="hidden min-w-0 leading-tight lg:block">
                  <p className="max-w-[150px] truncate text-[13px] font-semibold text-white">{user.name}</p>
                  <p className="max-w-[150px] truncate text-[11px] font-medium text-[color:var(--ar-text-3)]">
                    {user.handle ? `@${user.handle}` : "Student"}
                    {user.college?.short_code ? ` · ${user.college.short_code}` : ""}
                  </p>
                </div>
              </div>
            ) : (
              <span className="ar-chip hidden sm:inline-flex" style={{ color: "#fde9a8", borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.1)" }}>
                <Eye className="h-3.5 w-3.5" aria-hidden /> Host preview
              </span>
            )}

            <button type="button" onClick={exit} className="ar-btn ar-btn-ghost ar-btn-sm group shrink-0" title="Leave the Hack Arena and return to your dashboard">
              <DoorOpen className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden />
              <span>Exit Arena</span>
            </button>
          </div>
        </header>

        {!isStudent && (
          <div className="border-b border-amber-300/20 bg-amber-300/[0.07] px-4 py-2 text-center text-[13px] font-medium text-amber-100">
            You&apos;re viewing the arena as a host — this is what students see. Registering and submitting are for students only.
          </div>
        )}

        <main id="arena-main" className={cn("mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8", isStudent ? "pb-28 md:pb-24" : "pb-24")}>
          {children}
        </main>

        <footer className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8", isStudent && "max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]")}>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] py-8 text-[13px] text-[color:var(--ar-text-3)] sm:flex-row">
            <p className="flex items-center gap-2">
              <Rocket className="h-4 w-4" aria-hidden /> Hack Arena · Build. Ship. Get hired.
            </p>
            <button type="button" onClick={exit} className="font-semibold text-[color:var(--ar-text-2)] underline-offset-4 transition-colors hover:text-white hover:underline">
              Back to my dashboard
            </button>
          </div>
        </footer>

        {/* Phones: the two sections live in a thumb-reach tab bar, the top bar keeps just the logo and Exit. */}
        {isStudent && <ArenaTabBar items={nav} section={section} />}

        <LeaveConfirm
          open={confirming}
          onStay={() => setConfirming(false)}
          onLeave={() => {
            setConfirming(false);
            setDirty(false);
            router.push(dashboard);
          }}
        />
      </div>
    </ArenaGuard.Provider>
  );
}

/* ── Navigation ────────────────────────────────────────────────────────────
 * Two destinations, so a pill group in the top bar. They are real links (aria-current) rather than a
 * tablist — the pages are separate routes, not panels — but they share SlidingTabs' look, and the hover
 * highlight glides between them the same way the active indicator does there.
 */
function ArenaNav({ items, section, className }: { items: typeof NAV; section?: ArenaSection; className?: string }) {
  const [hover, setHover] = useState<ArenaSection | null>(null);
  const reduced = useReducedMotion();

  return (
    <nav aria-label="Hack Arena" className={cn("items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] p-1", className)} onMouseLeave={() => setHover(null)}>
      {items.map((item) => {
        const active = section === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onMouseEnter={() => setHover(item.key)}
            onFocus={() => setHover(item.key)}
            onBlur={() => setHover(null)}
            className={cn("relative flex h-8 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors", active ? "text-white" : "text-[color:var(--ar-text-3)] hover:text-white")}
          >
            {active && <span aria-hidden className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_18px_-8px_rgb(var(--ar-a)/0.8)] ring-1 ring-white/[0.14]" />}
            {hover === item.key && !active && (
              <motion.span
                layoutId="lb-nav-hover"
                aria-hidden
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                className="absolute inset-0 rounded-full bg-white/[0.07]"
              />
            )}
            <span className="relative flex items-center gap-2">
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function ArenaTabBar({ items, section }: { items: typeof NAV; section?: ArenaSection }) {
  return (
    <nav aria-label="Hack Arena sections" className="lb-bottombar md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch px-3">
        {items.map((item) => {
          const active = section === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11.5px] font-semibold transition-[color,transform] active:scale-95", active ? "text-white" : "text-[color:var(--ar-text-3)]")}
            >
              {active && <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))] shadow-[0_0_14px_rgb(var(--ar-a)/0.9)]" />}
              <item.icon className={cn("h-[22px] w-[22px] transition-transform", active && "-translate-y-px scale-105")} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function LeaveConfirm({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onStay();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onStay]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onStay()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            aria-describedby="leave-body"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="ar-float w-full max-w-md rounded-[22px] p-6"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30">
              <TriangleAlert className="h-5 w-5" aria-hidden />
            </span>
            <h2 id="leave-title" className="ar-h2 text-white">
              Leave Hack Arena?
            </h2>
            <p id="leave-body" className="ar-body mt-2">
              You have project changes you haven&apos;t saved. If you leave now, they&apos;ll be lost.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onLeave} className="ar-btn ar-btn-ghost">
                Leave anyway
              </button>
              <button type="button" ref={stayRef} onClick={onStay} className="ar-btn ar-btn-primary">
                Stay and save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
