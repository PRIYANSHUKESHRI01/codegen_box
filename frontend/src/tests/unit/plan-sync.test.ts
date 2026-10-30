import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSignal } from "@/types/subscription";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import { SUBSCRIPTION_CHANGED_EVENT, notifySubscriptionChanged } from "@/lib/projectLab";
import { ACADEMIC_CHANGED_EVENT, PROFILE_CHANGED_EVENT, PLAN_SYNC_POLL_MS, __resetPlanSyncForTests, checkPlanNow, startPlanSync, subscribeToPlanNotices, type PlanChangeNotice } from "@/lib/planSync";

const signal = (signature: string, plan: { code: string; name: string } | null, days = 100): PlanSignal => ({ signature, source: plan ? "individual" : "none", plan, days_remaining: plan ? days : null });

const CODER = signal("sig-coder", { code: "coder", name: "Coder" });
const EXPERT = signal("sig-expert", { code: "expert", name: "Expert" });
const GRANDMASTER = signal("sig-gm", { code: "grandmaster", name: "Grandmaster" });

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0);
};

let notices: PlanChangeNotice[];
let changedEvents: number;
const onChanged = () => {
  changedEvents += 1;
};

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
  __resetPlanSyncForTests();
  notices = [];
  changedEvents = 0;
  window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, onChanged);
  subscribeToPlanNotices((n) => notices.push(n));
});

afterEach(() => {
  window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onChanged);
  __resetPlanSyncForTests();
  vi.useRealTimers();
});

describe("live plan sync", () => {
  it("takes the first answer as the starting point and says nothing", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();

    expect(get).toHaveBeenCalledWith("/me/plan-signal");
    expect(notices).toHaveLength(0);
    expect(changedEvents).toBe(0);
    stop();
  });

  it("announces an upgrade and tells every plan-aware widget to refetch, once", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue(GRANDMASTER);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

    expect(changedEvents).toBe(1);
    expect(notices).toEqual([{ kind: "upgraded", planName: "Grandmaster", planCode: "grandmaster", previousName: "Coder", daysRemaining: 100 }]);

    // Nothing new on the next beat: no repeat.
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices).toHaveLength(1);
    expect(changedEvents).toBe(1);
    stop();
  });

  it("calls a paid plan that stops running 'ended', whether it is cancelled or just runs out", async () => {
    get.mockResolvedValue(GRANDMASTER);
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue(CODER);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices[0]).toMatchObject({ kind: "ended", planName: "Coder", previousName: "Grandmaster" });

    get.mockResolvedValue(GRANDMASTER);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    get.mockResolvedValue(signal("sig-none", null));
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices.at(-1)).toMatchObject({ kind: "ended", planName: null });
    stop();
  });

  it("calls a move between paid plans a change in the right direction", async () => {
    get.mockResolvedValue(EXPERT);
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue(GRANDMASTER);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices.at(-1)?.kind).toBe("upgraded");

    get.mockResolvedValue(EXPERT);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices.at(-1)).toMatchObject({ kind: "changed", planName: "Expert", previousName: "Grandmaster" });
    stop();
  });

  it("refreshes the page but stays quiet when only what the plan includes was edited", async () => {
    get.mockResolvedValue(EXPERT);
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue({ ...EXPERT, signature: "sig-expert-edited" });
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

    expect(changedEvents).toBe(1); // limits, locks and meters redraw …
    expect(notices).toHaveLength(0); // … without a confusing "your plan changed to Expert (it was Expert)"
    stop();
  });

  it("says so when more days were added to the plan they already have", async () => {
    get.mockResolvedValue(signal("sig-a", { code: "expert", name: "Expert" }, 10));
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue(signal("sig-b", { code: "expert", name: "Expert" }, 40));
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

    expect(notices).toEqual([{ kind: "extended", planName: "Expert", planCode: "expert", previousName: "Expert", daysRemaining: 40 }]);
    stop();
  });

  it("does not announce a purchase the student just made themselves", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();

    // The pricing page confirms the payment, then fires the event; the new state is adopted quietly.
    get.mockResolvedValue(GRANDMASTER);
    notifySubscriptionChanged();
    await flush();
    expect(notices).toHaveLength(0);

    // …and it is the baseline now: the next beat sees nothing new.
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices).toHaveLength(0);
    stop();
  });

  it("checks again when the tab becomes visible, not only on the timer", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();

    get.mockResolvedValue(GRANDMASTER);
    document.dispatchEvent(new Event("visibilitychange"));
    await flush();

    expect(notices).toHaveLength(1);
    stop();
  });

  it("keeps what it has when the server can't be reached, and catches up afterwards", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();

    get.mockRejectedValue(new Error("offline"));
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices).toHaveLength(0);

    get.mockResolvedValue(GRANDMASTER);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(notices).toHaveLength(1);
    stop();
  });

  it("shares one request between simultaneous checks", async () => {
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(1);
    await flush();
    get.mockClear();

    await Promise.all([checkPlanNow(), checkPlanNow(), checkPlanNow()]);
    expect(get).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not let a different account inherit the previous one's baseline", async () => {
    get.mockResolvedValue(GRANDMASTER);
    startPlanSync(1)();
    await flush();

    // Another student signs in on the same page: a Coder who was never a Grandmaster. Nothing to announce.
    get.mockResolvedValue(CODER);
    const stop = startPlanSync(2);
    await flush();

    expect(notices).toHaveLength(0);
    stop();
  });

  it("runs one timer however many pages ask for it, and stops when the last one leaves", async () => {
    get.mockResolvedValue(CODER);
    const stopA = startPlanSync(1);
    const stopB = startPlanSync(1);
    await flush();
    get.mockClear();

    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(get).toHaveBeenCalledTimes(1);

    stopA();
    get.mockClear();
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    expect(get).toHaveBeenCalledTimes(1);

    stopB();
    get.mockClear();
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS * 3);
    expect(get).not.toHaveBeenCalled();
  });

  describe("when Mellow corrects the college's name, code or the TPO's login details", () => {
    const withProfile = (base: PlanSignal, profile: string | null): PlanSignal => ({ ...base, profile_signature: profile });
    let profileEvents: number;
    const onProfile = () => {
      profileEvents += 1;
    };

    beforeEach(() => {
      profileEvents = 0;
      window.addEventListener(PROFILE_CHANGED_EVENT, onProfile);
    });
    afterEach(() => window.removeEventListener(PROFILE_CHANGED_EVENT, onProfile));

    it("fires its own event on the next beat, once, and never reads as a plan change", async () => {
      get.mockResolvedValue(withProfile(CODER, "name-a"));
      const stop = startPlanSync(1);
      await flush();
      expect(profileEvents).toBe(0);

      get.mockResolvedValue(withProfile(CODER, "name-b"));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

      expect(profileEvents).toBe(1);
      expect(notices).toHaveLength(0);
      expect(changedEvents).toBe(0);
      stop();
    });

    it("says nothing for the first answer, or for an account that has no college (no marker)", async () => {
      get.mockResolvedValue(withProfile(CODER, null));
      const stop = startPlanSync(1);
      await flush();
      get.mockResolvedValue(withProfile(CODER, null));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
      expect(profileEvents).toBe(0);
      stop();
    });
  });

  describe("when the college changes a student's year or section", () => {
    const withAcademic = (base: PlanSignal, academic: string | null): PlanSignal => ({ ...base, academic_signature: academic });
    let academicEvents: number;
    const onAcademic = () => {
      academicEvents += 1;
    };

    beforeEach(() => {
      academicEvents = 0;
      window.addEventListener(ACADEMIC_CHANGED_EVENT, onAcademic);
    });
    afterEach(() => window.removeEventListener(ACADEMIC_CHANGED_EVENT, onAcademic));

    it("fires its own event on the next beat, and never reads as a plan change", async () => {
      get.mockResolvedValue(withAcademic(CODER, "year-3"));
      const stop = startPlanSync(1);
      await flush();
      expect(academicEvents).toBe(0);

      get.mockResolvedValue(withAcademic(CODER, "year-4"));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

      expect(academicEvents).toBe(1);
      expect(notices).toHaveLength(0);
      expect(changedEvents).toBe(0);
      stop();
    });

    it("says it once, not on every beat", async () => {
      get.mockResolvedValue(withAcademic(CODER, "a"));
      const stop = startPlanSync(1);
      await flush();

      get.mockResolvedValue(withAcademic(CODER, "b"));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

      expect(academicEvents).toBe(1);
      stop();
    });

    it("says nothing for the first answer, and nothing for staff (who have no marker)", async () => {
      get.mockResolvedValue(withAcademic(CODER, "a"));
      const stop = startPlanSync(1);
      await flush();
      expect(academicEvents).toBe(0);
      stop();

      __resetPlanSyncForTests();
      get.mockResolvedValue(withAcademic(CODER, null));
      const stopStaff = startPlanSync(2);
      await flush();
      get.mockResolvedValue(withAcademic(CODER, null));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
      expect(academicEvents).toBe(0);
      stopStaff();
    });

    it("still announces a plan change that arrives together with it", async () => {
      get.mockResolvedValue(withAcademic(CODER, "a"));
      const stop = startPlanSync(1);
      await flush();

      get.mockResolvedValue(withAcademic(EXPERT, "b"));
      await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

      expect(academicEvents).toBe(1);
      expect(notices).toHaveLength(1);
      expect(notices[0].kind).toBe("upgraded");
      stop();
    });

    it("does not carry one account's marker over to the next account on the same page", async () => {
      get.mockResolvedValue(withAcademic(CODER, "mine"));
      const stop = startPlanSync(1);
      await flush();
      stop();

      get.mockResolvedValue(withAcademic(CODER, "someone-elses"));
      const stopOther = startPlanSync(2);
      await flush();

      expect(academicEvents).toBe(0);
      stopOther();
    });
  });
});
