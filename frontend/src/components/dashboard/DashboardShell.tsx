"use client";

import { Suspense, useState } from "react";
import { DashboardSidebar, DashboardRole } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  role: DashboardRole;
  currentTpoView?: "mellow" | "tpo";
  onSwitchTpoView?: (view: "mellow" | "tpo") => void;
  title: string;
  subtitle?: string;
  actionButton?: {
    label: string;
    icon?: any;
    onClick?: () => void;
  };
  /**
   * Opts a page out of the standard padded/max-width content column and the
   * page heading — for an immersive, edge-to-edge workspace (e.g. the
   * problem solve screen) that manages its own height and internal scroll
   * instead of scrolling the whole page. The topbar and sidebar stay for
   * navigation; only the content area changes shape.
   */
  fullBleed?: boolean;
  /**
   * Starts the sidebar collapsed on mount — for workspace-like pages (e.g.
   * the problem solve screen) where the extra width matters more than on a
   * typical dashboard page. The user can still expand it manually; this
   * only changes the initial state.
   */
  defaultSidebarCollapsed?: boolean;
  /**
   * Unmounts (not just visually hides) DashboardSidebar and DashboardHeader
   * so `children` fills the entire viewport — for a true fullscreen "exam
   * mode" during an active proctored contest attempt. This MUST be a real
   * unmount rather than a CSS hide: DashboardHeader owns a global Cmd/Ctrl+K
   * command-palette listener that can navigate away via router.push(), which
   * doesn't fire fullscreenchange/blur/visibilitychange — a CSS-hidden (but
   * still mounted) header would leave that escape hatch live underneath the
   * proctoring overlay.
   */
  hideChrome?: boolean;
}

export function DashboardShell({
  children,
  role,
  currentTpoView = "mellow",
  onSwitchTpoView,
  title,
  subtitle,
  actionButton,
  fullBleed = false,
  defaultSidebarCollapsed = false,
  hideChrome = false,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultSidebarCollapsed);
  // Hiring partners and college TPOs get the premium surface system (aurora
  // canvas, wider column, richer page heading — see .hp-canvas in
  // globals.css), each with its own identity colour via data-portal. Every
  // other role renders exactly as before.
  const portal: "hiring" | "tpo" | null =
    role === "admin_company" ? "hiring" : role === "admin_tpo" && currentTpoView === "tpo" ? "tpo" : null;
  const isHiring = portal !== null;

  return (
    // The exam-mode workspace (fullBleed + hideChrome) promises "no outer
    // page scroll — main manages its own bounded height and internal panel
    // scrolling," but min-h-screen only sets a LOWER bound — it doesn't cap
    // this container at the viewport, so flex-1 children can still grow
    // taller than 100vh and force the whole document to scroll, which is
    // exactly what let the header bar get scrolled out of view and made the
    // Monaco editor swallow wheel events instead of the (nonexistent, but
    // browser-attempted) page scroll doing anything. h-screen + overflow-
    // hidden makes the 100vh boundary a hard ceiling instead. Scoped to
    // hideChrome specifically (not all fullBleed pages) — the simpler
    // centered-card consent/locked screens on this same route should keep
    // their natural scroll-into-view safety net if their content ever runs
    // taller than a short viewport.
    <div
      data-portal={portal ?? undefined}
      className={cn("bg-background text-primary flex", isHiring && "hp-portal", hideChrome ? "h-screen overflow-hidden" : "min-h-screen")}
    >
      {/* Production Sidebar — Suspense-wrapped because it reads
          useSearchParams() (for ?tab=/?status=-based active-link
          highlighting), which static export requires to be wrapped or the
          build fails. The fallback is only ever visible for a frame during
          initial hydration in the real browser. */}
      {!hideChrome && (
        <Suspense fallback={<div className={cn("hidden md:block flex-shrink-0", collapsed ? "md:w-rail-collapsed" : "md:w-rail")} />}>
          <DashboardSidebar
            currentRole={role}
            currentTpoView={currentTpoView}
            onSwitchTpoView={onSwitchTpoView}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
          />
        </Suspense>
      )}

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[padding] duration-300",
          isHiring && "hp-canvas",
          hideChrome && "min-h-0",
          // rail / rail-collapsed are the SAME tokens the panel itself is
          // sized from (RAIL_WIDTH / RAIL_COLLAPSED_WIDTH in
          // DashboardSidebar). These were hard-coded as pl-64 (256px) against
          // a 280px panel, so the fixed-position rail overlapped the first
          // 24px of the content column on every dashboard page.
          hideChrome ? "" : collapsed ? "md:pl-rail-collapsed" : "md:pl-rail"
        )}
      >
        {/* Sticky Dashboard Topbar Header */}
        {!hideChrome && (
          <DashboardHeader
            title={title}
            subtitle={subtitle}
            role={role}
            currentTpoView={currentTpoView}
            onOpenMobile={() => setMobileOpen(true)}
            actionButton={actionButton}
          />
        )}

        {/* Inner View Content */}
        <main
          className={cn(
            fullBleed
              ? "flex-1 min-h-0 flex flex-col overflow-hidden"
              : isHiring
              ? "relative z-[1] flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto space-y-8"
              : "flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8"
          )}
        >
          {/* Page heading — the compact topbar keeps the portal name, this
              carries the per-page title and context. Skipped in fullBleed
              mode, where the page builds its own compact header instead. */}
          {!fullBleed && isHiring && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-2"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/[0.07] px-2.5 py-1 text-3xs font-bold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="hp-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--hp-id))]" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--hp-id))]" />
                </span>
                {portal === "tpo" ? "Placement Hub" : "Hiring Hub"}
              </span>
              <h1 className="text-2xl sm:text-[32px] sm:leading-[38px] font-extrabold text-primary tracking-[-0.025em]">{title}</h1>
              {subtitle && (
                <p className="text-sm sm:text-[15px] text-text-secondary leading-relaxed max-w-3xl">{subtitle}</p>
              )}
            </motion.div>
          )}
          {!fullBleed && !isHiring && (
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">{subtitle}</p>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
