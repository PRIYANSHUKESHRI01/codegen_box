import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemDetail } from "@/types/problem";

const push = vi.fn();
let currentPathname: string | null = "/dashboard/practice/view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
  usePathname: () => currentPathname,
}));

import { NAVIGATION_STUCK_AFTER_MS, useResilientNavigation } from "@/lib/useResilientNavigation";
import { ROUTE_SYNC_GRACE_MS, RouteSyncGuard } from "@/components/navigation/RouteSyncGuard";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";

const assign = vi.fn();
const reload = vi.fn();
const realLocation = window.location;

/** jsdom's location cannot be spied on; swap in a stand-in with just what the code under test touches. */
function setLocation(pathname: string, search = "") {
  Object.defineProperty(window, "location", { configurable: true, value: { pathname, search, assign, reload } });
}

beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
  assign.mockReset();
  reload.mockReset();
  currentPathname = "/dashboard/practice/view";
  setLocation("/dashboard/practice/view");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("useResilientNavigation — Back / Solve can never leave the old screen standing", () => {
  it("starts the normal soft navigation at once and reports it as pending", () => {
    const { result } = renderHook(() => useResilientNavigation());
    expect(result.current.pending).toBe(false);

    act(() => result.current.go("/dashboard/practice"));

    expect(push).toHaveBeenCalledWith("/dashboard/practice");
    expect(result.current.pending).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it("does nothing more when the navigation works — leaving the page cancels the fallback", async () => {
    const { result, unmount } = renderHook(() => useResilientNavigation());

    act(() => result.current.go("/dashboard/practice"));
    unmount(); // what a navigation that landed does to the page it leaves
    await vi.advanceTimersByTimeAsync(NAVIGATION_STUCK_AFTER_MS * 3);

    expect(assign).not.toHaveBeenCalled();
  });

  it("loads the page properly when the soft navigation has not landed after a few seconds", async () => {
    const { result } = renderHook(() => useResilientNavigation());

    act(() => result.current.go("/dashboard/practice"));
    await vi.advanceTimersByTimeAsync(NAVIGATION_STUCK_AFTER_MS - 100);
    expect(assign).not.toHaveBeenCalled(); // still being patient

    await vi.advanceTimersByTimeAsync(200);
    expect(assign).toHaveBeenCalledWith("/dashboard/practice");
  });

  it("ignores a second press while the first is out", () => {
    const { result } = renderHook(() => useResilientNavigation());

    act(() => {
      result.current.go("/dashboard/practice");
      result.current.go("/dashboard/practice");
    });

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("a navigation that lands on the same page with a new query releases the button at once and never reloads", async () => {
    setLocation("/dashboard/interviews", "?domain=backend&stack=laravel");
    const { result } = renderHook(() => useResilientNavigation());

    act(() => result.current.go("/dashboard/interviews?domain=backend"));
    expect(result.current.pending).toBe(true);

    setLocation("/dashboard/interviews", "?domain=backend"); // the router has changed the address in place - nothing unmounted
    await vi.advanceTimersByTimeAsync(200);
    expect(result.current.pending).toBe(false);

    await vi.advanceTimersByTimeAsync(NAVIGATION_STUCK_AFTER_MS * 2);
    expect(assign).not.toHaveBeenCalled();

    // ...and the same button works again straight away (it used to ignore every press after the first)
    act(() => result.current.go("/dashboard/interviews"));
    expect(push).toHaveBeenLastCalledWith("/dashboard/interviews");
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("still falls back to a proper load when the address never changes, even if only the query was asked for", async () => {
    setLocation("/dashboard/interviews", "?domain=backend");
    const { result } = renderHook(() => useResilientNavigation());

    act(() => result.current.go("/dashboard/interviews"));
    await vi.advanceTimersByTimeAsync(NAVIGATION_STUCK_AFTER_MS + 200);

    expect(assign).toHaveBeenCalledWith("/dashboard/interviews");
  });

  it("counts a trailing slash as the same page", async () => {
    setLocation("/dashboard/practice/", "");
    const { result } = renderHook(() => useResilientNavigation());

    act(() => result.current.go("/dashboard/practice"));
    await vi.advanceTimersByTimeAsync(200);

    expect(result.current.pending).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("starts fresh when the browser restores the page from its back/forward cache", async () => {
    const { result } = renderHook(() => useResilientNavigation());
    act(() => result.current.go("/dashboard/practice"));

    act(() => {
      window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    });
    expect(result.current.pending).toBe(false);

    await vi.advanceTimersByTimeAsync(NAVIGATION_STUCK_AFTER_MS * 2);
    expect(assign).not.toHaveBeenCalled(); // the old fallback was cancelled…

    act(() => result.current.go("/dashboard/practice"));
    expect(push).toHaveBeenCalledTimes(2); // …and the button works again
  });
});

describe("RouteSyncGuard — the address bar and the screen must agree", () => {
  it("reloads the address when, after Back, the router is still showing another page", async () => {
    render(<RouteSyncGuard />); // the router thinks we are on /dashboard/practice/view …
    setLocation("/dashboard/practice"); // … but Back has just put the address bar on the list

    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    await vi.advanceTimersByTimeAsync(ROUTE_SYNC_GRACE_MS - 100);
    expect(reload).not.toHaveBeenCalled(); // gives the router its chance first

    await vi.advanceTimersByTimeAsync(200);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the router catches up in time — the normal case costs nothing", async () => {
    const { rerender } = render(<RouteSyncGuard />);
    setLocation("/dashboard/practice");
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });

    await vi.advanceTimersByTimeAsync(800);
    currentPathname = "/dashboard/practice"; // the router lands on the page
    rerender(<RouteSyncGuard />);
    await vi.advanceTimersByTimeAsync(ROUTE_SYNC_GRACE_MS * 2);

    expect(reload).not.toHaveBeenCalled();
  });

  it("treats a trailing slash as the same page", async () => {
    currentPathname = "/dashboard/practice";
    render(<RouteSyncGuard />);
    setLocation("/dashboard/practice/");

    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    await vi.advanceTimersByTimeAsync(ROUTE_SYNC_GRACE_MS * 2);

    expect(reload).not.toHaveBeenCalled();
  });

  it("only ever acts after Back / Forward, never on an ordinary page", async () => {
    render(<RouteSyncGuard />);
    setLocation("/somewhere/else"); // a mismatch, but no popstate

    await vi.advanceTimersByTimeAsync(ROUTE_SYNC_GRACE_MS * 3);

    expect(reload).not.toHaveBeenCalled();
  });

  it("starts the wait over on every Back / Forward and stops when the page goes away", async () => {
    const { unmount } = render(<RouteSyncGuard />);
    setLocation("/dashboard/practice");

    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); });
    await vi.advanceTimersByTimeAsync(2000);
    act(() => { window.dispatchEvent(new PopStateEvent("popstate")); }); // pressed again: a fresh grace period
    await vi.advanceTimersByTimeAsync(2000);
    expect(reload).not.toHaveBeenCalled();

    unmount();
    await vi.advanceTimersByTimeAsync(ROUTE_SYNC_GRACE_MS * 2);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe("the Back arrow", () => {
  const problem = { id: 1, slug: "two-sum", title: "Two Sum", serial_number: 101, difficulty: "easy", tags: [], companies: null, acceptance_rate: "50", total_submissions: 10, solved: true } as unknown as ProblemDetail;

  it("shows it has been pressed — a spinner, busy and locked — while the screen is on its way", () => {
    const onBack = vi.fn();
    const { rerender } = render(<ProblemHeaderBar problem={problem} onBack={onBack} onRun={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to Practice Arena" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(<ProblemHeaderBar problem={problem} onBack={onBack} backPending onRun={vi.fn()} onSubmit={vi.fn()} />);
    const back = screen.getByRole("button", { name: "Back to Practice Arena" }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect(back.getAttribute("aria-busy")).toBe("true");
    expect(back.querySelector("svg.animate-spin")).not.toBeNull();
  });
});
