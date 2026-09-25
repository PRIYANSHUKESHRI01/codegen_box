import { ActivityDay } from "@/types/studentStats";

/**
 * The backend only returns days with at least one submission (a sparse
 * list — cheap to compute, cheap to transfer). ActivityHeatmap needs a full
 * Monday-start grid of weeks, each with all 7 days present (zero-count days
 * included), so this fills the gaps client-side.
 */
export function buildActivityWeeks(activity: ActivityDay[], weeksBack: number = 52): ActivityDay[][] {
  const byDate = new Map(activity.map((d) => [d.date, d]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Back up to the most recent Monday on/before today.
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 = Monday
  const mostRecentMonday = new Date(today);
  mostRecentMonday.setDate(today.getDate() - dayOfWeek);

  const firstMonday = new Date(mostRecentMonday);
  firstMonday.setDate(mostRecentMonday.getDate() - (weeksBack - 1) * 7);

  const weeks: ActivityDay[][] = [];
  for (let w = 0; w < weeksBack; w++) {
    const week: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(firstMonday);
      date.setDate(firstMonday.getDate() + w * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      week.push(byDate.get(iso) ?? { date: iso, count: 0, level: 0 });
    }
    weeks.push(week);
  }

  return weeks;
}
