import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CuratedSetsExplorer } from "@/components/dashboard/interviews/CuratedSetsExplorer";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(msg: string, status: number, _errors?: unknown, code?: string) {
      super(msg);
      this.status = status;
      this.code = code;
    }
  },
}));

const set = (id: string, n: number, title: string, description: string, ready: boolean) => ({
  id,
  series_number: 1,
  set_number: n,
  title,
  duration_minutes: 15,
  description,
  tags: [],
  question_count: ready ? 5 : 0,
  ready,
  preview_questions: [],
});

const sets = (prefix: string, ready: boolean) => [
  set(`${prefix}-s1-set1`, 1, "Set 1: Analytics Foundations & Excel", "Data cleaning, Excel lookups and pivots.", ready),
  set(`${prefix}-s1-set2`, 2, "Set 2: Statistics, SQL & Visualisation", "Hypothesis testing, SQL for analysis.", ready),
  set(`${prefix}-s1-set3`, 3, "Set 3: Case Study & Business Judgement", "Define the metric, diagnose a drop.", ready),
];

const stack = (key: string, name: string, over: Record<string, unknown> = {}) => ({
  key,
  name,
  blurb: `${name} interview track.`,
  icon: "Code2",
  aliases: [],
  tags: [],
  live: true,
  ready_sets: 9,
  total_sets: 9,
  interested: false,
  sets_count: 3,
  sets: sets(key, true),
  ...over,
});

const CATALOG = {
  roles: [
    {
      key: "backend",
      title: "Backend Developer",
      blurb: "Server-side architecture and APIs.",
      icon: "Server",
      badge: "High Demand",
      color: "indigo",
      stacks_count: 2,
      live_stacks_count: 1,
      sets_count: 6,
      stacks: [stack("laravel", "Laravel (PHP)"), stack("php", "PHP", { live: false, ready_sets: 0, sets: sets("php", false), aliases: ["PHP Developer"] })],
    },
    {
      key: "data_analyst",
      title: "Data Analyst",
      blurb: "SQL, spreadsheets, statistics and dashboards.",
      icon: "BarChart3",
      badge: "In Demand",
      color: "cyan",
      stacks_count: 2,
      live_stacks_count: 0,
      sets_count: 6,
      stacks: [
        stack("data_analytics", "Data Analytics", { icon: "BarChart3", live: false, ready_sets: 0, sets: sets("data_analytics", false), aliases: ["Data Analytics", "Data Analyst"] }),
        stack("sql", "SQL", { icon: "Database", live: false, ready_sets: 3, sets: sets("sql", false), aliases: ["SQL Developer"], interested: true }),
      ],
    },
  ],
  stats: { total_roles: 2, total_stacks: 4, live_stacks: 1, total_sets: 12, total_questions: 5 },
};

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (path: string) => {
    if (path === "/curated-interview-sets") return CATALOG;
    if (path.startsWith("/vault-qualification/status")) throw new Error(`status must not be fetched for a coming-soon stack (${path})`);
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(cleanup);

const mount = async () => {
  render(<CuratedSetsExplorer />);
  await screen.findByText(/Step 1: Choose Your Domain/);
};

describe("the domain picker", () => {
  it("lists every role and says how many of the stacks are open", async () => {
    await mount();

    expect(screen.getByText(/1 of 4 stacks open/)).toBeTruthy();
    expect(screen.getByText("Data Analyst")).toBeTruthy();
    expect(screen.getByText("Backend Developer")).toBeTruthy();
    expect(screen.getByText(/2 Stacks • 1 open/)).toBeTruthy();
    expect(screen.getByText(/2 Stacks • Coming soon/)).toBeTruthy();
  });

  it('"Open now" hides the roles that have nothing open yet, and "All roles" brings them back', async () => {
    await mount();

    fireEvent.click(screen.getByRole("button", { name: "Open now" }));
    expect(screen.getByText("Backend Developer")).toBeTruthy();
    expect(screen.queryByText("Data Analyst")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All roles" }));
    expect(screen.getByText("Data Analyst")).toBeTruthy();
  });

  it("finds a track by the Mellow Vault domain name it covers, and lists open tracks first", async () => {
    await mount();

    fireEvent.change(screen.getByLabelText(/search stacks, roles and domains/i), { target: { value: "sql developer" } });
    expect(screen.getByText(/Found/).textContent).toMatch(/1 track matching/);
    expect(screen.getByRole("heading", { name: "SQL" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/search stacks, roles and domains/i), { target: { value: "php" } });
    expect(screen.getByRole("heading", { name: "PHP" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/search stacks, roles and domains/i), { target: { value: "developer" } });
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings.indexOf("Laravel (PHP)")).toBeLessThan(headings.indexOf("PHP"));

    fireEvent.change(screen.getByLabelText(/search stacks, roles and domains/i), { target: { value: "zzzz" } });
    expect(screen.getByText(/No track matched/)).toBeTruthy();
  });

  it("marks coming-soon tracks inside a role, and still lets the student read their syllabus", async () => {
    await mount();

    fireEvent.click(screen.getByText("Backend Developer"));
    expect(await screen.findByText(/Step 2: Choose Your Track in Backend Developer/)).toBeTruthy();
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(screen.getByText("Launch Circuit")).toBeTruthy();
    expect(screen.getByText("View syllabus")).toBeTruthy();
  });
});

describe("a track that is coming soon", () => {
  const openDataAnalytics = async () => {
    await mount();
    fireEvent.click(screen.getByText("Data Analyst"));
    fireEvent.click(await screen.findByRole("button", { name: /Data Analytics/ }));
    await screen.findByText(/interview is being prepared/);
  };

  it("shows what it will assess, says so plainly, and cannot be started", async () => {
    await openDataAnalytics();

    expect(screen.getByText(/The Data Analytics interview is being prepared/)).toBeTruthy();
    expect(screen.getByText("Analytics Foundations & Excel")).toBeTruthy();
    expect(screen.getByText("Statistics, SQL & Visualisation")).toBeTruthy();
    expect(screen.getByText("Case Study & Business Judgement")).toBeTruthy();
    expect(screen.getByText(/Data Analytics · Data Analyst/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /start set/i })).toBeNull();
    // Nothing asked the server for a qualification track that does not exist.
    expect(get.mock.calls.some(([path]) => String(path).startsWith("/vault-qualification/status"))).toBe(false);
  });

  it("lets the student ask to be told, and take it back", async () => {
    post.mockResolvedValue({ stack: "data_analytics", interested: true });
    del.mockResolvedValue({ stack: "data_analytics", interested: false });
    await openDataAnalytics();

    const notify = screen.getByRole("button", { name: /notify me when it opens/i });
    expect(notify.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(notify);
    await waitFor(() => expect(screen.getByRole("button", { name: /you'll be notified/i })).toBeTruthy());
    expect(post).toHaveBeenCalledWith("/vault-qualification/interest", { stack: "data_analytics" });

    fireEvent.click(screen.getByRole("button", { name: /you'll be notified/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /notify me when it opens/i })).toBeTruthy());
    expect(del).toHaveBeenCalledWith("/vault-qualification/interest", { stack: "data_analytics" });
  });

  it("shows a stack the student already asked about as already notified", async () => {
    await mount();
    fireEvent.click(screen.getByText("Data Analyst"));
    fireEvent.click(await screen.findByRole("button", { name: /SQL/ }));

    expect(await screen.findByRole("button", { name: /you'll be notified/i })).toBeTruthy();
    expect(screen.getByText(/3 of 9 rounds ready/)).toBeTruthy();
  });

  it("says why when asking fails, and leaves the choice unchanged", async () => {
    post.mockRejectedValue(new (await import("@/lib/api")).ApiError("The SQL interview is already open — you can start it now.", 422));
    await openDataAnalytics();

    fireEvent.click(screen.getByRole("button", { name: /notify me when it opens/i }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/already open/);
    expect(screen.getByRole("button", { name: /notify me when it opens/i }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("a track that is open", () => {
  it("still loads its qualification track as before", async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/curated-interview-sets") return CATALOG;
      if (path.startsWith("/vault-qualification/status")) {
        return {
          stack_live: true,
          qualification_id: 1,
          user_id: 1,
          stack_key: "laravel",
          role_key: "backend",
          status: "in_progress",
          is_qualified: false,
          is_cooling_down: false,
          current_attempt: 1,
          max_attempts: 3,
          attempts_remaining: 3,
          cooldown_until: null,
          cooldown_formatted_date: null,
          cooldown_days_remaining: 0,
          cooldown_hours_remaining: 0,
          active_series: {
            series_number: 1,
            title: "Series 1",
            sets: sets("laravel", true).map((s) => ({ set_number: s.set_number, set_id: s.id, title: s.title, description: s.description, duration_minutes: 15, question_count: 5, preview_questions: [], status: "not_started", score_percent: null, interview_slug: null })),
            completed_sets_count: 0,
            all_sets_completed: false,
            series_average: null,
          },
          past_attempts: [],
        };
      }
      throw new Error(`unexpected GET ${path}`);
    });

    await mount();
    fireEvent.click(screen.getByText("Backend Developer"));
    fireEvent.click(await screen.findByRole("button", { name: /Laravel \(PHP\)/ }));

    await waitFor(() => expect(screen.getByText(/Laravel \(PHP\) Qualification Track/)).toBeTruthy());
    expect(await screen.findAllByRole("button", { name: /start set/i })).toHaveLength(3);
    expect(screen.queryByText(/is being prepared/)).toBeNull();
    expect(within(screen.getByRole("region", { name: /qualification circuit/i })).queryByText("Coming soon")).toBeNull();
  });
});
