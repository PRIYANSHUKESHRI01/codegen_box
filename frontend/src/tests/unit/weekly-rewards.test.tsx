import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklyRewardsBanner } from "@/components/leaderboard/WeeklyRewardsBanner";
import { WeeklyRewardsPanel } from "@/components/admin/superadmin/WeeklyRewardsPanel";
import LeaderboardPage from "@/app/dashboard/leaderboard/page";

const get = vi.fn();
const put = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (p: string) => get(p),
      post: (p: string, b?: unknown) => post(p, b),
      put: (p: string, b?: unknown) => put(p, b),
      patch: (p: string, b?: unknown) => patch(p, b),
      delete: vi.fn(),
    },
  };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ user: { id: 7, role: "user", college: { name: "Alpha" } }, status: "ready" }) }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) => (
    <main aria-label={title}>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));
vi.mock("@/components/contests/DailyChallenge", () => ({ DailyChallengeBoard: () => <div>daily board</div> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const WEEK = { key: "2026-11-02", starts_at: "2026-11-01T18:30:00Z", resets_at: "2099-11-08T18:30:00Z" };
const burger = { key: "burger_king", brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", tagline: "A Whopper meal on us" };
const dominos = { key: "dominos", brand: "Domino's", amount: 299, logo: "/rewards/dominos.svg", color: "#006491", tagline: "Pizza night, sorted" };

const banner = (over: Record<string, unknown> = {}) => ({
  live: true,
  week: WEEK,
  prizes: [
    { ...burger, rank: 1 },
    { ...dominos, rank: 2 },
  ],
  my: { rank: 5, contest_score: 120, prize: null },
  ...over,
});

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  post.mockReset();
  patch.mockReset();
});
afterEach(cleanup);

describe("the weekly rewards banner", () => {
  it("draws nothing while no voucher is live", async () => {
    get.mockResolvedValue(banner({ live: false, prizes: [] }));
    const { container } = render(<WeeklyRewardsBanner />);

    await waitFor(() => expect(get).toHaveBeenCalledWith("/weekly-rewards"));
    expect(container.querySelector("section")).toBeNull();
  });

  it("draws nothing when the request fails, so a page never shows an empty promise", async () => {
    get.mockRejectedValue(new Error("offline"));
    const { container } = render(<WeeklyRewardsBanner />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
  });

  it("shows each live voucher with the rank it is for, and where the student stands", async () => {
    get.mockResolvedValue(banner());
    render(<WeeklyRewardsBanner />);

    const region = await screen.findByRole("region", { name: /weekly leaderboard rewards/i });
    expect(within(region).getByText("Burger King")).toBeTruthy();
    expect(within(region).getByText("₹499 voucher")).toBeTruthy();
    expect(within(region).getByText("Rank #1")).toBeTruthy();
    expect(within(region).getByText("Rank #2")).toBeTruthy();
    expect(within(region).getByText(/with 120 pts this week/)).toBeTruthy();
  });

  it("tells the student which voucher their current rank wins", async () => {
    get.mockResolvedValue(banner({ my: { rank: 2, contest_score: 300, prize: { ...dominos, rank: 2 } } }));
    render(<WeeklyRewardsBanner />);

    expect(await screen.findByText(/right now that wins the/)).toBeTruthy();
    expect(screen.getAllByText("Domino's").length).toBeGreaterThan(0);
  });

  it("invites a student who has not scored to get on the board", async () => {
    get.mockResolvedValue(banner({ my: { rank: null, contest_score: 0, prize: null } }));
    render(<WeeklyRewardsBanner />);

    expect(await screen.findByText(/not on this week's board yet/)).toBeTruthy();
  });
});

const card = (c: typeof burger, over: Record<string, unknown> = {}) => ({ ...c, live: false, prize_rank: null, ...over });

const NEXT_WEEK = { key: "2026-11-09", starts_at: "2026-11-08T18:30:00Z", resets_at: "2099-11-15T18:30:00Z" };
const flags = (w: typeof WEEK, f: { is_current?: boolean; is_future?: boolean } = {}) => ({ ...w, is_current: !!f.is_current, is_past: false, is_future: !!f.is_future });

const daily = (over: Record<string, unknown> = {}) => ({
  name: "AptRun Daily Challenge",
  start_label: "8:00 PM IST",
  duration_minutes: 60,
  timezone: "Asia/Kolkata",
  next_start_at: "2026-11-04T14:30:00Z",
  scheduled: true,
  next: {
    title: "AptRun Daily Challenge — 04 Nov 2026",
    slug: "aptrun-daily-challenge-2026-11-04",
    start_at: "2026-11-04T14:30:00Z",
    end_at: "2026-11-04T15:30:00Z",
    state: "upcoming",
    finalized: false,
    registered: 12,
    scored: 0,
    problems: [
      { title: "Two Sum", difficulty: "easy", points: 100 },
      { title: "Merge Intervals", difficulty: "medium", points: 200 },
      { title: "Word Ladder", difficulty: "hard", points: 300 },
    ],
    registration: { state: "open", opens_at: "2026-11-04T00:00:00Z", closes_at: "2026-11-04T14:29:00Z" },
  },
  last: null,
  ...over,
});

const admin = (over: Record<string, unknown> = {}) => ({
  week: flags(WEEK, { is_current: true }),
  current_week: WEEK,
  schedule: [
    { ...flags(WEEK, { is_current: true }), prizes: [] },
    { ...flags(NEXT_WEEK, { is_future: true }), prizes: [] },
  ],
  cards: [card(burger), card(dominos)],
  standings: [],
  last_week: { week: { ...WEEK, key: "2026-10-26", starts_at: "2026-10-25T18:30:00Z", resets_at: "2026-11-01T18:30:00Z" }, prizes: [], winners: [] },
  pending_vouchers: 0,
  daily: daily(),
  ...over,
});

/** What the ledger endpoint answers. */
const ledger = (rows: unknown[] = [], pending = 0) => ({ rows, pending });

const answer = (rewards: unknown, winners: unknown = ledger()) =>
  get.mockImplementation((path: string) => Promise.resolve(path.startsWith("/superadmin/weekly-rewards/winners") ? winners : rewards));

const ledgerRow = (over: Record<string, unknown> = {}) => ({
  id: 41,
  week_key: "2026-10-26",
  rank: 1,
  user: { id: 3, name: "Aarav Sharma", handle: "aarav" },
  contest_score: 600,
  email: "aarav@example.test",
  college: "Alpha College",
  prize: { ...burger, rank: 1 },
  status: "pending",
  has_code: false,
  voucher_code: null,
  note: null,
  sent_at: null,
  ...over,
});

describe("the superadmin's Contest Rewards panel", () => {
  const toast = vi.fn();

  beforeEach(() => toast.mockReset());

  it("lists every card on the shelf, none live to begin with", async () => {
    answer(admin());
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    expect(await screen.findAllByText("Burger King")).toBeTruthy();
    expect(screen.getAllByText("Not live")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Go live" })).toHaveLength(2);
    expect(screen.getByText(/students see no rewards banner/i)).toBeTruthy();
  });

  it("Go live sends an explicit live:true for the week on screen and shows the card as live", async () => {
    answer(admin());
    put.mockResolvedValue({ changed: true, ...admin({ cards: [card(burger, { live: true, prize_rank: 1 }), card(dominos)] }) });
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    await screen.findAllByText("Burger King");
    fireEvent.click(screen.getAllByRole("button", { name: "Go live" })[0]);

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/weekly-rewards/burger_king", { live: true, week: "2026-11-02" }));
    expect(await screen.findByText(/Live · Rank #1/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take off" })).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Burger King ₹499 is live"));
  });

  it("Take off sends live:false", async () => {
    answer(admin({ cards: [card(burger, { live: true, prize_rank: 1 }), card(dominos)] }));
    put.mockResolvedValue({ changed: true, ...admin() });
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Take off" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/weekly-rewards/burger_king", { live: false, week: "2026-11-02" }));
  });

  it("chooses next week's prize ahead of time: pick the week, Schedule, and it says it starts by itself", async () => {
    answer(admin());
    render(<WeeklyRewardsPanel triggerToast={toast} />);
    await screen.findAllByText("Burger King");

    // Choosing the next week asks for that week's shelf.
    const nextWeek = admin({
      week: flags(NEXT_WEEK, { is_future: true }),
      schedule: [
        { ...flags(WEEK, { is_current: true }), prizes: [] },
        { ...flags(NEXT_WEEK, { is_future: true }), prizes: [] },
      ],
    });
    answer(nextWeek);
    fireEvent.click(screen.getByRole("button", { name: /Next week/ }));

    await waitFor(() => expect(get).toHaveBeenCalledWith("/superadmin/weekly-rewards?week=2026-11-09"));
    expect(await screen.findAllByRole("button", { name: "Schedule" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Go live" })).toBeNull();
    expect(screen.getByText(/No vouchers chosen for this week yet/)).toBeTruthy();

    put.mockResolvedValue({ changed: true, ...admin({ week: flags(NEXT_WEEK, { is_future: true }), cards: [card(burger, { live: true, prize_rank: 1 }), card(dominos)] }) });
    fireEvent.click(screen.getAllByRole("button", { name: "Schedule" })[0]);

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/weekly-rewards/burger_king", { live: true, week: "2026-11-09" }));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("shows to every student by itself when that week starts"));
  });

  it("copies the week before onto the week on screen", async () => {
    const nextWeek = admin({
      week: flags(NEXT_WEEK, { is_future: true }),
      schedule: [
        { ...flags(WEEK, { is_current: true }), prizes: [{ ...burger, rank: 1 }] },
        { ...flags(NEXT_WEEK, { is_future: true }), prizes: [] },
      ],
    });
    answer(nextWeek);
    post.mockResolvedValue({ copied: 1, ...nextWeek });
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: /Same as the week before/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/weekly-rewards/copy", { from: "2026-11-02", to: "2026-11-09" }));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Copied 1 voucher"));
  });

  it("shows the Daily Challenge: its time and its three problems, and says when nothing is scheduled", async () => {
    answer(admin());
    const { unmount } = render(<WeeklyRewardsPanel triggerToast={toast} />);

    const card = await screen.findByLabelText("Daily Challenge status");
    expect(within(card).getByText(/Every day at 8:00 PM IST, 60 minutes, three problems/)).toBeTruthy();
    expect(within(card).getByText("Two Sum")).toBeTruthy();
    expect(within(card).getByText("Merge Intervals")).toBeTruthy();
    expect(within(card).getByText("Word Ladder")).toBeTruthy();
    expect(within(card).getByText("Scheduled")).toBeTruthy();
    expect(within(card).getByText(/12 registered/)).toBeTruthy();
    unmount();

    answer(admin({ daily: daily({ scheduled: false, next: null }) }));
    render(<WeeklyRewardsPanel triggerToast={toast} />);
    expect(await screen.findByText("Nothing scheduled")).toBeTruthy();
    expect(screen.getByText(/No edition is on the calendar/)).toBeTruthy();
  });

  it("lists the winners with where to send the voucher, and Mark sent saves the code and tells the student", async () => {
    answer(admin(), ledger([ledgerRow()], 1));
    patch.mockResolvedValue({ winner: ledgerRow({ status: "sent" }) });
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    expect(await screen.findByText("aarav@example.test")).toBeTruthy();
    expect(screen.getByText("Alpha College")).toBeTruthy();
    expect(screen.getByText("1 to send")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Voucher code for Aarav Sharma"), { target: { value: "BK-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /Mark sent/ }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith("/superadmin/weekly-rewards/winners/41", { status: "sent", voucher_code: "BK-1234", note: "" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining("Aarav Sharma has been told")));
  });

  it("offers to close out last week when its winners are not in the ledger yet", async () => {
    const pending = { ...ledgerRow({ id: null, status: "not_recorded" }), user: { id: 3, name: "Aarav Sharma", handle: "aarav" } };
    answer(admin({ last_week: { ...admin().last_week, winners: [pending] } }));
    post.mockResolvedValue({ created: 1, week: "2026-10-26" });
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Close out last week" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/weekly-rewards/winners/finalize", {}));
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("Recorded 1 winner"));
  });

  it("says so, with a retry, when the panel cannot load", async () => {
    get.mockRejectedValue(new Error("offline"));
    render(<WeeklyRewardsPanel triggerToast={toast} />);

    expect(await screen.findByText(/Couldn't load the weekly rewards/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});

const row = (rank: number, name: string, over: Record<string, unknown> = {}) => ({
  rank,
  user: { id: rank === 1 ? 7 : rank + 100, name, handle: name.toLowerCase() },
  contest_score: 600 - rank * 100,
  penalty_minutes: 0,
  contests_played: 2,
  display_rating: "Unrated",
  prize: null,
  ...over,
});

const board = (over: Record<string, unknown> = {}) => ({
  period: "weekly",
  scope: "global",
  week: WEEK,
  prizes: [],
  leaderboard: [row(1, "Me"), row(2, "Bina")],
  total: 2,
  my_rank: 1,
  my_row: row(1, "Me"),
  ...over,
});

describe("the leaderboard page", () => {
  beforeEach(() => {
    get.mockImplementation((path: string) => (path.startsWith("/weekly-rewards") ? Promise.resolve(banner({ live: false, prizes: [] })) : Promise.resolve(board())));
  });

  it("opens on this week's board and ranks by contest score only", async () => {
    render(<LeaderboardPage />);

    await screen.findByText("Bina");
    expect(get).toHaveBeenCalledWith("/leaderboard?period=weekly&scope=global");
    expect(screen.getAllByText("Contest score").length).toBeGreaterThan(0);
    expect(screen.queryByText(/solved score/i)).toBeNull();
    expect(screen.getByText(/starts again from zero every Monday/)).toBeTruthy();
  });

  it("offers this week, all time and the Daily Challenge", async () => {
    render(<LeaderboardPage />);
    await screen.findByText("Bina");

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["This week", "All time", "Daily Challenge"]);

    fireEvent.click(screen.getByRole("tab", { name: "All time" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/leaderboard?period=all_time&scope=global"));

    fireEvent.click(screen.getByRole("tab", { name: "Daily Challenge" }));
    expect(await screen.findByText("daily board")).toBeTruthy();
  });

  it("shows the prize each of the top ranks is winning", async () => {
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith("/weekly-rewards")
          ? banner()
          : board({ prizes: [{ ...burger, rank: 1 }], leaderboard: [row(1, "Me", { prize: { ...burger, rank: 1 } }), row(2, "Bina")] })
      )
    );
    render(<LeaderboardPage />);

    await screen.findByText("Bina");
    expect(screen.getByText("Prize")).toBeTruthy();
    expect(screen.getAllByText(/Burger King ₹499/).length).toBeGreaterThan(0);
  });

  it("says when nobody has scored this week", async () => {
    get.mockImplementation((path: string) => Promise.resolve(path.startsWith("/weekly-rewards") ? banner({ live: false, prizes: [] }) : board({ leaderboard: [], total: 0, my_rank: null, my_row: null })));
    render(<LeaderboardPage />);

    expect(await screen.findByText(/Nobody has scored in a contest this week yet/)).toBeTruthy();
  });
});
