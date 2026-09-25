import { SessionLoader } from "@/components/ui/SessionLoader";

/**
 * Next.js App Router's route-segment loading convention — this renders
 * instantly (no JS execution needed) the moment a navigation starts,
 * covering the gap before the destination route's own JS chunk has been
 * fetched/parsed. Complementary to SessionLoader's other use (inside each
 * page, once its JS HAS arrived but the shared auth check is still
 * resolving) — between the two, there's no gap in the loading experience
 * from click to interactive page.
 */
export default function Loading() {
  return <SessionLoader />;
}
