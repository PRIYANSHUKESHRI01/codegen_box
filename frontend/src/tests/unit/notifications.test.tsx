import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationToaster } from "@/components/notifications/NotificationToaster";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import {
  NOTIFICATION_POLL_MS,
  dismiss,
  markAllRead,
  markRead,
  relativeTime,
  resetNotifications,
  safeInternalPath,
  startNotifications,
  type AppNotification,
} from "@/lib/notifications";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const push = vi.fn();
let pathname = "/dashboard";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: (p: string, b?: unknown) => put(p, b), delete: (p: string) => del(p) } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => pathname }));
// Exit animations never finish under jsdom's fake clock, so animation is stubbed out: what is tested is what is on the page.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const cache = new Map<string, unknown>();
  const motion = new Proxy(
    {},
    {
      // One component per tag — a new type on every access would remount the whole subtree on every render.
      get: (_t, tag: string) => {
        if (!cache.has(tag)) cache.set(tag, make(tag));
        return cache.get(tag);
      },
    }
  );
  function make(tag: string) {
    return React.forwardRef(function MotionStub({ initial, animate, exit, transition, layout, ...rest }: Record<string, unknown>, ref) {
          void initial; void animate; void exit; void transition; void layout;
          return React.createElement(tag, { ...rest, ref });
        });
  }
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children) };
});

let nextId = 100;
const note = (over: Partial<AppNotification> = {}): AppNotification => ({
  id: nextId++,
  type: "drive.live",
  category: "drives",
  severity: "success",
  title: "New drive: Infosys",
  body: "You're eligible — open it to prepare.",
  url: "/dashboard/drives",
  data: {},
  read: false,
  created_at: new Date().toISOString(),
  ...over,
});

/** A tiny fake server: what GET /notifications and /notifications/signal answer right now. */
let server: AppNotification[] = [];
const unreadOf = () => server.filter((n) => !n.read).length;
const newest = () => [...server].sort((a, b) => b.id - a.id);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  server = [];
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
  push.mockReset();
  pathname = "/dashboard";
  get.mockImplementation(async (path: string) => {
    if (path.startsWith("/notifications/signal")) return { unread_count: unreadOf(), latest_id: newest()[0]?.id ?? 0 };
    if (path.startsWith("/notifications?")) return { data: newest().slice(0, 20), next_before: null, unread_count: unreadOf() };
    throw new Error(`unexpected GET ${path}`);
  });
  post.mockImplementation(async (path: string) => {
    const id = Number(path.match(/notifications\/(\d+)\/read/)?.[1]);
    if (id) server = server.map((n) => (n.id === id ? { ...n, read: true } : n));
    if (path.endsWith("/read-all")) server = server.map((n) => ({ ...n, read: true }));
    return { unread_count: unreadOf() };
  });
  del.mockImplementation(async (path: string) => {
    const id = Number(path.match(/notifications\/(\d+)$/)?.[1]);
    server = server.filter((n) => n.id !== id);
    return { unread_count: unreadOf() };
  });
});

afterEach(() => {
  cleanup();
  resetNotifications();
  vi.useRealTimers();
});

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("the live store", () => {
  it("loads once on start, then only fetches the list again when the signal moves", async () => {
    server = [note({ title: "first" })];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);

    expect(screen.getByTestId("notification-badge").textContent).toBe("1");
    const listCalls = () => get.mock.calls.filter((c) => String(c[0]).startsWith("/notifications?")).length;
    expect(listCalls()).toBe(1);

    await tick(NOTIFICATION_POLL_MS + 4_000);
    expect(listCalls()).toBe(1); // a quiet beat is just the cheap signal

    server = [note({ title: "second" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);
    expect(listCalls()).toBe(2);
    expect(screen.getByTestId("notification-badge").textContent).toBe("2");
    stop();
  });

  it("reference-counts starters: two components, one timer, one request in flight", async () => {
    server = [note()];
    const stopA = startNotifications(1);
    const stopB = startNotifications(1);
    await tick(50);

    expect(get.mock.calls.filter((c) => String(c[0]).startsWith("/notifications/signal")).length).toBe(1);
    stopA();
    stopB();
  });

  it("does not poll while the tab is hidden", async () => {
    server = [note()];
    const stop = startNotifications(1);
    await tick(50);
    const before = get.mock.calls.length;

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await tick(NOTIFICATION_POLL_MS * 3);
    expect(get.mock.calls.length).toBe(before);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(get.mock.calls.length).toBeGreaterThan(before);
    stop();
  });

  it("backs off after a failure instead of hammering a struggling API", async () => {
    const stop = startNotifications(1);
    await tick(50);
    get.mockReset();
    get.mockRejectedValue(new Error("down"));

    await tick(NOTIFICATION_POLL_MS * 4);
    const attempts = get.mock.calls.length;
    expect(attempts).toBeLessThanOrEqual(3); // doubling each time, not one every 15 s
    stop();
  });

  it("a different account signing in starts from nothing — none of the last one's notifications linger", async () => {
    server = [note({ title: "belongs to user 1" })];
    render(<NotificationBell />);
    let stop = startNotifications(1);
    await tick(50);
    expect(screen.getByTestId("notification-badge")).toBeTruthy();
    stop();

    server = [];
    stop = startNotifications(2);
    await tick(50);
    expect(screen.queryByTestId("notification-badge")).toBeNull();
    stop();
  });
});

describe("reading and dismissing", () => {
  it("marks one read optimistically and settles on the server's count", async () => {
    server = [note({ title: "a" }), note({ title: "b" })];
    const stop = startNotifications(1);
    await tick(50);
    const target = newest()[0];

    const p = markRead(target.id);
    expect(post).toHaveBeenCalledWith(`/notifications/${target.id}/read`, undefined);
    await p;
    await tick(10);
    expect(unreadOf()).toBe(1);
    stop();
  });

  it("puts things back when the server refuses (e.g. a read-only view-as session)", async () => {
    server = [note({ title: "a" })];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);
    post.mockRejectedValueOnce(new Error("impersonation_read_only"));

    await act(async () => {
      await markRead(server[0].id);
    });
    await tick(50);

    expect(screen.getByTestId("notification-badge").textContent).toBe("1");
    stop();
  });

  it("mark-all-read and dismiss update the badge at once", async () => {
    server = [note(), note(), note()];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);
    expect(screen.getByTestId("notification-badge").textContent).toBe("3");

    await act(async () => {
      await dismiss(server[0].id);
    });
    expect(screen.getByTestId("notification-badge").textContent).toBe("2");

    await act(async () => {
      await markAllRead();
    });
    expect(screen.queryByTestId("notification-badge")).toBeNull();
    stop();
  });
});

describe("the bell", () => {
  it("shows the unread count, says so to screen readers, and caps it at 99+", async () => {
    server = Array.from({ length: 120 }, () => note());
    get.mockImplementation(async (path: string) =>
      path.startsWith("/notifications/signal")
        ? { unread_count: 120, latest_id: newest()[0].id }
        : { data: newest().slice(0, 20), next_before: 1, unread_count: 120 }
    );
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);

    expect(screen.getByTestId("notification-badge").textContent).toBe("99+");
    expect(screen.getByRole("button", { name: "Notifications, 120 unread" })).toBeTruthy();
    stop();
  });

  it("opens a popover with the latest, goes where a notification points, and marks it read", async () => {
    server = [note({ title: "Drive for you", url: "/dashboard/drives" })];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    const dialog = await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Drive for you/ }));

    expect(push).toHaveBeenCalledWith("/dashboard/drives");
    await tick(20);
    expect(server[0].read).toBe(true);
    stop();
  });

  it("never follows a link that leaves the app", async () => {
    server = [note({ title: "Sneaky", url: "https://evil.example/phish" }), note({ title: "Script", url: "javascript:alert(1)" })];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Sneaky/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /^Script/ }));

    expect(push).not.toHaveBeenCalled();
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("/ok/path?x=1")).toBe("/ok/path?x=1");
    stop();
  });

  it("is a calm empty state, not a blank box, when there is nothing", async () => {
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/all caught up/i)).toBeTruthy();
    stop();
  });

  it("closes on Escape", async () => {
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    await tick(1_000); // the popover's exit animation

    expect(screen.queryByRole("dialog")).toBeNull();
    stop();
  });

  it("dismisses a single notification from its row", async () => {
    server = [note({ title: "Remove me" })];
    render(<NotificationBell />);
    const stop = startNotifications(1);
    await tick(50);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Remove me" }));
    await tick(20);

    expect(del).toHaveBeenCalled();
    expect(screen.queryByText("Remove me")).toBeNull();
    stop();
  });
});

describe("toasts for what arrives while you are on the page", () => {
  const mountLive = async () => {
    server = [note({ title: "Already here" })];
    render(
      <>
        <NotificationBell />
        <NotificationToaster />
      </>
    );
    const stop = startNotifications(1);
    await tick(50);
    return stop;
  };

  it("stays silent about what was already there on load, then slides in what arrives", async () => {
    const stop = await mountLive();
    expect(screen.queryByRole("status")).toBeNull();

    server = [note({ title: "Hackathon opens for you", type: "hackathon.published", category: "hackathons", severity: "info", url: "/arena" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    expect(within(screen.getByRole("status")).getByText("Hackathon opens for you")).toBeTruthy();
    stop();
  });

  it("clicking a toast goes there and marks it read", async () => {
    const stop = await mountLive();
    const fresh = note({ title: "Round 2 scheduled", url: "/dashboard/drives" });
    server = [fresh, ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    fireEvent.click(within(screen.getByRole("status")).getByText("Round 2 scheduled"));

    expect(push).toHaveBeenCalledWith("/dashboard/drives");
    await tick(20);
    expect(server.find((n) => n.id === fresh.id)?.read).toBe(true);
    stop();
  });

  it("leaves by itself after a few seconds, but stays in the bell", async () => {
    const stop = await mountLive();
    server = [note({ title: "Brief visit" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);
    expect(screen.getByText("Brief visit")).toBeTruthy();

    await tick(9_000);
    await tick(1_000); // the toast's exit animation

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("notification-badge").textContent).toBe("2");
    stop();
  });

  it("collapses a flood into one summary instead of a pile", async () => {
    const stop = await mountLive();
    server = [...Array.from({ length: 6 }, (_, i) => note({ title: `Flood ${i}` })), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("6 new notifications")).toBeTruthy();
    stop();
  });

  it("steps aside while the bell is open — the list is updating right there, and the toast would sit on top of it", async () => {
    const stop = await mountLive();
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await screen.findByRole("dialog");

    server = [note({ title: "Arrived with the bell open" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    expect(screen.queryByRole("status")).toBeNull();
    expect(within(screen.getByRole("dialog")).getByText("Arrived with the bell open")).toBeTruthy();
    stop();
  });

  it("is silent on a proctored exam page", async () => {
    pathname = "/dashboard/contests/problem";
    const stop = await mountLive();
    server = [note({ title: "Do not disturb" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    expect(screen.queryByText("Do not disturb")).toBeNull();
    stop();
  });

  it("plan changes appear in the bell but do not toast twice (the plan watcher already does)", async () => {
    const stop = await mountLive();
    server = [note({ title: "Your plan changed", type: "plan.changed", category: "plan" }), ...server];
    await tick(NOTIFICATION_POLL_MS + 4_000);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("notification-badge").textContent).toBe("2");
    stop();
  });
});

describe("preferences", () => {
  const prefs = (over: Record<string, boolean> = {}) => [
    { category: "drives", label: "Placement drives", description: "A drive goes live for you.", mandatory: false, enabled: over.drives ?? true },
    { category: "plan", label: "Plans & payments", description: "Your plan changes.", mandatory: true, enabled: true },
  ];

  it("shows a switch per kind, 'always on' for the ones that cannot be muted, and saves as you flip", async () => {
    const toast = vi.fn();
    get.mockResolvedValueOnce({ categories: prefs() });
    put.mockResolvedValueOnce({ categories: prefs({ drives: false }) });
    render(<NotificationPreferences onToast={toast} />);

    const toggle = await screen.findByRole("switch", { name: "Placement drives" });
    expect(screen.getByText("Always on")).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Plans & payments" })).toBeNull();

    fireEvent.click(toggle);

    await waitFor(() => expect(put).toHaveBeenCalledWith("/notifications/preferences", { categories: { drives: false } }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Placement drives notifications off."));
    expect(screen.getByRole("switch", { name: "Placement drives" }).getAttribute("aria-checked")).toBe("false");
  });

  it("puts the switch back and says so when the save fails", async () => {
    const toast = vi.fn();
    get.mockResolvedValueOnce({ categories: prefs() });
    put.mockRejectedValueOnce(new Error("offline"));
    render(<NotificationPreferences onToast={toast} />);

    fireEvent.click(await screen.findByRole("switch", { name: "Placement drives" }));

    // Said as an error, so it shows as one (red, announced assertively) rather than as another success.
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Couldn't save that. Try again.", "error"));
    expect(screen.getByRole("switch", { name: "Placement drives" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("helpers", () => {
  it("words time briefly", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(relativeTime("2026-10-22T11:59:30Z", now)).toBe("now");
    expect(relativeTime("2026-10-22T11:55:00Z", now)).toBe("5m");
    expect(relativeTime("2026-10-22T09:00:00Z", now)).toBe("3h");
    expect(relativeTime("2026-10-20T12:00:00Z", now)).toBe("2d");
  });
});
