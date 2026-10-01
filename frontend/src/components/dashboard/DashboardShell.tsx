"use client";

import { Suspense, useState } from "react";
import { DashboardSidebar, DashboardRole } from "./DashboardSidebar";
import { DashboardHeader } from "./DashboardHeader";
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
    <div className={cn("bg-background text-primary flex", hideChrome ? "h-screen overflow-hidden" : "min-h-screen")}>
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
              : "flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8"
          )}
        >
          {/* Page heading — the compact topbar keeps the portal name, this
              carries the per-page title and context. Skipped in fullBleed
              mode, where the page builds its own compact header instead. */}
          {!fullBleed && (
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
