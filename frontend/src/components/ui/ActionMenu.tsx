"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger" | "success";
  /** A small count shown at the right (e.g. how many departments). */
  badge?: number;
}

interface Props {
  /** Items in groups; a divider is drawn between groups. Empty groups (and items you did not pass) are skipped. */
  groups: (ActionMenuItem | null | undefined | false)[][];
  label: string;
  /** Names the trigger for screen readers, e.g. "Manage Tulas University". */
  ariaLabel?: string;
  className?: string;
  icon?: LucideIcon;
}

const MENU_WIDTH = 232;
const GAP = 6;

/**
 * A button that opens a menu of actions. The menu is drawn on <body> (so a table's or card's overflow can never clip it), flips
 * above the button near the bottom of the window, closes on Escape / outside click / scroll / resize, and is keyboard-operable
 * (arrows, Home, End, Enter; Tab closes) with focus returned to the button.
 */
export function ActionMenu({ groups, label, ariaLabel, className, icon: Icon }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const visible = groups.map((g) => g.filter((i): i is ActionMenuItem => !!i)).filter((g) => g.length > 0);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPos(null);
    if (refocus) trigger.current?.focus();
  }, []);

  // Place the menu once it has a measured height: under the button, right edges aligned, flipped up when it would run off the window.
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const t = trigger.current.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - MENU_WIDTH - 8, t.right - MENU_WIDTH));
    const below = t.bottom + GAP;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, t.top - GAP - h) : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const onDown = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || trigger.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onAway = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onAway);
    window.addEventListener("scroll", onAway, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onAway);
      window.removeEventListener("scroll", onAway, true);
    };
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-1.5 text-2xs font-bold text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50",
          open && "border-accent-primary/40 text-primary",
          className
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={ariaLabel ?? label}
            onKeyDown={onKeyDown}
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: MENU_WIDTH, visibility: pos ? "visible" : "hidden" }}
            className="fixed z-[110] overflow-hidden rounded-panel border border-border-strong bg-surface py-1.5 shadow-card animate-fade-in"
          >
            {visible.map((group, gi) => (
              <div key={gi} className={cn(gi > 0 && "mt-1.5 border-t border-border-subtle pt-1.5")}>
                {group.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        close(false);
                        item.onSelect();
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold transition-colors focus:outline-none",
                        item.tone === "danger"
                          ? "text-status-danger hover:bg-status-danger/10 focus:bg-status-danger/10"
                          : item.tone === "success"
                            ? "text-status-success hover:bg-status-success/10 focus:bg-status-success/10"
                            : "text-text-secondary hover:bg-surface-hover hover:text-primary focus:bg-surface-hover focus:text-primary"
                      )}
                    >
                      {ItemIcon && <ItemIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && <span className="tabular rounded-full bg-accent-primary/15 px-1.5 text-3xs text-accent-primary">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
