import { bandOf } from "@/lib/studyMatch";
import { cn } from "@/lib/utils";
import type { StudyScorePoint } from "@/types/interview";

const DOT: Record<string, string> = { green: "fill-status-success", yellow: "fill-status-warning", red: "fill-status-danger" };

/**
 * The scores of a student's sittings of one set, oldest to newest, as a small line: each point is coloured by the same bands as the match
 * (red under 30, yellow under 70, green from 70), the newest is ringed. The words are in `aria-label`, so the picture is never the only way to
 * read it. At most the last 12 sittings are drawn.
 */
export function ScoreTrend({ points, className, highlightId }: { points: StudyScorePoint[]; className?: string; highlightId?: number }) {
  const shown = points.slice(-12);
  if (shown.length === 0) return null;

  const W = 168;
  const H = 44;
  const PAD = 6;
  const x = (i: number) => (shown.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (shown.length - 1));
  const y = (score: number) => H - PAD - (Math.max(0, Math.min(100, score)) / 100) * (H - PAD * 2);
  const label = `Scores, oldest first: ${shown.map((p) => `${p.score}%`).join(", ")}`;

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className={cn("h-11 w-[168px] shrink-0", className)} data-testid="score-trend">
      {/* the two band edges, 70% and 30% */}
      {[70, 30].map((edge) => (
        <line key={edge} x1={PAD} x2={W - PAD} y1={y(edge)} y2={y(edge)} className="stroke-border-subtle" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {shown.length > 1 && <polyline points={shown.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")} fill="none" className="stroke-text-muted/50" strokeWidth="1.5" strokeLinejoin="round" />}
      {shown.map((p, i) => {
        const latest = highlightId !== undefined ? p.id === highlightId : i === shown.length - 1;
        return (
          <g key={p.id}>
            {latest && <circle cx={x(i)} cy={y(p.score)} r="6" className="fill-none stroke-accent-primary" strokeWidth="1.5" />}
            <circle cx={x(i)} cy={y(p.score)} r="3.2" className={DOT[bandOf(p.score)]} />
          </g>
        );
      })}
    </svg>
  );
}
