import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/Toaster";
import { MAX_VISIBLE_TOASTS, getToasts, resetToasts, toast } from "@/lib/toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  resetToasts();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("<Toaster />", () => {
  it("is a labelled region that holds nothing until something is raised", () => {
    render(<Toaster />);
    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a success politely and an error assertively, and says which it is to a screen reader", () => {
    render(<Toaster />);
    act(() => {
      toast.success("Profile saved.");
      toast.error("Couldn't publish.");
    });

    const ok = screen.getByRole("status");
    expect(ok.textContent).toContain("Success");
    expect(ok.textContent).toContain("Profile saved.");

    const bad = screen.getByRole("alert");
    expect(bad.textContent).toContain("Error");
    expect(bad.textContent).toContain("Couldn't publish.");
  });

  it("treats a warning as something to be heard, not a success", () => {
    render(<Toaster />);
    act(() => void toast.warning("Select a college first."));
    expect(screen.getByRole("alert").textContent).toContain("Warning");
  });

  it("shows a title above the message when it has one", () => {
    render(<Toaster />);
    act(() => void toast.info("Everything it includes is unlocked.", { title: "Your plan is now Expert" }));

    expect(screen.getByText("Your plan is now Expert")).toBeTruthy();
    expect(screen.getByText("Everything it includes is unlocked.")).toBeTruthy();
  });

  it("leaves by itself once its time is up", () => {
    render(<Toaster />);
    act(() => void toast.success("Saved.", { duration: 3000 }));
    expect(getToasts()).toHaveLength(1);

    advance(2900);
    expect(getToasts()).toHaveLength(1);
    advance(200);
    expect(getToasts()).toHaveLength(0);
  });

  it("holds still while the pointer is on it, and carries on with what was left once it moves away", () => {
    render(<Toaster />);
    act(() => void toast.success("Saved.", { duration: 5000 }));
    const card = screen.getByRole("status");

    advance(3000);
    fireEvent.mouseEnter(card);
    advance(20_000);
    expect(getToasts()).toHaveLength(1);

    fireEvent.mouseLeave(card);
    advance(1900);
    expect(getToasts()).toHaveLength(1);
    advance(300);
    expect(getToasts()).toHaveLength(0);
  });

  it("holds still while keyboard focus is inside it", () => {
    render(<Toaster />);
    act(() => void toast.error("Couldn't save.", { duration: 3000 }));

    fireEvent.focus(screen.getByRole("button", { name: "Dismiss" }));
    advance(30_000);
    expect(getToasts()).toHaveLength(1);
  });

  it("does not run out its clock while the tab is in the background", () => {
    render(<Toaster />);
    act(() => void toast.success("Saved.", { duration: 3000 }));

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    advance(60_000);
    expect(getToasts()).toHaveLength(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    advance(3500);
    expect(getToasts()).toHaveLength(0);
  });

  it("closes from its own X, and from Escape while focus is on it", () => {
    render(<Toaster />);
    act(() => {
      toast.success("First.", { duration: Infinity });
      toast.success("Second.", { duration: Infinity });
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(getToasts().map((t) => t.message)).toEqual(["Second."]);

    // (the first card is still playing its exit animation in the DOM, so find the live one by its text)
    fireEvent.keyDown(screen.getByText("Second.").closest("[role=status]")!, { key: "Escape" });
    expect(getToasts()).toHaveLength(0);
  });

  it("shows ×N instead of a pile when the same message is raised again", () => {
    render(<Toaster />);
    act(() => {
      toast.success("Exported.");
      toast.success("Exported.");
      toast.success("Exported.");
    });

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("×3")).toBeTruthy();
  });

  it("restarts the clock when the same message is raised again", () => {
    render(<Toaster />);
    act(() => void toast.success("Exported.", { duration: 4000, id: "exp" }));
    advance(3000);
    act(() => void toast.success("Exported.", { duration: 4000, id: "exp" }));
    advance(3000);
    expect(getToasts()).toHaveLength(1);
    advance(1100);
    expect(getToasts()).toHaveLength(0);
  });

  it("runs an action and then closes", () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() => void toast.success("Moved to Interview.", { duration: Infinity, action: { label: "Undo", onClick: undo } }));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(getToasts()).toHaveLength(0);
  });

  it("renders a link action as a link", () => {
    render(<Toaster />);
    act(() => void toast.info("Your plan changed.", { duration: Infinity, action: { label: "See what's included", href: "/dashboard/billing" } }));

    expect(screen.getByRole("link", { name: "See what's included" }).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("keeps a sticky toast until it is dismissed", () => {
    render(<Toaster />);
    act(() => void toast.warning("Reconnecting…", { duration: Infinity }));
    advance(10 * 60_000);
    expect(getToasts()).toHaveLength(1);
  });

  it(`caps the stack at ${MAX_VISIBLE_TOASTS}`, () => {
    render(<Toaster />);
    act(() => {
      for (let i = 0; i < MAX_VISIBLE_TOASTS + 3; i++) toast.success(`Toast ${i}`, { duration: Infinity });
    });
    expect(getToasts()).toHaveLength(MAX_VISIBLE_TOASTS);
  });
});
