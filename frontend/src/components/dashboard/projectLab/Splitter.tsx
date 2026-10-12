"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { clamp, resizeByKey } from "@/lib/projectLabLayout";

interface SplitterProps {
  /** Describes what the divider resizes, for assistive tech: "Resize the guide panel". */
  label: string;
  /** The pane's current width in px, measured when a drag starts (so a CSS-sized pane can be resized too). */
  getSize: () => number;
  onResize: (px: number) => void;
  /** Back to the pane's default width (double-click or Enter). */
  onReset?: () => void;
  min: number;
  max: number;
  /** Which way the pane grows when dragged: 1 = pane is left of the divider, -1 = right of it. */
  direction: 1 | -1;
  className?: string;
}

/**
 * A vertical drag handle between two panes. An embedded iframe swallows every
 * mouse event once the pointer is over it, which would make a plain handle stop
 * tracking the moment you drag across the editor — so while dragging, a
 * transparent layer covers the page and the pointer stays captured by the
 * handle. Also a keyboard-operable separator (arrows, Shift for bigger steps,
 * Home/End) with double-click to reset.
 */
export function Splitter({ label, getSize, onResize, onReset, min, max, direction, className }: SplitterProps) {
  const [dragging, setDragging] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const start = useRef({ x: 0, size: 0 });

  const apply = (px: number) => {
    const next = clamp(px, min, max);
    setSize(next);
    onResize(next);
  };

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={size ?? undefined}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, size: getSize() };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!dragging) return;
          apply(start.current.size + direction * (e.clientX - start.current.x));
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => {
          setSize(null);
          onReset?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onReset) {
            e.preventDefault();
            setSize(null);
            onReset();
            return;
          }
          const next = resizeByKey(size ?? getSize(), e.key, e.shiftKey, min, max, direction);
          if (next !== null) {
            e.preventDefault();
            apply(next);
          }
        }}
        className={cn(
          // The visible bar is 4px; the ::before widens the grab area without taking layout space.
          "group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-border-subtle outline-none transition-colors",
          "before:absolute before:inset-y-0 before:-inset-x-1.5 before:content-['']",
          "hover:bg-accent-primary/60 focus-visible:bg-accent-primary",
          dragging && "bg-accent-primary",
          className
        )}
      />
      {dragging && <div aria-hidden className="fixed inset-0 z-[60] cursor-col-resize" />}
    </>
  );
}
