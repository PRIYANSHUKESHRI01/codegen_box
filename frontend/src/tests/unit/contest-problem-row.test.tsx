import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch, push: vi.fn() }) }));

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (...a: unknown[]) => get(...a) } };
});
vi.mock("@/lib/editorWarmup", () => ({ warmUpEditor: vi.fn() }));

import { ContestProblemRow, contestProblemHref } from "@/components/contests/ContestProblemRow";
import { __resetContestProblemPrefetchForTests, loadContestProblem, prefetchContestProblem } from "@/lib/contestProblemPrefetch";

const row = (over: Partial<React.ComponentProps<typeof ContestProblemRow>> = {}) => (
  <ContestProblemRow contestSlug="daily-1" contestProblemId={23} index={0} title="Two Sum" difficulty="easy" points={1000} opening={false} disabled={false} onOpen={vi.fn()} {...over} />
);

beforeEach(() => {
  get.mockReset().mockResolvedValue({ problem: { id: 1 }, points: 1000 });
  prefetch.mockReset();
  __resetContestProblemPrefetchForTests();
});
afterEach(cleanup);

describe("a contest problem row", () => {
  it("says which problem it is, how hard and how many points, with a letter like a paper problem set", () => {
    render(row({ index: 2 }));
    const button = screen.getByRole("button", { name: "Problem C: Two Sum, easy, 1000 points" });
    expect(button.textContent).toContain("C");
    expect(button.textContent).toContain("1000 pts");
  });

  it("answers the press at once: busy, 'Opening…', and nothing else clickable", () => {
    render(row({ opening: true }));
    const button = screen.getByRole("button", { name: "Opening problem A: Two Sum" }) as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Opening…")).toBeTruthy();

    cleanup();
    render(row({ disabled: true }));
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens the problem it was pressed for", () => {
    const onOpen = vi.fn();
    render(row({ onOpen }));
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(23);
  });

  it("starts getting the solve screen ready as soon as the pointer, the keyboard or a finger arrives — before any click", () => {
    render(row({ index: 5 }));
    const button = screen.getByRole("button");

    fireEvent.pointerEnter(button);
    expect(get).toHaveBeenCalledWith("/contests/daily-1/problems/23");
    expect(prefetch).toHaveBeenCalledWith(contestProblemHref("daily-1", 23));
  });

  it("warms the first problems of a list on its own, so a first tap on a phone has the data", () => {
    vi.useFakeTimers();
    render(row({ index: 0 }));
    expect(get).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(700));
    expect(get).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("contest problem prefetch", () => {
  it("serves the screen from the warmed request instead of asking twice", async () => {
    prefetchContestProblem("daily-1", 23);
    const payload = await loadContestProblem("daily-1", 23);
    expect(payload.points).toBe(1000);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("forgets a failed prefetch, so the real screen asks again and shows the real error", async () => {
    get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ problem: { id: 1 }, points: 5 });
    prefetchContestProblem("daily-1", 24);
    await Promise.resolve();
    await Promise.resolve();

    expect((await loadContestProblem("daily-1", 24)).points).toBe(5);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
