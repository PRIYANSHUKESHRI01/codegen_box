import type { StudentInterviewSummary } from "@/types/interview";

/** Where a college mock interview is in its window (see Interview::scheduleState on the server). */
export type ScheduleState = "unscheduled" | "upcoming" | "open" | "closed";

export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** What a student reads on a card or banner about the window — null for an interview with none. */
export function scheduleNote(i: Pick<StudentInterviewSummary, "opens_at" | "closes_at" | "schedule_state">): { text: string; tone: "info" | "warning" | "danger" | "success" } | null {
  switch (i.schedule_state) {
    case "upcoming":
      return { text: `Opens ${whenLabel(i.opens_at)}`, tone: "info" };
    case "open":
      return i.closes_at ? { text: `Open until ${whenLabel(i.closes_at)}`, tone: "success" } : null;
    case "closed":
      return { text: `Closed ${whenLabel(i.closes_at)}`, tone: "danger" };
    default:
      return null;
  }
}

/** Whether a student who has not started can start now. A sitting already begun can always be continued. */
export function canStartNow(i: Pick<StudentInterviewSummary, "schedule_state" | "my_session_status">): boolean {
  if (i.my_session_status === "in_progress" || i.my_session_status === "completed") return true;
  return i.schedule_state !== "upcoming" && i.schedule_state !== "closed";
}
