import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Widths and indents of the faint "code" lines, so the placeholder reads as a file being opened rather than a grey box. */
const LINES: { width: string; indent: number }[] = [
  { width: "w-2/5", indent: 0 },
  { width: "w-3/5", indent: 1 },
  { width: "w-1/2", indent: 1 },
  { width: "w-2/3", indent: 2 },
  { width: "w-1/3", indent: 2 },
  { width: "w-1/2", indent: 1 },
  { width: "w-1/4", indent: 0 },
  { width: "w-3/5", indent: 0 },
];

/**
 * What the editor area shows while the editor itself is still starting up: the dark editor surface,
 * a gutter and a few faint lines of "code" breathing in turn, and a small status. It is the same
 * placeholder the solve screen's skeleton uses, so going skeleton → editor loading → editor is one
 * continuous surface instead of three different flashes.
 */
export function EditorBootPlaceholder({ label = "Starting the editor…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("relative flex h-full w-full overflow-hidden bg-[#1e1e1e]", className)}>
      <div aria-hidden className="flex w-12 shrink-0 select-none flex-col items-end gap-[11px] pr-3 pt-[18px] font-mono text-[11px] leading-3 text-white/15">
        {LINES.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>

      <div aria-hidden className="flex-1 space-y-[11px] pr-8 pt-[18px]">
        {LINES.map((line, i) => (
          <div
            key={i}
            className={cn("h-3 animate-pulse rounded bg-white/[0.07]", line.width)}
            style={{ marginLeft: line.indent * 20, animationDelay: `${i * 110}ms` }}
          />
        ))}
      </div>

      <div className="absolute bottom-3 right-4 flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {label}
      </div>
    </div>
  );
}
