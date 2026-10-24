import { getPack } from "./catalog";
import type { DrillSummary } from "./api";

export type RecommendReason = "start" | "new" | "weak" | "refresh";

export interface Recommendation {
  skill: string;
  reason: RecommendReason;
}

/**
 * The skill worth practising next in a pack: the weakest one tried enough to judge, else the first not yet tried, else the one practised
 * longest ago. Mirrors the server's home-shelf rule (PracticeShelfService::drillCard) so the home card and this page never disagree.
 */
export function recommendNext(summary: DrillSummary, packId: string): Recommendation | null {
  const pack = getPack(packId);
  if (!pack) return null;
  const stats = summary.skills;

  const weak = pack.skills
    .filter((s) => (stats[s.id]?.recent.length ?? 0) >= 3)
    .map((s) => ({ id: s.id, accuracy: stats[s.id].recent.reduce((n, r) => n + r[0], 0) / stats[s.id].recent.length }))
    .filter((s) => s.accuracy < 0.75)
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weak) return { skill: weak.id, reason: "weak" };

  const fresh = pack.skills.find((s) => !stats[s.id]);
  if (fresh) return { skill: fresh.id, reason: Object.keys(stats).length === 0 ? "start" : "new" };

  const oldest = [...pack.skills].sort((a, b) => (stats[a.id]?.last_at ?? "").localeCompare(stats[b.id]?.last_at ?? ""))[0];
  return { skill: oldest.id, reason: "refresh" };
}

export const REASON_TEXT: Record<RecommendReason, string> = {
  start: "A good place to begin",
  new: "A skill you haven't tried yet",
  weak: "Worth another go — a few slipped recently",
  refresh: "Due a refresher",
};
