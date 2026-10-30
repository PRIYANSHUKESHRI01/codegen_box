import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockCatalogResponse, MockRole, MockRound, MockStack } from "@/types/mockInterview";
import type { InterviewResult } from "@/types/interview";

/**
 * The Merchant Navy section of the student dashboard: its own page, the Merchant Navy card as Step 1, then the exams, then the sets - the
 * same catalogue as the Mock AI Interview's Merchant Navy domain, which keeps its card too. And the end-of-set study summary.
 */

const nav = vi.hoisted(() => ({ search: "", listeners: new Set<() => void>() }));
const get = vi.fn();
const post = vi.fn();
const push = vi.fn();
const replace = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { role: "user" } }) }));
const setSearch = (url: string) => {
  nav.search = url.includes("?") ? url.split("?")[1] : "";
  nav.listeners.forEach((l) => l());
};
vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    useRouter: () => ({
      push: (url: string) => {
        push(url);
        // an address on another page is not this page's business
        if (url.startsWith("/dashboard/merchant-navy")) setSearch(url);
      },
      replace: (url: string) => {
        replace(url);
        setSearch(url);
      },
    }),
    useSearchParams: () => new URLSearchParams(React.useSyncExternalStore((cb) => { nav.listeners.add(cb); return () => nav.listeners.delete(cb); }, () => nav.search, () => nav.search)),
    usePathname: () => "/dashboard/merchant-navy",
  };
});
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, title, back }: { children: React.ReactNode; title: string; back?: { href: string; label: string } | false }) => (
    <main aria-label={title} data-back={back ? JSON.stringify(back) : ""}>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>loading session</div> }));
vi.mock("@/components/billing/FreeTrialBanner", () => ({ FreeTrialBanner: () => null }));
vi.mock("@/components/billing/UsageLimitBanner", () => ({ UsageLimitBanner: () => null }));

import MerchantNavyPage from "@/app/dashboard/merchant-navy/page";
import { StudySummary } from "@/components/dashboard/interviews/room/StudySummary";

const MY = { attempts: 0, best_score: null, scoring: false, open_slug: null, open_status: null } as MockRound["my"];
const set = (n: number): MockRound => ({
  id: `mock-second_mate_fg-r${n}`,
  round_number: n,
  title: `Set ${n}`,
  description: "A set of 30 oral questions.",
  duration_minutes: 41,
  question_count: 30,
  sitting_questions: 30,
  ready: true,
  my: MY,
});
const stack = (key: string, name: string, over: Partial<MockStack> = {}): MockStack => ({
  key,
  name,
  blurb: `${name} oral practice.`,
  icon: "Ship",
  aliases: [],
  tags: [],
  live: true,
  study: true,
  counts_toward_readiness: false,
  ready_rounds: 23,
  total_rounds: 23,
  rounds: Array.from({ length: 23 }, (_, i) => set(i + 1)),
  ...over,
});
const role = (key: string, title: string, stacks: MockStack[], over: Partial<MockRole> = {}): MockRole => ({
  key,
  title,
  blurb: `${title} roles.`,
  icon: "Server",
  badge: null,
  color: "indigo",
  terms: null,
  stacks_count: stacks.length,
  live_stacks_count: stacks.filter((s) => s.live).length,
  stacks,
  ...over,
});

const CATALOG: MockCatalogResponse = {
  roles: [
    role("backend", "Backend Developer", [stack("laravel", "Laravel (PHP)", { study: false, counts_toward_readiness: true, ready_rounds: 3, total_rounds: 3, rounds: [1, 2, 3].map((n) => ({ ...set(n), id: `mock-laravel-r${n}` })) })]),
    role(
      "merchant_navy",
      "Merchant Navy",
      [stack("second_mate_fg", "Second Mate (FG) Orals"), stack("chief_mate_fg", "Chief Mate (FG) Orals", { live: false, ready_rounds: 0, total_rounds: 10, rounds: [] })],
      { icon: "Anchor", color: "cyan", badge: "New", terms: { stack: "exam", stacks: "exams", round: "set", rounds: "sets" } }
    ),
  ],
  stats: { total_roles: 2, total_stacks: 3, live_stacks: 2, total_questions: 0 },
  min_questions: 5,
};

beforeEach(() => {
  [get, post, push, replace].forEach((m) => m.mockReset());
  nav.search = "";
  get.mockImplementation(async (path: string) => {
    if (path === "/mock-interviews/catalog") return CATALOG;
    if (path === "/me/subscription") return { scope: "individual", coverage: null, entitlements: undefined };
    throw new Error(`unexpected GET ${path}`);
  });
});
afterEach(cleanup);

describe("the Merchant Navy page", () => {
  it("shows the Merchant Navy card - and only that domain, with no domain search or filter", async () => {
    render(<MerchantNavyPage />);

    expect(await screen.findByText("Merchant Navy Mock AI Interview")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Merchant Navy/ })).toBeTruthy();
    expect(screen.queryByText("Backend Developer")).toBeNull();
    expect(screen.queryByPlaceholderText(/Search a domain/)).toBeNull();
    expect(screen.getByText("Practise for your oral exam")).toBeTruthy();
  });

  it("walks card -> exam -> sets in its own address, then starts a set from there", async () => {
    post.mockResolvedValue({ interview: { id: 7, slug: "set-3-xyz", title: "Merchant Navy - Set 3", question_count: 30 } });
    render(<MerchantNavyPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Merchant Navy/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/merchant-navy?domain=merchant_navy");
    expect(await screen.findByText("Step 2: Choose your exam in Merchant Navy")).toBeTruthy();
    expect(screen.getByText("23 of 23 sets ready")).toBeTruthy();
    expect(screen.getByText("10 sets · questions on the way")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Second Mate \(FG\) Orals/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/merchant-navy?domain=merchant_navy&stack=second_mate_fg");
    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Start practice/ })).toHaveLength(23);

    fireEvent.click(within(screen.getByRole("article", { name: "Set 3" })).getByRole("button"));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/mock-interviews/rounds/mock-second_mate_fg-r3/start", undefined));
    // the briefing page is told where the student came from, so the room and the way back stay in this section
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/interviews/view?slug=set-3-xyz&from=merchant-navy"));
  });

  it("the header arrow steps out one level at a time inside the section", async () => {
    nav.search = "domain=merchant_navy&stack=second_mate_fg";
    render(<MerchantNavyPage />);
    await screen.findByText("Step 3: Practise a mock interview");
    expect(screen.getByLabelText("Merchant Navy").getAttribute("data-back")).toBe(JSON.stringify({ href: "/dashboard/merchant-navy?domain=merchant_navy", label: "Exams" }));

    cleanup();
    nav.search = "domain=merchant_navy";
    render(<MerchantNavyPage />);
    await screen.findByText("Step 2: Choose your exam in Merchant Navy");
    expect(screen.getByLabelText("Merchant Navy").getAttribute("data-back")).toBe(JSON.stringify({ href: "/dashboard/merchant-navy", label: "Merchant Navy" }));
  });

  it("falls back to the card for an address that names another domain", async () => {
    nav.search = "domain=backend";
    render(<MerchantNavyPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/merchant-navy"));
  });
});

// ───────────────────────────── the end-of-set summary ─────────────────────────────

const study = (percent: number, band: "red" | "yellow" | "green", over: Record<string, unknown> = {}) => ({
  method: "text_match" as const,
  match_percent: percent,
  band,
  label: band === "green" ? "Strong answer" : band === "yellow" ? "Getting there" : "Needs more work",
  points: { covered: band === "green" ? 3 : 1, partial: 0, missed: band === "green" ? 0 : 2, total: band === "green" ? 3 : 3 },
  reference_answer: "Alpha, Bravo, Charlie.",
  segments: [
    { text: "Alpha, ", status: "covered" as const },
    { text: "Bravo, ", status: band === "green" ? ("covered" as const) : ("missed" as const) },
    { text: "Charlie.", status: band === "green" ? ("covered" as const) : ("missed" as const) },
  ],
  missed: [],
  unverified: false,
  ...over,
});

const result = (): InterviewResult => ({
  status: "scored",
  composite_score_percent: 47,
  passed: null,
  study: true,
  reattemptable: true,
  responses: [
    { question_text: "First question?", category: "technical", transcript_text: "I said alpha", has_audio: false, response_id: 1, score: 80, feedback: "", study: study(80, "green") },
    { question_text: "Second question?", category: "technical", transcript_text: "no idea", has_audio: false, response_id: 2, score: 5, feedback: "", study: study(5, "red", { unverified: true }) },
    { question_text: "Third question?", category: "technical", transcript_text: "alpha maybe", has_audio: false, response_id: 3, score: 55, feedback: "", study: study(55, "yellow") },
  ],
});

describe("the study summary", () => {
  it("shows the card again under a question that was asked of a picture, and nothing under one that was not", () => {
    const r = result();
    r.responses[1] = { ...r.responses[1], image: "/ror-cards/card-042.png" };
    render(<StudySummary result={r} />);

    expect(screen.getAllByTestId("review-card")).toHaveLength(1);
    expect(screen.getByTestId("review-card").getAttribute("src")).toBe("/ror-cards/card-042.png");
    expect(within(screen.getAllByTestId("review-item")[1]).getByTestId("review-card")).toBeTruthy();
  });

  it("shows the average match, how the answers split by colour, and every question to revise from", () => {
    render(<StudySummary result={result()} />);

    const meter = screen.getByTestId("match-meter");
    expect(meter.getAttribute("data-band")).toBe("yellow");
    expect(within(meter).getByText("47%")).toBeTruthy();
    expect(within(meter).getByText("Average match · Getting there")).toBeTruthy();

    const split = screen.getByRole("list", { name: "Answers by match" });
    expect(within(split).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1Strong", "1Getting there", "1Needs work"]);

    expect(screen.getAllByTestId("review-item")).toHaveLength(3);
    expect(screen.getByText("First question?")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("opens a question to its own answer beside the model answer, and warns when that model answer is unchecked", () => {
    const { container } = render(<StudySummary result={result()} />);
    const second = screen.getAllByTestId("review-item")[1];

    expect(within(second).getByText("no idea")).toBeTruthy();
    expect(within(second).getByTestId("model-answer").textContent).toContain("Alpha,");
    expect(within(second).getByText(/still being checked/)).toBeTruthy();
    expect(within(screen.getAllByTestId("review-item")[0]).queryByText(/still being checked/)).toBeNull();
    // the model answer's key points keep what was left out marked
    expect(container.querySelectorAll('[data-status="missed"]').length).toBeGreaterThan(0);
  });

  it("can put the weakest answers first, to start the revision where it is needed", () => {
    render(<StudySummary result={result()} />);

    expect(screen.getAllByTestId("review-item").map((li) => li.getAttribute("data-band"))).toEqual(["green", "red", "yellow"]);

    fireEvent.click(screen.getByRole("button", { name: "Weakest first" }));
    expect(screen.getAllByTestId("review-item").map((li) => li.getAttribute("data-band"))).toEqual(["red", "yellow", "green"]);

    fireEvent.click(screen.getByRole("button", { name: "In order" }));
    expect(screen.getAllByTestId("review-item").map((li) => li.getAttribute("data-band"))).toEqual(["green", "red", "yellow"]);
  });

  it("says it was not scored by AI", () => {
    render(<StudySummary result={result()} />);

    expect(screen.getByText(/Not scored by AI/)).toBeTruthy();
  });
});
