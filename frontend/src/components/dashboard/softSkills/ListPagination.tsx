"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PER_PAGE, pageNumbersWithEllipsis, type PerPage } from "@/lib/softSkillSets";
import type { ListMeta } from "@/types/softSkill";

interface ListPaginationProps {
  meta: ListMeta;
  /** What the rows are called, for the "Showing 1–20 of 45 sets" line. */
  noun?: string;
  onPage: (page: number) => void;
  onPerPage: (perPage: PerPage) => void;
  /** Dims the controls while the next page is on its way, so a double-click cannot queue two requests. */
  busy?: boolean;
  className?: string;
}

/**
 * Footer for the paged soft-skills lists: "Showing 21–40 of 45 sets", page numbers, and a
 * "20 per page / Show all" switch. Renders nothing when everything fits on one page, so a short
 * list is not cluttered with controls that would do nothing.
 */
export function ListPagination({ meta, noun = "items", onPage, onPerPage, busy = false, className }: ListPaginationProps) {
  if (meta.total <= DEFAULT_PER_PAGE) return null;

  const btn =
    "rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary";

  return (
    <nav
      aria-label={`${noun} pages`}
      aria-busy={busy}
      className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", busy && "pointer-events-none opacity-70", className)}
    >
      <p className="text-2xs text-text-muted" aria-live="polite">
        {meta.all ? (
          <>
            Showing all <span className="tabular font-semibold text-text-secondary">{meta.total}</span> {noun}
          </>
        ) : (
          <>
            Showing{" "}
            <span className="tabular font-semibold text-text-secondary">
              {meta.from}–{meta.to}
            </span>{" "}
            of <span className="tabular font-semibold text-text-secondary">{meta.total}</span> {noun}
          </>
        )}
      </p>

      {!meta.all && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, "flex items-center gap-1")} onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Previous
          </button>
          {pageNumbersWithEllipsis(meta.page, meta.last_page).map((p, i) =>
            p === "ellipsis" ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-text-muted" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === meta.page ? "page" : undefined}
                className={cn(
                  "tabular h-7 w-7 rounded-control border text-2xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                  p === meta.page ? "border-transparent bg-accent-primary text-white" : "border-border-subtle bg-elevated text-text-secondary hover:bg-surface-hover"
                )}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className={cn(btn, "flex items-center gap-1")} onClick={() => onPage(meta.page + 1)} disabled={meta.page >= meta.last_page} aria-label="Next page">
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      <div role="group" aria-label="Rows per page" className="inline-flex items-center gap-0.5 rounded-control border border-border-subtle bg-elevated p-0.5">
        {([DEFAULT_PER_PAGE, "all"] as PerPage[]).map((option) => {
          const active = option === "all" ? meta.all : !meta.all;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => !active && onPerPage(option)}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-2xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                active ? "bg-surface text-primary shadow-subtle" : "text-text-muted hover:text-primary"
              )}
            >
              {option === "all" ? "Show all" : `${option} per page`}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
