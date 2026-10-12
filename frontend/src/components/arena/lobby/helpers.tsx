import { Clock, Flame } from "lucide-react";
import { CompactTimeLeft } from "@/components/arena/primitives";
import { MODE_LABEL, compactMoney, formatMoney } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonCard } from "@/types/hackathon";

/* ── Money ───────────────────────────────────────────────────────────────── */

/** Count-up friendly prize text: "₹0" at the start of the animation instead of the "Perks" fallback. */
export function prizeFormat(currency: string) {
  return (n: number) => (n <= 0 ? formatMoney(0, currency) : compactMoney(n, currency));
}

export const hasPrize = (card: Pick<HackathonCard, "prize_pool">) => card.prize_pool.amount > 0;

/* ── Where / team size ───────────────────────────────────────────────────── */

export function whereLabel(card: Pick<HackathonCard, "mode" | "location">): string {
  if (card.mode === "online") return "Online";
  const place = card.location?.split("·")[0].trim();
  return place ? `${MODE_LABEL[card.mode]} · ${place}` : MODE_LABEL[card.mode];
}

export function teamSizeLabel({ min, max }: HackathonCard["team_size"]): string {
  if (max <= 1) return "Solo";
  if (min <= 1) return `Solo or up to ${max}`;
  return min === max ? `Teams of ${max}` : `Teams of ${min}–${max}`;
}

/* ── Capacity & urgency ──────────────────────────────────────────────────── */

export const isFinished = (card: Pick<HackathonCard, "phase">) => card.phase === "judging" || card.phase === "completed";

/** 0–100, or null when the hackathon has no cap. */
export function fillPercent(card: Pick<HackathonCard, "participants_count" | "max_participants">): number | null {
  if (!card.max_participants) return null;
  return Math.min(100, Math.round((card.participants_count / card.max_participants) * 100));
}

export type Urgency = { kind: "closing"; at: string } | { kind: "spots"; spots: number };

/**
 * Something worth hurrying for: fewer than 15% of the places left, or registration closing in under
 * 72 hours. Only while the student can still register — urgency about a closed door is just noise.
 */
export function urgencyOf(card: HackathonCard, now: number): Urgency | null {
  if (!card.registration_open || card.mine) return null;

  if (card.max_participants && card.spots_left !== null && card.spots_left > 0 && card.spots_left / card.max_participants < 0.15) {
    return { kind: "spots", spots: card.spots_left };
  }

  const left = new Date(card.registration_closes_at).getTime() - now;
  if (left > 0 && left <= 72 * 3_600_000) return { kind: "closing", at: card.registration_closes_at };

  return null;
}

/** The warm "hurry" chip. */
export function UrgencyChip({ urgency, className = "" }: { urgency: Urgency; className?: string }) {
  return (
    <span className={cn("ar-chip ar-urgent !px-2.5 !py-1 !text-[11.5px] !font-bold", className)}>
      {urgency.kind === "spots" ? <Flame className="h-3.5 w-3.5" aria-hidden /> : <Clock className="h-3.5 w-3.5" aria-hidden />}
      {urgency.kind === "spots" ? (
        <>
          Only {urgency.spots} {urgency.spots === 1 ? "spot" : "spots"} left
        </>
      ) : (
        <>
          Closes in <CompactTimeLeft target={urgency.at} />
        </>
      )}
    </span>
  );
}

/* ── One-line status for the ticket ──────────────────────────────────────── */

export function statusLine(card: HackathonCard): { tone: "live" | "open" | "soon" | "judging" | "done"; text: string } {
  const mine = card.mine;

  if (mine?.is_disqualified) return { tone: "done", text: "Your entry was disqualified" };

  if (mine) {
    if (card.phase === "live") {
      return mine.submission_status === "submitted"
        ? { tone: "open", text: "Submitted · you can keep polishing" }
        : mine.submission_status === "draft"
          ? { tone: "soon", text: "Draft saved · finish and submit" }
          : { tone: "soon", text: "You're in · start your project" };
    }
    if (card.phase === "judging") return { tone: "judging", text: "Submitted · judging in progress" };
    if (card.phase === "completed") return { tone: "done", text: mine.award_label ?? (mine.rank ? `You placed #${mine.rank}` : "You took part") };
    return { tone: "open", text: `You're in${mine.team_name ? ` · ${mine.team_name}` : ""}` };
  }

  switch (card.phase) {
    case "registration_open":
      return { tone: "open", text: card.spots_left !== null ? `Registration open · ${card.spots_left.toLocaleString("en-IN")} spots left` : "Registration is open" };
    case "upcoming":
      return { tone: "soon", text: "Registration opens soon" };
    case "starting_soon":
      return { tone: "soon", text: "Registration closed · kickoff is near" };
    case "live":
      return card.registration_open ? { tone: "live", text: "Live · you can still join" } : { tone: "live", text: "Live · registration closed" };
    case "judging":
      return { tone: "judging", text: "Judging in progress" };
    default:
      return { tone: "done", text: "Results are in" };
  }
}

export const TONE_COLOR: Record<string, string> = {
  live: "rgb(var(--ar-live))",
  open: "rgb(var(--ar-open))",
  soon: "rgb(var(--ar-soon))",
  judging: "rgb(var(--ar-judging))",
  done: "#9aa1bb",
};
