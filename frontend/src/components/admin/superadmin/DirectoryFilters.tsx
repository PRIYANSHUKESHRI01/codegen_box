"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { DirectoryFacets } from "./types";

/** Roles that never belong to a university — picking one while a university is chosen would only ever show an empty list. */
export const ROLES_WITHOUT_UNIVERSITY = ["admin_company", "admin_internal,admin_marketing", "admin_internal", "admin_marketing", "superadmin"];

/** The value the university filter uses for "accounts that belong to no university". */
export const NO_UNIVERSITY = "none";

/**
 * Counts for the filter bar: accounts per role under the chosen university (and search), and accounts per
 * university under the chosen role (and search). One small request; the previous answer stays on screen while
 * the next loads so the chips don't flicker, and a slow answer to an old filter never overwrites a newer one.
 */
export function useDirectoryFacets({
  role,
  collegeId,
  search,
  department = "",
  hasCollege,
  plan = "",
  refreshKey = 0,
}: {
  role: string;
  collegeId: string;
  search: string;
  /** Narrows the university counts to one department's students — pass whatever the list itself is filtered by. */
  department?: string;
  /** Mirrors the list's `has_college` so the department counts cover the same students the list does. */
  hasCollege?: boolean;
  /** A student plan filter: narrows the students, the university counts and the "All" total to those on it. */
  plan?: string;
  /** Bump to re-read the counts after the list itself changed (an account was created or removed). */
  refreshKey?: number;
}): DirectoryFacets | null {
  const [facets, setFacets] = useState<DirectoryFacets | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    const params = new URLSearchParams();
    if (role.includes(",")) params.set("roles", role);
    else if (role) params.set("role", role);
    if (collegeId) params.set("college_id", collegeId);
    if (search) params.set("search", search);
    if (department) params.set("department", department);
    if (hasCollege !== undefined) params.set("has_college", hasCollege ? "1" : "0");
    if (plan) params.set("plan", plan);

    api
      .get<DirectoryFacets>(`/superadmin/users/facets?${params.toString()}`)
      .then((res) => {
        if (ticket !== latest.current || !res || typeof res !== "object" || !res.roles || !Array.isArray(res.colleges)) return;
        setFacets(res);
      })
      .catch(() => {
        // The filters still work without counts.
      });
  }, [role, collegeId, search, department, hasCollege, plan, refreshKey]);

  return facets;
}

export interface RoleChoice {
  value: string;
  label: string;
}

/** Sum of the facet counts a chip stands for ("admin_internal,admin_marketing" is one chip). */
function chipCount(value: string, roles: Record<string, number> | undefined, total?: number): number | null {
  if (!roles) return null;
  if (value === "") return total ?? Object.values(roles).reduce((a, b) => a + b, 0);
  return value.split(",").reduce((sum, r) => sum + (roles[r] ?? 0), 0);
}

/** One chip per kind of account, each with how many there are under the current university and search. */
export function RoleChips({ choices, value, onChange, facets }: { choices: RoleChoice[]; value: string; onChange: (value: string) => void; facets: DirectoryFacets | null }) {
  return (
    <div role="group" aria-label="Filter by account type" className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const count = chipCount(c.value, facets?.roles, facets?.total);
        const active = value === c.value;
        return (
          <button
            key={c.value || "all"}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : count === 0
                  ? "border-border-subtle bg-surface text-text-muted/70 hover:bg-surface-hover"
                  : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover hover:text-primary"
            )}
          >
            {c.label}
            {count !== null && (
              <span className={cn("rounded-full px-1.5 text-3xs font-bold tabular-nums", active ? "bg-accent-primary/15" : "bg-elevated text-text-muted")}>{count.toLocaleString()}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface UniversityOption {
  value: string;
  label: string;
  hint?: string;
  count: number | null;
}

/**
 * Pick a university by typing. A native <select> of every partner college is unusable past a couple of dozen;
 * this filters as you type, shows how many accounts each university has under the current account-type filter
 * (dimming the empty ones), and has a "No university" choice for staff, hiring companies and individual coders.
 */
export function UniversityPicker({
  value,
  onChange,
  facets,
  allowNone = true,
  allLabel = "All universities",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  facets: DirectoryFacets | null;
  allowNone?: boolean;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const options = useMemo<UniversityOption[]>(() => {
    const list: UniversityOption[] = [{ value: "", label: allLabel, count: null }];
    if (allowNone) list.push({ value: NO_UNIVERSITY, label: "No university", hint: "staff, companies, individual coders", count: facets?.without_college ?? null });
    for (const c of facets?.colleges ?? []) {
      list.push({ value: String(c.id), label: c.name, hint: [c.short_code, c.city].filter(Boolean).join(" · ") || undefined, count: c.accounts });
    }
    return list;
  }, [facets, allowNone, allLabel]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (v: string) => {
    onChange(v);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(shown.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = shown[cursor];
      if (o) choose(o.value);
    }
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by university"
        onClick={() => {
          setOpen((o) => !o);
          setCursor(0);
          setTimeout(() => input.current?.focus(), 0);
        }}
        className={cn(
          "inline-flex w-full min-w-[12rem] items-center gap-2 rounded-control border bg-surface px-2.5 py-1.5 text-left text-xs outline-none transition-colors focus:border-accent-primary",
          value ? "border-accent-primary/60 text-primary" : "border-border-subtle text-text-secondary"
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? allLabel}</span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear university filter"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="rounded p-0.5 text-text-muted hover:text-primary"
          >
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[min(22rem,90vw)] overflow-hidden rounded-control border border-border-strong bg-surface shadow-card" onKeyDown={onKeyDown}>
          <div className="relative border-b border-border-subtle p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              placeholder="Type a university name…"
              aria-label="Search universities"
              className="w-full rounded-control border border-border-subtle bg-elevated py-1.5 pl-8 pr-2 text-xs text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <ul role="listbox" aria-label="Universities" className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-text-muted">No university matches “{query}”.</li>
            ) : (
              shown.map((o, i) => (
                <li key={o.value || "all"} role="option" aria-selected={o.value === value}>
                  <button
                    type="button"
                    onClick={() => choose(o.value)}
                    onMouseEnter={() => setCursor(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                      i === cursor ? "bg-surface-hover" : "",
                      o.count === 0 && o.value !== value ? "text-text-muted" : "text-primary"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.label}</span>
                      {o.hint && <span className="block truncate text-3xs text-text-muted">{o.hint}</span>}
                    </span>
                    {o.count !== null && <span className="shrink-0 rounded-full bg-elevated px-1.5 text-3xs font-bold tabular-nums text-text-muted">{o.count.toLocaleString()}</span>}
                    {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" />}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
