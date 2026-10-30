"use client";

import { api } from "@/lib/api";
import { SUBSCRIPTION_CHANGED_EVENT, notifySubscriptionChanged } from "@/lib/projectLab";
import type { PlanSignal } from "@/types/subscription";

/**
 * Keeps an open dashboard in step with the account's plan.
 *
 * A plan can change while the page is open without the student doing anything:
 * a superadmin grants, extends or cancels it, edits what the plan includes, or
 * the plan simply runs out. The server already enforces the new state on the very
 * next request, but the screen — the sidebar's locks, the plan chip, "X of Y
 * used today" — only knows what it last fetched. So every few seconds it asks the
 * server for a tiny signature of the plan (GET /me/plan-signal); when that
 * signature moves it fires SUBSCRIPTION_CHANGED_EVENT, which everything that
 * caches plan data already listens to, and tells the student what happened.
 *
 * Why polling and not a socket: the same reasoning as lib/usePublicPlans.ts — the
 * API runs on PHP-FPM, where a held-open connection pins a worker per visitor,
 * while a few-hundred-byte poll every 30 s survives proxies, sleeping laptops and
 * flaky mobile data. A check also fires the moment a hidden tab becomes visible,
 * the window regains focus, or the network returns, so in practice a returning
 * student sees the change at once; the poll is the safety net for a tab left open.
 *
 * One module-level store however many components start it: a single timer, a
 * single request in flight. It only ever DISPLAYS state — every restricted
 * action is refused again by the server — so a missed beat can at worst show a
 * button that then explains why it didn't work.
 */

export const PLAN_SYNC_POLL_MS = 30_000;

/** Fired (on window) when the college changed this student's year or section while the page was open. Not a plan change: no plan notice goes with it. */
export const ACADEMIC_CHANGED_EVENT = "aptrun:academic-changed";

/** Fired (on window) when Mellow corrected the college's name/code/place, or this account's own name/email, while the page was open. Not a plan change. */
export const PROFILE_CHANGED_EVENT = "aptrun:profile-changed";

/** Fired (on window) when the superadmin switched a whole section (Merchant Navy ...) on or off while the page was open. `detail` = { modules, previous }. */
export const MODULES_CHANGED_EVENT = "aptrun:modules-changed";

export interface ModulesChangedDetail {
  modules: Record<string, boolean>;
  previous: Record<string, boolean>;
}

export type PlanChangeKind = "upgraded" | "extended" | "changed" | "ended";

export interface PlanChangeNotice {
  kind: PlanChangeKind;
  /** The plan the account is on now; null when none is running. */
  planName: string | null;
  planCode: string | null;
  /** What it was before. */
  previousName: string | null;
  /** Days left on the plan now (null when it never expires or none is running). */
  daysRemaining: number | null;
}

/** Lowest to highest. A plan not listed (a college's, say) can only ever be a "changed". */
const PLAN_RANK: Record<string, number> = { coder: 0, expert: 1, grandmaster: 2 };

let baseline: PlanSignal | null = null;
let baselineOwner: number | null = null;
let academicBaseline: string | null = null;
let profileBaseline: string | null = null;
let modulesBaseline: { signature: string; modules: Record<string, boolean> } | null = null;
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let starts = 0;
/** True while this module itself is dispatching SUBSCRIPTION_CHANGED_EVENT, so it doesn't mistake its own event for a local purchase. */
let dispatching = false;
const noticeListeners = new Set<(notice: PlanChangeNotice) => void>();

/**
 * What kind of change this is, or null when there is nothing worth telling the
 * student: the same plan with the same time on it means someone edited what the
 * plan includes — the page still refetches, but "your plan changed to Expert (it
 * was Expert)" would only confuse.
 */
function classify(previous: PlanSignal, next: PlanSignal): PlanChangeKind | null {
  const was = previous.plan ? PLAN_RANK[previous.plan.code] : undefined;
  const now = next.plan ? PLAN_RANK[next.plan.code] : undefined;

  if (previous.plan && next.plan && previous.plan.code === next.plan.code) {
    const extended = previous.days_remaining !== null && next.days_remaining !== null && next.days_remaining > previous.days_remaining + 1;
    return extended ? "extended" : null;
  }

  // A paid plan that is no longer running (or fell back to the free one).
  if (was !== undefined && was > 0 && (next.plan === null || now === 0)) return "ended";
  if (was !== undefined && now !== undefined && now > was) return "upgraded";
  // Free → anything paid that isn't ranked (e.g. a college started covering them) still reads as a gain.
  if ((previous.plan === null || was === 0) && next.plan !== null && now === undefined) return "upgraded";

  return "changed";
}

function announce(previous: PlanSignal, next: PlanSignal) {
  const kind = classify(previous, next);
  if (kind === null) return;

  const notice: PlanChangeNotice = {
    kind,
    planName: next.plan?.name ?? null,
    planCode: next.plan?.code ?? null,
    previousName: previous.plan?.name ?? null,
    daysRemaining: next.days_remaining,
  };

  noticeListeners.forEach((listener) => listener(notice));
}

/**
 * Ask the server now. Concurrent calls share one request. Never throws.
 * `silent` adopts the answer as the new baseline without telling the student —
 * for changes they just made themselves (a purchase), which the page has
 * already acknowledged.
 */
export function checkPlanNow({ silent = false }: { silent?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = api
    .get<PlanSignal>("/me/plan-signal")
    .then((next) => {
      if (!next || typeof next.signature !== "string") return;

      const previous = baseline;
      baseline = next;

      // A TPO moved the student up a year / to another section: tell whoever shows it (the Vault AI Interview's countdown, the
      // sidebar), whether or not anything about the plan moved. The first answer only sets the starting point.
      const academicBefore = academicBaseline;
      academicBaseline = next.academic_signature ?? null;
      if (previous !== null && academicBefore !== null && academicBaseline !== null && academicBefore !== academicBaseline) {
        window.dispatchEvent(new Event(ACADEMIC_CHANGED_EVENT));
      }

      // Mellow renamed the college / changed its code or the TPO's login details: tell whoever shows them (AuthProvider reloads the user).
      const profileBefore = profileBaseline;
      profileBaseline = next.profile_signature ?? null;
      if (previous !== null && profileBefore !== null && profileBaseline !== null && profileBefore !== profileBaseline) {
        window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));
      }

      // The superadmin switched a whole section on or off: tell whoever shows it (the sidebar, the open catalogue). Nothing to do with the plan.
      const modulesBefore = modulesBaseline;
      modulesBaseline = typeof next.modules_signature === "string" ? { signature: next.modules_signature, modules: next.modules ?? {} } : null;
      if (previous !== null && modulesBefore !== null && modulesBaseline !== null && modulesBefore.signature !== modulesBaseline.signature) {
        window.dispatchEvent(new CustomEvent<ModulesChangedDetail>(MODULES_CHANGED_EVENT, { detail: { modules: modulesBaseline.modules, previous: modulesBefore.modules } }));
      }

      if (previous === null || previous.signature === next.signature) return;

      dispatching = true;
      try {
        notifySubscriptionChanged();
      } finally {
        dispatching = false;
      }

      if (!silent) announce(previous, next);
    })
    .catch(() => {
      /* offline, or the API is briefly down: keep what we have; the next beat tries again */
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

const onVisible = () => {
  if (document.visibilityState === "visible") void checkPlanNow();
};
const onFocusOrOnline = () => void checkPlanNow();
/** Something on THIS page changed the plan (a purchase): learn the new state quietly. */
const onLocalChange = () => {
  if (!dispatching) void checkPlanNow({ silent: true });
};

/**
 * Begin watching for `userId`. Reference-counted: pages come and go (each
 * remounts the shell), the watching continues while at least one is mounted.
 * Returns the function that stops it.
 */
export function startPlanSync(userId: number): () => void {
  // A different account signing in on the same page load must not inherit the last one's baseline.
  if (baselineOwner !== userId) {
    baseline = null;
    academicBaseline = null;
    profileBaseline = null;
    modulesBaseline = null;
    baselineOwner = userId;
  }

  starts += 1;

  if (starts === 1) {
    timer = setInterval(() => {
      if (document.visibilityState === "visible") void checkPlanNow();
    }, PLAN_SYNC_POLL_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocusOrOnline);
    window.addEventListener("online", onFocusOrOnline);
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, onLocalChange);
  }

  // Not silent: the very first answer only sets the baseline (nothing to compare), but on a later page
  // (the shell remounts on every navigation) a change that happened since the last one must still be announced.
  void checkPlanNow();

  let stopped = false;

  return () => {
    if (stopped) return;
    stopped = true;
    starts -= 1;

    if (starts === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocusOrOnline);
      window.removeEventListener("online", onFocusOrOnline);
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onLocalChange);
    }
  };
}

/** Be told, once per real change, what happened to the plan. Returns the unsubscribe function. */
export function subscribeToPlanNotices(listener: (notice: PlanChangeNotice) => void): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

/** Test seam: forget everything, as if the page had just loaded. */
export function __resetPlanSyncForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
  starts = 0;
  baseline = null;
  academicBaseline = null;
  profileBaseline = null;
  modulesBaseline = null;
  baselineOwner = null;
  inFlight = null;
  dispatching = false;
  noticeListeners.clear();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocusOrOnline);
    window.removeEventListener("online", onFocusOrOnline);
    window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onLocalChange);
  }
}
