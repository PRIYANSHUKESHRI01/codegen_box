import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicPlan } from "@/types/pricing";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import { __resetPublicPlansForTests, notifyPricingChanged, PLANS_POLL_MS, usePublicPlans } from "@/lib/usePublicPlans";

const plan = (code: string, list: number, pct: number): PublicPlan => {
  const discount = pct === 0 ? 0 : list - Math.round((list * (100 - pct)) / 100);
  return {
    code,
    name: code,
    list_price: list,
    discount_percent: pct,
    discount_amount: discount,
    sale_price: list - discount,
    term_days: list === 0 ? null : 365,
    term_unit: list === 0 ? null : "year",
    is_free: list === 0,
    contact_only: false,
    entitlements: {
      practice_problems_per_day: null,
      mock_interviews_per_day: null,
      free_trial_uses: null,
      drive_access: true,
      hackathon_access: true,
      vault_access: true,
      project_lab_access: true,
      workspace_hours_per_month: null,
      active_projects: null,
    },
  };
};

const LAUNCH = [plan("coder", 0, 0), plan("expert", 1999, 40), plan("grandmaster", 4999, 40)];

function Probe() {
  const { plans, status } = usePublicPlans();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="expert">{plans?.find((p) => p.code === "expert")?.sale_price ?? "-"}</span>
    </div>
  );
}

const flush = () => act(async () => { await Promise.resolve(); });

/**
 * jsdom has no BroadcastChannel of its own and Node's one hands jsdom handlers an event of the wrong
 * class, so the real thing can't be used here. This stand-in delivers a message to every OTHER open
 * channel with the same name — which is all a second browser tab is.
 */
class FakeChannel {
  static open = new Set<FakeChannel>();
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.open.add(this);
  }
  postMessage(data: unknown) {
    FakeChannel.open.forEach((c) => c !== this && c.name === this.name && c.onmessage?.({ data }));
  }
  close() {
    FakeChannel.open.delete(this);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  FakeChannel.open.clear();
  get.mockReset();
  __resetPublicPlansForTests();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the live price list", () => {
  it("loads the prices once when the first component appears", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();

    expect(get).toHaveBeenCalledWith("/public/plans");
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("expert").textContent).toBe("1199");
  });

  it("shows a price the superadmin changed on the next poll — no reload", async () => {
    get.mockResolvedValueOnce({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();
    expect(screen.getByTestId("expert").textContent).toBe("1199");

    get.mockResolvedValue({ currency: "INR", plans: [plan("coder", 0, 0), plan("expert", 1999, 50), plan("grandmaster", 4999, 40)] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLANS_POLL_MS + 10);
    });

    expect(screen.getByTestId("expert").textContent).toBe("1000");
  });

  it("shares one request and one timer between many components", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(
      <>
        <Probe />
        <Probe />
        <Probe />
      </>
    );
    await flush();

    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLANS_POLL_MS + 10);
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("stops polling once nothing on screen uses it", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    const { unmount } = render(<Probe />);
    await flush();
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLANS_POLL_MS * 3);
    });

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps showing the last good prices when a refresh fails", async () => {
    get.mockResolvedValueOnce({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();

    get.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLANS_POLL_MS + 10);
    });

    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("expert").textContent).toBe("1199");
  });

  it("reports an error only when there is nothing to show at all", async () => {
    get.mockRejectedValue(new Error("down"));
    render(<Probe />);
    await flush();

    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("expert").textContent).toBe("-");
  });

  it("refreshes straight away when told prices changed (the superadmin just saved)", async () => {
    get.mockResolvedValueOnce({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();

    get.mockResolvedValue({ currency: "INR", plans: [plan("coder", 0, 0), plan("expert", 2499, 20), plan("grandmaster", 4999, 40)] });
    await act(async () => {
      notifyPricingChanged();
    });
    await flush();

    expect(screen.getByTestId("expert").textContent).toBe("1999");
  });

  it("hears about a save made in another tab of the same browser and refreshes at once", async () => {
    get.mockResolvedValueOnce({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();

    // The superadmin's tab announces the change on the shared channel.
    get.mockResolvedValue({ currency: "INR", plans: [plan("coder", 0, 0), plan("expert", 1999, 10), plan("grandmaster", 4999, 40)] });
    await act(async () => {
      new FakeChannel("aptrun-pricing").postMessage("changed");
    });
    await flush();

    expect(screen.getByTestId("expert").textContent).toBe("1799");
  });

  it("does not poll a hidden tab", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<Probe />);
    await flush();

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLANS_POLL_MS * 3);
    });
    visibility.mockRestore();

    expect(get).toHaveBeenCalledTimes(1);
  });
});
