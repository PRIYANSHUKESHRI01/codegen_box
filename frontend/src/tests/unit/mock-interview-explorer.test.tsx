import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockCatalogResponse, MockRole, MockRound, MockStack } from "@/types/mockInterview";

type InterviewSummaryLike = Record<string, unknown>;

// next/navigation, stateful: the explorer keeps its place in the address, so a push has to change what useSearchParams returns.
const nav = vi.hoisted(() => ({ search: "", listeners: new Set<() => void>() }));
const get = vi.fn();
const post = vi.fn();
const push = vi.fn();
const replace = vi.fn();
let authStatus: "loading" | "ready" = "ready";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: authStatus, user: authStatus === "ready" ? { role: "user" } : null }) }));
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
        setSearch(url);
      },
      replace: (url: string) => {
        replace(url);
        setSearch(url);
      },
    }),
    useSearchParams: () => new URLSearchParams(React.useSyncExternalStore((cb) => { nav.listeners.add(cb); return () => nav.listeners.delete(cb); }, () => nav.search, () => nav.search)),
    usePathname: () => "/dashboard/interviews",
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

import { ApiError } from "@/lib/api";
import { MockInterviewExplorer } from "@/components/dashboard/interviews/MockInterviewExplorer";
import InterviewsListPage from "@/app/dashboard/interviews/page";
import PracticeStudioPage from "@/app/dashboard/interviews/practice/page";

const MY = { attempts: 0, best_score: null, scoring: false, open_slug: null, open_status: null } as MockRound["my"];

const round = (stack: string, n: number, over: Partial<MockRound> = {}): MockRound => ({
  id: `mock-${stack}-r${n}`,
  round_number: n,
  title: `Round ${n}: ${["Fundamentals", "Hands-on", "Scenarios"][n - 1]}`,
  description: `What round ${n} of ${stack} covers.`,
  duration_minutes: 15,
  question_count: 0,
  sitting_questions: 0,
  ready: false,
  my: MY,
  ...over,
});

const stack = (key: string, name: string, ready: number[], over: Partial<MockStack> = {}): MockStack => ({
  key,
  name,
  blurb: `${name} interview practice.`,
  icon: "Code2",
  aliases: key === "laravel" ? ["Laravel Developer"] : [],
  tags: [],
  live: ready.length > 0,
  ready_rounds: ready.length,
  total_rounds: 3,
  rounds: [1, 2, 3].map((n) => round(key, n, ready.includes(n) ? { ready: true, question_count: 8, sitting_questions: 8 } : {})),
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

const catalog = (roles: MockRole[]): MockCatalogResponse => ({
  roles,
  stats: { total_roles: roles.length, total_stacks: roles.flatMap((r) => r.stacks).length, live_stacks: roles.flatMap((r) => r.stacks).filter((s) => s.live).length, total_questions: 0 },
  min_questions: 5,
});

const SET_TEXT = "A mixed oral set of about 25 questions across navigation, cargo handling and stowage, and ship operation and safety.";
const MERCHANT_NAVY = role(
  "merchant_navy",
  "Merchant Navy",
  [
    stack("second_mate_fg", "Second Mate (FG) Orals", [], {
      live: true,
      ready_rounds: 25,
      total_rounds: 25,
      counts_toward_readiness: false,
      rounds: Array.from({ length: 25 }, (_, i) => ({ ...round("second_mate_fg", i + 1, { ready: true, question_count: 25, sitting_questions: 25, duration_minutes: 30 }), title: `Set ${i + 1}`, description: SET_TEXT })),
    }),
  ],
  { icon: "Anchor", color: "cyan", terms: { stack: "exam", stacks: "exams", round: "set", rounds: "sets" } },
);

let roles: MockRole[] = [];

const ROLES = [
  role("backend", "Backend Developer", [stack("laravel", "Laravel (PHP)", [1, 2]), stack("nodejs", "Node.js", [])]),
  role("data_analyst", "Data Analyst", [stack("data_analytics", "Data Analytics", [])]),
];

const serve = (interviews: InterviewSummaryLike[] = [], tracks: unknown[] = []) =>
  get.mockImplementation(async (path: string) => {
    if (path === "/mock-interviews/catalog") return catalog(roles.length ? roles : ROLES);
    if (path === "/interviews") return { interviews };
    if (path === "/interview-tracks") return { tracks };
    if (path === "/me/subscription") return { scope: "individual", coverage: null, entitlements: undefined };
    throw new Error(`unexpected GET ${path}`);
  });

beforeEach(() => {
  roles = [];
  get.mockReset();
  post.mockReset();
  push.mockReset();
  replace.mockReset();
  nav.search = "";
  authStatus = "ready";
});
afterEach(cleanup);

describe("<MockInterviewExplorer>", () => {
  it("speaks of exams and sets, not tech stacks and rounds, in a domain that names its own terms (Merchant Navy)", async () => {
    roles = [...ROLES, MERCHANT_NAVY];
    serve();
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Merchant Navy/ }));

    expect(await screen.findByText("Step 2: Choose your exam in Merchant Navy")).toBeTruthy();
    expect(screen.getByText(/Each exam is split into practice sets/)).toBeTruthy();
    expect(screen.getByText("25 of 25 sets ready")).toBeTruthy();
    expect(screen.queryByText(/Choose your tech stack in Merchant Navy/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Second Mate \(FG\) Orals/ }));

    // Twenty-five sets, not three function rounds: compact cards S1..S25, the one shared description shown once above them.
    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Start practice/ })).toHaveLength(25);
    expect(screen.getByRole("article", { name: "Set 1" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Set 25" })).toBeTruthy();
    expect(screen.getByText("S1")).toBeTruthy();
    expect(screen.getAllByText(SET_TEXT)).toHaveLength(1);
    expect(screen.getAllByText(/~30 min · 25 questions/)).toHaveLength(25);
    expect(screen.queryByText(/Function 1/)).toBeNull();
    expect(screen.getByRole("button", { name: /Back to Merchant Navy exams/ })).toBeTruthy();
    // Exam preparation never moves the placement-readiness score, so the page must not promise that it does.
    expect(screen.getByText(/do not change your placement readiness score/)).toBeTruthy();
    expect(screen.queryByText(/count towards the AI interviews part of your readiness score/)).toBeNull();
  });

  it("walks domain -> tech stack -> rounds, like the Vault AI Interview", async () => {
    serve();
    render(<MockInterviewExplorer />);

    // Step 1: domains, with how many of their stacks are open
    expect(await screen.findByText("Step 1: Choose your domain")).toBeTruthy();
    expect(screen.getByText("1 of 2 open")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Backend Developer/ }));

    // Step 2: its stacks
    expect(await screen.findByText("Step 2: Choose your tech stack in Backend Developer")).toBeTruthy();
    expect(screen.getByText("2 of 3 rounds ready")).toBeTruthy();
    expect(screen.getByText("3 rounds · questions on the way")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Laravel \(PHP\)/ }));

    // Step 3: three rounds, two of them ready
    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    const ready = screen.getAllByRole("button", { name: /Start practice/ });
    expect(ready).toHaveLength(2);
    expect(screen.getByText("Questions on the way")).toBeTruthy();
    expect(screen.getByText(/count towards the AI interviews part of your readiness score/)).toBeTruthy();
  });

  it("starts a round and opens the interview", async () => {
    serve();
    post.mockResolvedValue({ interview: { id: 1, slug: "laravel-round-1-abc12", title: "x", question_count: 8 } });
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Backend Developer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Laravel \(PHP\)/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Start practice/ })[0]);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/mock-interviews/rounds/mock-laravel-r1/start", undefined));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/interviews/view?slug=laravel-round-1-abc12"));
  });

  it("shows how the student has done on a round, and resumes one that is half-done", async () => {
    const mine = stack("laravel", "Laravel (PHP)", [1, 2]);
    mine.rounds[0].my = { attempts: 2, best_score: 74, scoring: false, open_slug: null, open_status: null };
    mine.rounds[1].my = { attempts: 0, best_score: null, scoring: false, open_slug: "laravel-r2-zz9", open_status: "in_progress" };
    get.mockImplementation(async () => catalog([role("backend", "Backend Developer", [mine])]));
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Backend Developer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Laravel \(PHP\)/ }));

    const first = screen.getByRole("article", { name: /Round 1/ });
    expect(within(first).getByText("74%")).toBeTruthy();
    expect(within(first).getByText("2 sittings")).toBeTruthy();
    expect(within(first).getByRole("button", { name: /Practise again/ })).toBeTruthy();
    expect(within(screen.getByRole("article", { name: /Round 2/ })).getByRole("button", { name: /Resume/ })).toBeTruthy();
  });

  it("a coming-soon stack shows what its rounds will cover and nothing can be started", async () => {
    serve();
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Data Analyst/ }));
    fireEvent.click(screen.getByRole("button", { name: /Data Analytics/ }));

    expect(await screen.findByText(/Mock interviews for Data Analytics are coming soon/)).toBeTruthy();
    expect(screen.getByText("What round 1 of data_analytics covers.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start practice/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Questions on the way" }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("finds a stack by its Mellow Vault domain name", async () => {
    serve();
    render(<MockInterviewExplorer />);

    fireEvent.change(await screen.findByPlaceholderText(/Search a domain or tech stack/), { target: { value: "laravel developer" } });

    expect(await screen.findByText(/Found/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Laravel \(PHP\)/ }));
    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
  });

  it("offers the plans page when the limit is the plan's, and lets the student try again", async () => {
    serve();
    post.mockRejectedValueOnce(new ApiError("You've reached today's mock interview limit (1) on your plan. Upgrade to practice more.", 402));
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Backend Developer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Laravel \(PHP\)/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Start practice/ })[0]);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("today's mock interview limit");
    expect(within(alert).getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/dashboard/billing");
    // the button is usable again
    await waitFor(() => expect((screen.getAllByRole("button", { name: /Start practice/ })[0] as HTMLButtonElement).disabled).toBe(false));
  });

  it("'Open now' hides domains with nothing open", async () => {
    serve();
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: "Open now" }));

    expect(screen.getByRole("button", { name: /Backend Developer/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Data Analyst/ })).toBeNull();
  });

  it("says so when the catalog cannot be loaded, and retries", async () => {
    get.mockRejectedValueOnce(new ApiError("Server went away", 500));
    get.mockResolvedValue(catalog(ROLES));
    render(<MockInterviewExplorer />);

    expect((await screen.findByRole("alert")).textContent).toContain("Server went away");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Step 1: Choose your domain")).toBeTruthy();
  });
});

describe("the Mock AI Interview page", () => {
  const assigned = (over: Record<string, unknown>) => ({
    id: 1, slug: "tpo-mock-1", title: "Placement mock round", description: "From your TPO", interview_type: "tpo_mock", is_mock: true,
    question_count: 6, my_session_status: null, for_your_branch: false, company: null, ...over,
  });

  it("puts the domain explorer first and no longer offers to build your own interview", async () => {
    serve();
    render(<InterviewsListPage />);

    expect(await screen.findByText("Step 1: Choose your domain")).toBeTruthy();
    expect(screen.queryByText(/Build your own practice interview/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Practise now/ })).toBeNull();
  });

  it("still shows what the college scheduled, with a pointer to it from the top", async () => {
    serve([assigned({}), assigned({ id: 2, slug: "tpo-mock-2", title: "Resume this one", my_session_status: "in_progress" }), assigned({ id: 3, slug: "tpo-done", title: "Finished one", my_session_status: "completed" })]);
    render(<InterviewsListPage />);

    expect(await screen.findByText("Placement mock round")).toBeTruthy();
    expect(screen.getByText("Resume this one")).toBeTruthy();
    expect(screen.getByText("Finished one")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Resume\s*\(1\)/ })).toBeTruthy();
    // 2 still need the student (one not started, one in progress); the finished one does not count
    expect(screen.getByRole("link", { name: /2 interviews waiting from your college/ }).getAttribute("href")).toBe("#from-your-college");
  });

  it("says where the college's interviews will appear when there are none", async () => {
    serve();
    render(<InterviewsListPage />);

    expect(await screen.findByText(/Nothing from your college yet/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /waiting from your college/ })).toBeNull();
  });

  it("keeps a student's own earlier practice interviews listed", async () => {
    serve([assigned({ id: 9, slug: "mine-1", title: "Laravel — Round 1", interview_type: "practice", is_mock: true })]);
    render(<InterviewsListPage />);

    expect(await screen.findByText("Your practice interviews")).toBeTruthy();
    expect(screen.getByText("Laravel — Round 1")).toBeTruthy();
    // a practice interview is not "waiting from your college"
    expect(screen.queryByRole("link", { name: /waiting from your college/ })).toBeNull();
  });
});

describe("focusing on a domain", () => {
  const assigned = (over: Record<string, unknown>) => ({
    id: 1, slug: "tpo-mock-1", title: "Placement mock round", description: "From your TPO", interview_type: "tpo_mock", is_mock: true,
    question_count: 6, my_session_status: null, for_your_branch: false, company: null, ...over,
  });
  const scheduled = () => [assigned({}), assigned({ id: 2, slug: "tpo-mock-2", title: "Resume this one", my_session_status: "in_progress" }), assigned({ id: 9, slug: "mine-1", title: "Laravel - Round 1", interview_type: "practice" })];
  const backOf = () => {
    const raw = document.querySelector("main")?.getAttribute("data-back") ?? "";
    return raw ? JSON.parse(raw) : null;
  };
  const showsCollegeSections = () => screen.queryByText("Placement mock round") !== null || screen.queryByText("Your practice interviews") !== null || screen.queryByRole("link", { name: /waiting from your college/ }) !== null;

  it("opening a domain shows only that domain - the scheduled and practice interviews go, and come back with All domains", async () => {
    serve(scheduled());
    render(<InterviewsListPage />);

    // everything is there at the top level
    expect(await screen.findByText("Placement mock round")).toBeTruthy();
    expect(screen.getByText("Your practice interviews")).toBeTruthy();
    expect(backOf()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Backend Developer/ }));

    expect(await screen.findByText(/Step 2: Choose your tech stack in Backend Developer/)).toBeTruthy();
    expect(showsCollegeSections()).toBe(false);
    expect(screen.queryByText("Resume this one")).toBeNull();
    expect(screen.queryByText(/Loading interviews/)).toBeNull();
    // the header arrow now leads out of the domain, to the full page
    expect(backOf()).toEqual({ href: "/dashboard/interviews", label: "All domains" });
    expect(push).toHaveBeenCalledWith("/dashboard/interviews?domain=backend");

    fireEvent.click(screen.getByRole("button", { name: /Back to all domains/ }));

    expect(await screen.findByText("Step 1: Choose your domain")).toBeTruthy();
    expect(await screen.findByText("Placement mock round")).toBeTruthy();
    expect(screen.getByText("Your practice interviews")).toBeTruthy();
    expect(backOf()).toBeNull();
  });

  it("opening a tech stack keeps the page focused, and the arrow steps out one level at a time", async () => {
    serve(scheduled());
    render(<InterviewsListPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Backend Developer/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Laravel \(PHP\)/ }));

    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    expect(showsCollegeSections()).toBe(false);
    expect(push).toHaveBeenLastCalledWith("/dashboard/interviews?domain=backend&stack=laravel");
    expect(backOf()).toEqual({ href: "/dashboard/interviews?domain=backend", label: "Tech stacks" });

    fireEvent.click(screen.getByRole("button", { name: /Back to Backend Developer tech stacks/ }));

    expect(await screen.findByText(/Step 2: Choose your tech stack in Backend Developer/)).toBeTruthy();
    expect(showsCollegeSections()).toBe(false);
    expect(backOf()).toEqual({ href: "/dashboard/interviews", label: "All domains" });
  });

  it("the browser's Back button (an address change) does the same as the arrows", async () => {
    serve(scheduled());
    nav.search = "domain=backend&stack=laravel";
    render(<InterviewsListPage />);

    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    expect(showsCollegeSections()).toBe(false);

    // Back in the browser changes the address to the previous one; nothing here has to be told.
    await waitFor(() => {
      nav.search = "";
      nav.listeners.forEach((l) => l());
    });

    expect(await screen.findByText("Step 1: Choose your domain")).toBeTruthy();
    expect(await screen.findByText("Placement mock round")).toBeTruthy();
  });

  it("a shared or bookmarked link opens straight on the stack", async () => {
    serve();
    nav.search = "domain=backend&stack=laravel";
    render(<MockInterviewExplorer />);

    expect(await screen.findByText("Step 3: Practise a mock interview")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Start practice/ })).toHaveLength(2);
  });

  it("a stale link to a domain or stack that no longer exists drops back to the nearest step that does", async () => {
    serve();
    nav.search = "domain=gone";
    const first = render(<MockInterviewExplorer />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/interviews"));
    first.unmount();

    replace.mockReset();
    nav.search = "domain=backend&stack=cobol";
    render(<MockInterviewExplorer />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard/interviews?domain=backend"));
  });

  it("scrolls the explorer back into view when a card is opened, so the student is not left halfway down the page", async () => {
    serve();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<MockInterviewExplorer />);

    fireEvent.click(await screen.findByRole("button", { name: /Backend Developer/ }));

    await waitFor(() => expect(scroll).toHaveBeenCalled());
    // not on first paint - only when the student moves
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});

describe("the paused build-your-own studio", () => {
  it("tells a student who lands on it where to practise instead, rather than showing an error", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/me/practice-interviews/options") throw new ApiError("Building your own practice interview is paused for now.", 403, undefined, "practice_builder_paused");
      return { scope: "individual", coverage: null, entitlements: undefined };
    });
    render(<PracticeStudioPage />);

    expect(await screen.findByText("Practise by domain and tech stack instead")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Go to Mock AI Interview/ }).getAttribute("href")).toBe("/dashboard/interviews");
    expect(screen.queryByRole("button", { name: /Build my interview/ })).toBeNull();
  });
});
