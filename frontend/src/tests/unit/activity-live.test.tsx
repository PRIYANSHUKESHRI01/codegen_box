import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityTracker, scrollDepthOf } from "@/lib/activityTracker";
import { LivePanel } from "@/components/admin/superadmin/activity/LivePanel";
import { CollegesPanel } from "@/components/admin/superadmin/activity/CollegesPanel";
import { CollegeDetail } from "@/components/admin/superadmin/activity/CollegeDetail";
import { PersonDrawer } from "@/components/admin/superadmin/activity/PersonDrawer";
import { MyRewards, WeeklyRewardsBanner } from "@/components/leaderboard/WeeklyRewardsBanner";

const get = vi.fn();
const post = vi.fn();
const impersonation = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown, i?: unknown) => post(p, b, i), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/impersonation", () => ({ getImpersonation: () => impersonation() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  impersonation.mockReset();
  impersonation.mockReturnValue(null);
  sessionStorage.clear();
});

// ───────────────────────────────────────────────────────────────────────────── the browser's reports

describe("the activity tracker", () => {
  const visible = (state: "visible" | "hidden") => Object.defineProperty(document, "visibilityState", { value: state, configurable: true });

  beforeEach(() => {
    vi.useFakeTimers();
    visible("visible");
    post.mockResolvedValue({ next_in: 60 });
  });

  const lastBody = () => post.mock.calls[post.mock.calls.length - 1][1] as { visit: string; events: { seq: number; path: string; tab?: string; seconds: number; scroll: number; age: number }[] };

  it("reports the first screen a few seconds after it opens, with a visit id and nothing but the path", async () => {
    const tracker = new ActivityTracker();
    tracker.start();
    tracker.navigate("/dashboard/core", null);

    expect(post).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe("/me/activity");
    expect(post.mock.calls[0][2]).toEqual({ keepalive: true });
    const body = lastBody();
    expect(body.visit).toMatch(/^v[0-9a-f]{24}$/);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ seq: 1, path: "/dashboard/core", scroll: 0 });
    expect(JSON.stringify(body)).not.toContain("?");
    tracker.stop();
  });

  it("counts only the seconds in which the person did something, and reports the running total each minute", async () => {
    const tracker = new ActivityTracker();
    tracker.start();
    tracker.navigate("/admin/placements", "drives");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    // 20 s of using the page, then a pause longer than the 90 s engagement window.
    for (let i = 0; i < 4; i++) {
      fireEvent.pointerDown(document.body);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });

    const body = lastBody();
    expect(body.events[body.events.length - 1]).toMatchObject({ seq: 1, path: "/admin/placements", tab: "drives" });
    // Active for ~20 s plus the 90 s window after the last touch: never the full 5 minutes of silence.
    expect(body.events[body.events.length - 1].seconds).toBeGreaterThan(15);
    expect(body.events[body.events.length - 1].seconds).toBeLessThan(130);
    tracker.stop();
  });

  it("a second screen is its own page in the same visit", async () => {
    const tracker = new ActivityTracker();
    tracker.start();
    tracker.navigate("/dashboard", null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    const visit = lastBody().visit;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    tracker.navigate("/dashboard/contests", null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });

    const body = lastBody();
    expect(body.visit).toBe(visit);
    expect(body.events.map((e) => [e.seq, e.path])).toContainEqual([2, "/dashboard/contests"]);
    tracker.stop();
  });

  it("says nothing while the tab is hidden, but reports once as it is hidden", async () => {
    const tracker = new ActivityTracker();
    tracker.start();
    tracker.navigate("/dashboard", null);
    visible("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(post).not.toHaveBeenCalled();

    visible("visible");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    tracker.navigate("/dashboard/core", null);
    visible("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(post.mock.calls.length).toBeGreaterThanOrEqual(1);
    tracker.stop();
  });

  it("never reports a superadmin's view-as session, and never makes a sound when the server is down", async () => {
    impersonation.mockReturnValue({ viewing: { id: 5 } });
    const tracker = new ActivityTracker();
    tracker.start();
    tracker.navigate("/dashboard", null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(post).not.toHaveBeenCalled();
    tracker.stop();

    impersonation.mockReturnValue(null);
    post.mockRejectedValue(new Error("offline"));
    const again = new ActivityTracker();
    again.start();
    again.navigate("/dashboard", null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(post).toHaveBeenCalledTimes(1);
    again.stop();
  });

  it("reads how far down a scroll area has been seen, and ignores the sidebar", () => {
    const area = document.createElement("div");
    Object.defineProperty(area, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(area, "clientHeight", { value: 500, configurable: true });
    area.scrollTop = 750;
    document.body.appendChild(area);
    expect(scrollDepthOf(area)).toBe(63); // (750 + 500) / 2000

    const aside = document.createElement("aside");
    const nav = document.createElement("div");
    Object.defineProperty(nav, "scrollHeight", { value: 2000, configurable: true });
    Object.defineProperty(nav, "clientHeight", { value: 500, configurable: true });
    aside.appendChild(nav);
    document.body.appendChild(aside);
    expect(scrollDepthOf(nav)).toBeNull();

    const short = document.createElement("div");
    Object.defineProperty(short, "scrollHeight", { value: 520, configurable: true });
    Object.defineProperty(short, "clientHeight", { value: 500, configurable: true });
    expect(scrollDepthOf(short)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────── the superadmin's screens

const pulse = {
  as_of: "2026-11-04T06:30:00Z",
  timezone: "Asia/Kolkata",
  online: { total: 14, by_role: { user: 12, admin_tpo: 2 }, window_seconds: 150 },
  active: { last_15_minutes: 18, today: 96, yesterday: 80, this_week: 210, last_7_days: 240, last_30_days: 700 },
  today: { sessions: 120, avg_minutes: 11.5, sign_ins: 44, failed_sign_ins: 3, accounts_activated: 2, demo_logins_opened: 4 },
  sections_now: [{ section: "Core Prep · Practice", users: 6 }],
  colleges_now: [{ id: 9, name: "Apex Institute", users: 5 }],
};

const live = {
  pulse,
  hourly: Array.from({ length: 24 }, (_, i) => ({ hour: `2026-11-04T${String(i).padStart(2, "0")}:00:00Z`, label: `${i}h`, users: i })),
  daily: Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, users: i, students: i, visits: i, minutes: i })),
  weekly: [{ week: "2026-10-26", users: 200, current: false }, { week: "2026-11-02", users: 210, current: true }],
  online: {
    total: 14,
    rows: [
      { user_id: 31, name: "Asha Rao", email: "asha@apex.test", role: "user", college_id: 9, college: "Apex Institute", section: "Core Prep · Practice", path: "/dashboard/core/practice", since: "2026-11-04T06:10:00Z", last_seen_at: "2026-11-04T06:29:00Z", active_minutes: 18, pages: 4, device: "mobile", browser: "Chrome", os: "Android" },
    ],
  },
};

describe("Live Activity → Live now", () => {
  it("shows who is online and how many came today, this week and this month", async () => {
    get.mockResolvedValue(live);
    render(<LivePanel onOpenPerson={vi.fn()} onOpenCollege={vi.fn()} />);

    expect(await screen.findByText("Online now")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText("12 students · 2 tpos")).toBeTruthy();
    expect(screen.getByText("96")).toBeTruthy();
    expect(screen.getByText("Yesterday 80")).toBeTruthy();
    expect(screen.getByText("Last 7 days 240")).toBeTruthy();
    expect(screen.getByText("700")).toBeTruthy();
    expect(screen.getByText("3 failed attempts")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // demo logins opened today
    expect(get).toHaveBeenCalledWith("/superadmin/activity/live");
  });

  it("lists the people online with what they are looking at, and opens one on click", async () => {
    get.mockResolvedValue(live);
    const onOpenPerson = vi.fn();
    const onOpenCollege = vi.fn();
    render(<LivePanel onOpenPerson={onOpenPerson} onOpenCollege={onOpenCollege} />);

    const row = (await screen.findByText("Asha Rao")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Core Prep · Practice")).toBeTruthy();
    expect(within(row).getByText("Apex Institute")).toBeTruthy();
    fireEvent.click(row);
    expect(onOpenPerson).toHaveBeenCalledWith(31);

    fireEvent.click(screen.getByRole("button", { name: /Apex Institute/ }));
    expect(onOpenCollege).toHaveBeenCalledWith(9);
  });

  it("narrows everything to one kind of account", async () => {
    get.mockResolvedValue(live);
    render(<LivePanel onOpenPerson={vi.fn()} onOpenCollege={vi.fn()} />);
    await screen.findByText("Online now");

    fireEvent.click(screen.getByRole("tab", { name: "TPOs" }));

    await waitFor(() => expect(get).toHaveBeenCalledWith("/superadmin/activity/live?role=admin_tpo"));
  });

  it("says so, with a retry, when it cannot load", async () => {
    get.mockRejectedValue(new Error("offline"));
    render(<LivePanel onOpenPerson={vi.fn()} onOpenCollege={vi.fn()} />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

const tpo = (over: Record<string, unknown> = {}) => ({ id: 70, name: "Dr. Rao", email: "tpo@quiet.test", state: "not_opened", state_label: "Login not opened yet", issued_at: new Date(Date.now() - 6 * 86400000).toISOString(), last_seen_at: null, ...over });

const directory = {
  total: 2,
  page: 1,
  per_page: 25,
  counts: { not_opened: 1, active: 1 },
  rows: [
    { id: 1, name: "Quiet Demo College", code: "QDC", city: "Pune", is_active: true, status: "not_opened", status_label: "Login not opened yet", plan: { name: "Academic Enterprise", is_demo: true, ends_at: "2026-11-20T00:00:00Z", days_left: 16 }, tpos: [tpo()], students: { total: 40, activated: 0, ever_seen: 0, active_7d: 0 }, online_now: 0, last_activity_at: null },
    { id: 2, name: "Busy College", code: "BSY", city: "Delhi", is_active: true, status: "active", status_label: "Active", plan: null, tpos: [tpo({ id: 71, email: "tpo@busy.test", state: "active" })], students: { total: 120, activated: 100, ever_seen: 90, active_7d: 60 }, online_now: 3, last_activity_at: new Date().toISOString() },
  ],
};

describe("Live Activity → Colleges & logins", () => {
  it("tells an unopened demo login from an active college, and counts each state", async () => {
    get.mockResolvedValue(directory);
    const onOpenCollege = vi.fn();
    render(<CollegesPanel onOpenCollege={onOpenCollege} />);

    const quiet = (await screen.findByText("Quiet Demo College")).closest("tr") as HTMLElement;
    expect(within(quiet).getByText("Login not opened yet")).toBeTruthy();
    expect(within(quiet).getByText(/tpo@quiet.test/)).toBeTruthy();
    expect(within(quiet).getByText(/Demo · 16 d left/)).toBeTruthy();

    const busy = screen.getByText("Busy College").closest("tr") as HTMLElement;
    expect(within(busy).getByText("Active")).toBeTruthy();
    expect(within(busy).getByText("100 set password · 60 active this week")).toBeTruthy();

    expect(screen.getByRole("button", { name: /All\s*2/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Login not opened\s*1/ })).toBeTruthy();

    fireEvent.click(quiet);
    expect(onOpenCollege).toHaveBeenCalledWith(1);
  });

  it("filters by login status through the server", async () => {
    get.mockResolvedValue(directory);
    render(<CollegesPanel onOpenCollege={vi.fn()} />);
    await screen.findByText("Quiet Demo College");

    fireEvent.click(screen.getByRole("button", { name: /Login not opened\s*1/ }));

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("status=not_opened")));
  });
});

const account = (over: Record<string, unknown> = {}) => ({
  user: { id: 70, name: "Dr. Rao", email: "tpo@quiet.test", role: "admin_tpo", roll_number: null },
  state: "tried",
  state_label: "Tried the login, no password yet",
  created_at: "2026-10-28T05:00:00Z",
  first_tried_at: "2026-10-30T09:00:00Z",
  password_set_at: null,
  first_signin_at: null,
  last_signin_at: null,
  last_seen_at: null,
  sign_ins: 0,
  failed_attempts: 2,
  visits: 0,
  page_views: 0,
  active_seconds: 0,
  device: "desktop",
  browser: "Chrome",
  os: "Windows",
  ...over,
});

describe("Live Activity → one college", () => {
  const detail = {
    college: { id: 1, name: "Quiet Demo College", code: "QDC", city: "Pune", state: "MH", is_active: true, plan: { name: "Academic Enterprise", is_demo: true, ends_at: null, days_left: 9 } },
    status: "tried",
    status_label: "Tried the login, no password yet",
    accounts: [account()],
    students: { total: 40, activated: 10, ever_seen: 8, active_7d: 5 },
    online_now: 0,
    daily: Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`, users: 0, students: 0, visits: 0, minutes: 0 })),
    sections: [{ section: "Students", views: 12, users: 3, avg_seconds: 95, avg_scroll: 70, last_at: new Date().toISOString() }],
    recent: [{ kind: "auth", user_id: 70, name: "Dr. Rao", role: "admin_tpo", what: "temp_password", reason: null, at: new Date().toISOString() }],
    days: 30,
  };

  beforeEach(() => {
    get.mockImplementation((path: string) => Promise.resolve(path.includes("/people") ? { total: 0, page: 1, per_page: 10, rows: [] } : detail));
  });

  it("shows each step of the login's road with its date, and 'not yet' for the ones that have not happened", async () => {
    render(<CollegeDetail collegeId={1} onBack={vi.fn()} onOpenPerson={vi.fn()} />);

    expect((await screen.findAllByText("Dr. Rao")).length).toBeGreaterThan(0);
    const steps = screen.getByText("Login issued").closest("ol") as HTMLElement;
    expect(within(steps).getByText("Opened the login")).toBeTruthy();
    // Chose a password, first signed in, last seen: three steps that have not happened.
    expect(within(steps).getAllByText("not yet")).toHaveLength(3);
    expect(screen.getByText(/2 failed sign-in attempts/)).toBeTruthy();
  });

  it("shows how far the roster has come, which screens are used and how far down people read", async () => {
    render(<CollegeDetail collegeId={1} onBack={vi.fn()} onOpenPerson={vi.fn()} />);

    expect(await screen.findByText("Chose their password")).toBeTruthy();
    expect(screen.getByText("Ever signed in")).toBeTruthy();
    const row = screen.getByText("Students", { selector: "td" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("1 min 35 s".replace("1 min 35 s", "2 min"))).toBeTruthy();
    expect(within(row).getByText("70%")).toBeTruthy();
    expect(screen.getByText("Opened the login (one-time password)")).toBeTruthy();
  });

  it("opens the person on click and goes back to the list", async () => {
    const onOpenPerson = vi.fn();
    const onBack = vi.fn();
    render(<CollegeDetail collegeId={1} onBack={onBack} onOpenPerson={onOpenPerson} />);

    fireEvent.click((await screen.findAllByRole("button", { name: /Dr\. Rao/ }))[0]);
    expect(onOpenPerson).toHaveBeenCalledWith(70);
    fireEvent.click(screen.getByRole("button", { name: /All colleges/ }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("Live Activity → one person", () => {
  const person = {
    user: { id: 31, name: "Asha Rao", email: "asha@apex.test", role: "user", roll_number: "A-12", college: "Apex Institute", is_blocked: false },
    facts: { state: "active", state_label: "Active", created_at: "2026-10-01T05:00:00Z", first_tried_at: "2026-10-02T05:00:00Z", password_set_at: "2026-10-02T05:10:00Z", first_signin_at: "2026-10-02T05:15:00Z", last_signin_at: "2026-11-04T05:00:00Z", last_seen_at: new Date().toISOString(), sign_ins: 5, failed_attempts: 1, visits: 4, page_views: 11, active_seconds: 2400 },
    online_now: true,
    events: [{ event: "login", reason: null, portal: "user", device: "desktop", browser: "Chrome", os: "Windows", ip: "10.0.0.1", at: "2026-11-04T05:00:00Z" }],
    visits: [
      { id: 1, started_at: "2026-11-04T05:00:00Z", last_seen_at: "2026-11-04T05:30:00Z", active_minutes: 22, pages: 2, device: "desktop", browser: "Chrome", os: "Windows", ip: "10.0.0.1", views: [{ section: "Core Prep · Practice", path: "/dashboard/core/practice", at: "2026-11-04T05:02:00Z", seconds: 600, scroll: 85 }] },
    ],
    sections: [{ section: "Core Prep · Practice", views: 6, seconds: 3000, avg_scroll: 80, last_at: "2026-11-04T05:02:00Z" }],
  };

  it("shows the road from issued login to today, every section used and each screen of the latest visit", async () => {
    get.mockResolvedValue(person);
    const onClose = vi.fn();
    render(<PersonDrawer userId={31} onClose={onClose} />);

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Online now")).toBeTruthy();
    expect(screen.getByText("Chose their own password")).toBeTruthy();
    expect(screen.getAllByText("Core Prep · Practice").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("85%")).toBeTruthy();
    expect(screen.getByText("Signed in")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/superadmin/activity/users/31");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────── the student's side

const WEEK = { key: "2026-11-02", starts_at: "2026-11-01T18:30:00Z", resets_at: "2099-11-08T18:30:00Z" };
const NEXT = { key: "2026-11-09", starts_at: "2099-11-08T18:30:00Z", resets_at: "2099-11-15T18:30:00Z" };
const burger = { key: "burger_king", brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", tagline: "A Whopper meal on us", rank: 1 };

describe("the student's rewards", () => {
  it("tells students what next week offers while nothing is live yet", async () => {
    get.mockResolvedValue({ live: false, week: WEEK, prizes: [], my: null, next: { week: NEXT, prizes: [burger] } });
    render(<WeeklyRewardsBanner variant="compact" />);

    const teaser = await screen.findByLabelText("Next week's leaderboard rewards");
    expect(within(teaser).getByText("Burger King")).toBeTruthy();
    expect(within(teaser).getByText(/Starts Monday/)).toBeTruthy();
  });

  it("mentions next week under this week's live prizes", async () => {
    get.mockResolvedValue({ live: true, week: WEEK, prizes: [burger], my: { rank: null, contest_score: 0, prize: null }, next: { week: NEXT, prizes: [{ ...burger, key: "kfc", brand: "KFC", amount: 399 }] } });
    render(<WeeklyRewardsBanner variant="compact" />);

    expect(await screen.findByText(/Next week: KFC ₹399/)).toBeTruthy();
  });

  it("shows a student their own wins, with the code only once it has been sent", async () => {
    get.mockResolvedValue({
      wins: [
        { id: 1, week_key: "2026-10-26", rank: 1, brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", status: "sent", voucher_code: "BK-1234-ABCD", sent_at: "2026-11-03T05:00:00Z" },
        { id: 2, week_key: "2026-10-19", rank: 2, brand: "Zomato", amount: 399, logo: "/rewards/zomato.svg", color: "#E23744", status: "pending", voucher_code: null, sent_at: null },
      ],
    });
    render(<MyRewards />);

    expect(await screen.findByText("Your rewards")).toBeTruthy();
    expect(screen.getByText("BK-1234-ABCD")).toBeTruthy();
    expect(screen.getByText("We're sending it")).toBeTruthy();
    expect(screen.queryByText("BK-0000")).toBeNull();
  });

  it("draws nothing until the student has won something", async () => {
    get.mockResolvedValue({ wins: [] });
    const { container } = render(<MyRewards />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/weekly-rewards/mine"));
    expect(container.innerHTML).toBe("");
  });
});
