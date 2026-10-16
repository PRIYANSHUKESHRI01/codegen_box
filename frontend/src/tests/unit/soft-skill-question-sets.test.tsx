import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionSetCatalogue, QuestionSetItem, SoftSkillAssessmentSummary, SoftSkillLibraryResponse } from "@/types/softSkill";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready" }) }));
vi.mock("@/components/dashboard/DashboardShell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div> }));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>loading session</div> }));

import { ApiError } from "@/lib/api";
import SoftSkillsListPage from "@/app/dashboard/soft-skills/page";
import { QuestionSetPicker } from "@/components/dashboard/softSkills/QuestionSetPicker";
import { CreateSoftSkillAssessmentModal } from "@/components/dashboard/softSkills/CreateSoftSkillAssessmentModal";
import { AddQuestionSetPanel } from "@/components/dashboard/softSkills/AddQuestionSetPanel";
import { DEFAULT_VIEW, describeUsage, libraryViewToApiQuery, libraryViewToSearch, pageNumbersWithEllipsis, parseLibraryView } from "@/lib/softSkillSets";

// ───────────────────────────── fixtures ─────────────────────────────

const summary = (n: number, over: Partial<SoftSkillAssessmentSummary> = {}): SoftSkillAssessmentSummary => ({
  id: n,
  slug: `soft-skill-assessment-set-${n}`,
  title: `Soft Skill Assessment - Set ${n}`,
  description: null,
  assessment_type: "general",
  is_question_set: true,
  set_number: n,
  duration_minutes: 45,
  pass_percentage: 60,
  max_attempts: null,
  question_count: 25,
  category_composition: { aptitude: 8, reasoning: 7, english: 6, situational: 4 },
  company: null,
  attempts_taken: 0,
  best_score_percent: null,
  in_progress: false,
  can_attempt: true,
  ...over,
});

const TOTAL = 45;

/** What the API returns for a page of the 45-set library. */
const libraryPage = (page: number, perPage: number | "all", total = TOTAL, over: Partial<SoftSkillLibraryResponse["counts"]> = {}): SoftSkillLibraryResponse => {
  const size = perPage === "all" ? total : perPage;
  const last = Math.max(1, Math.ceil(total / size));
  const p = Math.min(page, last);
  const from = (p - 1) * size + 1;
  const to = Math.min(total, p * size);
  return {
    assessments: Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => summary(from + i)),
    meta: { total, page: p, per_page: size, last_page: last, from: total === 0 ? 0 : from, to: total === 0 ? 0 : to, all: perPage === "all" },
    counts: { sets: total, sets_completed: 3, sets_in_progress: 1, assigned: 0, ...over },
  };
};

const assignedTest = (n: number): SoftSkillAssessmentSummary =>
  summary(100 + n, { title: `Campus Round ${n}`, slug: `campus-round-${n}`, assessment_type: "tpo_mock", is_question_set: false, set_number: null, question_count: 30 });

/** Routes api.get by what the page asks for. */
const serve = (assigned: SoftSkillAssessmentSummary[] = [], onSets?: (query: URLSearchParams) => SoftSkillLibraryResponse | Error) => {
  get.mockImplementation(async (path: string) => {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    if (query.get("scope") === "assigned") return { assessments: assigned, meta: libraryPage(1, "all").meta, counts: libraryPage(1, 20).counts };
    const out = onSets ? onSets(query) : libraryPage(Number(query.get("page") ?? 1), query.get("per_page") === "all" ? "all" : Number(query.get("per_page") ?? 20));
    if (out instanceof Error) throw out;
    return out;
  });
};

const setCalls = () => get.mock.calls.map(([path]) => String(path)).filter((p) => p.includes("scope=sets"));
const lastSetCall = () => new URLSearchParams(setCalls().at(-1)!.split("?")[1]);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  window.history.replaceState(null, "", "/dashboard/soft-skills");
});
afterEach(cleanup);

// ───────────────────────────── pure helpers ─────────────────────────────

describe("softSkillSets helpers", () => {
  it("windows the page numbers with ellipses", () => {
    expect(pageNumbersWithEllipsis(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbersWithEllipsis(1, 1)).toEqual([1]);
    expect(pageNumbersWithEllipsis(20, 40)).toEqual([1, "ellipsis", 19, 20, 21, "ellipsis", 40]);
    expect(pageNumbersWithEllipsis(2, 40)).toEqual([1, 2, 3, "ellipsis", 40]);
  });

  it("round-trips the view through the address bar and leaves the default page with a clean URL", () => {
    expect(libraryViewToSearch(DEFAULT_VIEW)).toBe("");
    const view = { q: "set 12", status: "completed" as const, page: 3, perPage: 20 as const };
    expect(parseLibraryView(libraryViewToSearch(view))).toEqual(view);
    expect(libraryViewToSearch({ ...DEFAULT_VIEW, perPage: "all", page: 4 })).toBe("?per=all");
    expect(parseLibraryView("?per=all")).toMatchObject({ perPage: "all", page: 1 });
  });

  it("ignores junk in the address bar instead of breaking", () => {
    expect(parseLibraryView("?page=-4&status=hacked&per=banana&q=" + "x".repeat(300))).toMatchObject({ page: 1, status: "all", perPage: 20, q: "x".repeat(100) });
    expect(parseLibraryView("?page=abc").page).toBe(1);
  });

  it("builds the API query: show-all always asks for page 1", () => {
    expect(libraryViewToApiQuery("sets", { ...DEFAULT_VIEW, page: 2 })).toBe("scope=sets&per_page=20&page=2");
    expect(libraryViewToApiQuery("sets", { q: " 12 ", status: "in_progress", page: 5, perPage: "all" })).toBe("scope=sets&per_page=all&page=1&q=12&status=in_progress");
  });

  it("describes where a set was used, leading with the most relevant test", () => {
    expect(describeUsage({ state: "unused", count: 0, tests: [] })).toBe("");
    const text = describeUsage({
      state: "published",
      count: 3,
      tests: [
        { title: "Old draft", status: "draft", added_at: "2026-09-01T10:00:00Z" },
        { title: "Round 1", status: "published", added_at: "2026-10-12T10:00:00Z" },
      ],
    });
    expect(text).toContain("Published in “Round 1”");
    expect(text).toContain("(+2 more)");
    expect(text).toMatch(/added 12 Oct 2026/);
  });
});

// ───────────────────────────── the student's library ─────────────────────────────

describe("student Soft Skills page", () => {
  it("shows the AptRun question sets twenty to a page, in set order, with the total and the student's progress", async () => {
    serve();
    render(<SoftSkillsListPage />);

    expect(await screen.findByText("Set 1")).toBeTruthy();
    expect(screen.getByText("Set 20")).toBeTruthy();
    expect(screen.queryByText("Set 21")).toBeNull();
    expect(screen.getByRole("heading", { name: "AptRun Soft Skills question sets" })).toBeTruthy();
    expect(screen.getByText(/Showing/).textContent).toContain("1–20 of 45 sets");
    expect(screen.getByText(/of/, { selector: "span" }).textContent).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("7");   // 3 of 45 sets completed
    expect(lastSetCall().get("per_page")).toBe("20");
  });

  it("goes to another page, and scrolls the grid back into view", async () => {
    serve();
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));

    expect(await screen.findByText("Set 21")).toBeTruthy();
    expect(screen.queryByText("Set 1")).toBeNull();
    expect(lastSetCall().get("page")).toBe("2");
    expect(window.location.search).toBe("?page=2");
    await waitFor(() => expect(scroll).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Set 41")).toBeTruthy();
    expect(screen.getByText("Set 45")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("'Show all' lists every set on one page and can go back to twenty", async () => {
    serve();
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(await screen.findByText("Set 45")).toBeTruthy();
    expect(screen.getByText("Set 1")).toBeTruthy();
    expect(lastSetCall().get("per_page")).toBe("all");
    expect(screen.getByText(/Showing all/).textContent).toContain("45");
    expect(window.location.search).toBe("?per=all");
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "20 per page" }));
    await waitFor(() => expect(screen.queryByText("Set 45")).toBeNull());
    expect(screen.getByText("Set 20")).toBeTruthy();
  });

  it("a short list shows no paging controls at all", async () => {
    serve([], (q) => libraryPage(1, 20, 12));
    render(<SoftSkillsListPage />);

    await screen.findByText("Set 12");
    expect(screen.queryByRole("navigation", { name: "sets pages" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("searches after a pause, from page 1, and clears the search again", async () => {
    serve([], (q) => (q.get("q") === "12" ? { ...libraryPage(1, 20, 2), assessments: [summary(12), summary(112)], meta: { ...libraryPage(1, 20, 2).meta, total: 2 } } : libraryPage(Number(q.get("page") ?? 1), 20)));
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("Set 21");

    fireEvent.change(screen.getByLabelText("Search question sets"), { target: { value: "12" } });

    expect(await screen.findByText("Set 112")).toBeTruthy();
    expect(lastSetCall().get("q")).toBe("12");
    expect(lastSetCall().get("page")).toBe("1");
    expect(window.location.search).toBe("?q=12");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("Set 1")).toBeTruthy();
  });

  it("filters by the student's own progress", async () => {
    serve();
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));

    await waitFor(() => expect(lastSetCall().get("status")).toBe("completed"));
    expect(screen.getByRole("button", { name: "Completed" }).getAttribute("aria-pressed")).toBe("true");
    expect(window.location.search).toBe("?status=completed");
  });

  it("says when nothing matches and offers a way back", async () => {
    serve([], (q) => (q.get("q") ? libraryPage(1, 20, 0) : libraryPage(1, 20)));
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");

    fireEvent.change(screen.getByLabelText("Search question sets"), { target: { value: "zzz" } });

    expect(await screen.findByText("No sets match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Set 1")).toBeTruthy();
    expect((screen.getByLabelText("Search question sets") as HTMLInputElement).value).toBe("");
  });

  it("an empty library says so plainly", async () => {
    serve([], () => libraryPage(1, 20, 0));
    render(<SoftSkillsListPage />);

    expect(await screen.findByText("No question sets yet")).toBeTruthy();
  });

  it("restores the page, filter and search from the address bar", async () => {
    window.history.replaceState(null, "", "/dashboard/soft-skills?page=2&status=completed&q=set");
    serve();
    render(<SoftSkillsListPage />);

    await screen.findByText("Set 21");
    expect(lastSetCall().get("page")).toBe("2");
    expect(lastSetCall().get("status")).toBe("completed");
    expect(lastSetCall().get("q")).toBe("set");
    expect((screen.getByLabelText("Search question sets") as HTMLInputElement).value).toBe("set");
  });

  it("follows the server when a stale link asks for a page past the end", async () => {
    window.history.replaceState(null, "", "/dashboard/soft-skills?page=99");
    serve();
    render(<SoftSkillsListPage />);

    await screen.findByText("Set 41");
    await waitFor(() => expect(window.location.search).toBe("?page=3"));
  });

  it("shows an error with a retry, and recovers", async () => {
    let fail = true;
    serve([], (q) => (fail ? new ApiError("The server is having a moment.", 500) : libraryPage(1, 20)));
    render(<SoftSkillsListPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("The server is having a moment.");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Set 1")).toBeTruthy();
  });

  it("only the newest request wins when the student clicks quickly", async () => {
    let releaseSlow: (v: SoftSkillLibraryResponse) => void = () => undefined;
    get.mockImplementation(async (path: string) => {
      const q = new URLSearchParams(path.split("?")[1] ?? "");
      if (q.get("scope") === "assigned") return { assessments: [], meta: libraryPage(1, "all").meta, counts: libraryPage(1, 20).counts };
      if (q.get("page") === "2") return new Promise<SoftSkillLibraryResponse>((resolve) => (releaseSlow = resolve));
      return libraryPage(Number(q.get("page") ?? 1), 20);
    });
    render(<SoftSkillsListPage />);
    await screen.findByText("Set 1");

    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));   // slow
    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));   // fast, and newer
    await screen.findByText("Set 41");
    await act(async () => releaseSlow(libraryPage(2, 20)));            // the stale answer arrives late

    expect(screen.getByText("Set 41")).toBeTruthy();
    expect(screen.queryByText("Set 21")).toBeNull();
  });

  it("puts the tests scheduled for the student above the library, and folds a long list", async () => {
    serve([1, 2, 3, 4, 5, 6].map(assignedTest));
    render(<SoftSkillsListPage />);

    const heading = await screen.findByRole("heading", { name: /Assigned to you/ });
    const section = heading.closest("section")!;
    expect(within(section).getByText("Campus Round 1")).toBeTruthy();
    expect(within(section).getByText("Campus Round 4")).toBeTruthy();
    expect(within(section).queryByText("Campus Round 5")).toBeNull();

    fireEvent.click(within(section).getByRole("button", { name: /Show all 6/ }));
    expect(within(section).getByText("Campus Round 6")).toBeTruthy();
  });

  it("shows where the student stands on each set", async () => {
    serve([], () => ({
      ...libraryPage(1, 20, 3),
      assessments: [summary(1, { best_score_percent: 80, attempts_taken: 2 }), summary(2, { in_progress: true }), summary(3)],
    }));
    render(<SoftSkillsListPage />);

    expect(await screen.findByText(/Best 80%/)).toBeTruthy();
    expect(screen.getByText(/2 attempts/)).toBeTruthy();
    expect(screen.getByText(/In progress — resume/)).toBeTruthy();
    expect(within(screen.getByRole("link", { name: /Set 3/ })).getByText("Not attempted")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Set 1/ }).getAttribute("href")).toBe("/dashboard/soft-skills/session?slug=soft-skill-assessment-set-1");
  });
});

// ───────────────────────────── the scheduler's picker ─────────────────────────────

const setItem = (n: number, usage: QuestionSetItem["usage"] = { state: "unused", count: 0, tests: [] }): QuestionSetItem => ({
  id: n,
  slug: `soft-skill-assessment-set-${n}`,
  title: `Soft Skill Assessment - Set ${n}`,
  label: `Set ${n}`,
  set_number: n,
  description: null,
  duration_minutes: 45,
  pass_percentage: 60,
  question_count: 25,
  category_composition: { aptitude: 8, reasoning: 7, english: 6, situational: 4 },
  usage,
});

const used = (title: string, status: "published" | "draft" = "published"): QuestionSetItem["usage"] => ({
  state: status,
  count: 1,
  tests: [{ id: 9, title, slug: "t", status, added_at: "2026-10-12T10:00:00Z" }],
});

const catalogue = (sets: QuestionSetItem[], over: Partial<QuestionSetCatalogue> = {}): QuestionSetCatalogue => ({
  sets,
  meta: { total: sets.length, page: 1, per_page: 20, last_page: 1, from: 1, to: sets.length, all: false },
  counts: { all: 45, used: 1, unused: 44 },
  ...over,
});

describe("QuestionSetPicker", () => {
  it("marks the sets this organisation has used, and says where", async () => {
    get.mockResolvedValue(catalogue([setItem(1), setItem(2, used("Round 1 aptitude"))]));
    render(<QuestionSetPicker catalogueUrl="/tpo/soft-skill-question-sets" selected={null} onSelect={() => undefined} />);

    expect(await screen.findByText("Set 1")).toBeTruthy();
    const list = within(screen.getByRole("radiogroup"));
    expect(list.getByText("Not used yet")).toBeTruthy();
    expect(list.getByText("Already published")).toBeTruthy();
    expect(screen.getByText(/Published in “Round 1 aptitude”/)).toBeTruthy();
    expect(String(get.mock.calls[0][0])).toContain("/tpo/soft-skill-question-sets?per_page=20&page=1");
  });

  it("selects a set (and unselects it on a second click)", async () => {
    get.mockResolvedValue(catalogue([setItem(1), setItem(2)]));
    const onSelect = vi.fn();
    const { rerender } = render(<QuestionSetPicker catalogueUrl="/x" selected={null} onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Set 2/ }));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }));

    rerender(<QuestionSetPicker catalogueUrl="/x" selected={setItem(2)} onSelect={onSelect} />);
    expect(screen.getByRole("radio", { name: /Set 2/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /Set 2/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("warns — but does not block — when the chosen set was used before", async () => {
    const usedSet = setItem(7, used("Round 1 aptitude"));
    get.mockResolvedValue(catalogue([usedSet]));
    render(<QuestionSetPicker catalogueUrl="/x" selected={usedSet} onSelect={() => undefined} />);

    const warning = await screen.findByRole("status");
    expect(warning.textContent).toContain("has been used before");
    expect(warning.textContent).toContain("Round 1 aptitude");
    expect((screen.getByRole("radio", { name: /Set 7/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the warning when the chosen set is on another page", async () => {
    get.mockResolvedValue(catalogue([setItem(21)]));
    render(<QuestionSetPicker catalogueUrl="/x" selected={setItem(7, used("Round 1 aptitude"))} onSelect={() => undefined} />);

    await screen.findByText("Set 21");
    expect((await screen.findByRole("status")).textContent).toContain("Set 7");
  });

  it("filters to sets not used yet, and pages", async () => {
    get.mockImplementation(async (path: string) => {
      const q = new URLSearchParams(path.split("?")[1]);
      return q.get("usage") === "unused" ? catalogue([setItem(3)], { counts: { all: 45, used: 1, unused: 44 } }) : catalogue(Array.from({ length: 20 }, (_, i) => setItem(i + 1)), { meta: { total: 45, page: 1, per_page: 20, last_page: 3, from: 1, to: 20, all: false } });
    });
    render(<QuestionSetPicker catalogueUrl="/x" selected={null} onSelect={() => undefined} />);
    await screen.findByText("Set 1");
    expect(screen.getByText(/Showing/).textContent).toContain("1–20 of 45 sets");

    fireEvent.click(screen.getByRole("button", { name: /Not used yet/ }));

    await screen.findByText("Set 3");
    expect(String(get.mock.calls.at(-1)![0])).toContain("usage=unused");
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    await screen.findByText("Set 20");
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await waitFor(() => expect(String(get.mock.calls.at(-1)![0])).toContain("per_page=all"));
  });

  it("dims sets that are already in the test being edited and cannot be picked", async () => {
    get.mockResolvedValue(catalogue([setItem(1), setItem(2)]));
    render(<QuestionSetPicker catalogueUrl="/x" selected={null} onSelect={() => undefined} disabledIds={[2]} />);

    await screen.findByText("Set 1");
    expect(screen.getByText("Already in this test")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Set 2/ })).toBeNull();
  });

  it("browse-only mode has no selection at all", async () => {
    get.mockResolvedValue(catalogue([setItem(1)]));
    render(<QuestionSetPicker catalogueUrl="/x" selected={null} onSelect={() => undefined} browseOnly />);

    await screen.findByText("Set 1");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows a retryable error and an honest empty state", async () => {
    get.mockRejectedValueOnce(new ApiError("Nope.", 500));
    render(<QuestionSetPicker catalogueUrl="/x" selected={null} onSelect={() => undefined} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Nope.");

    get.mockResolvedValueOnce(catalogue([]));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No question sets are available yet")).toBeTruthy();
  });
});

// ───────────────────────────── scheduling a test ─────────────────────────────

describe("CreateSoftSkillAssessmentModal — pick a question set, then publish", () => {
  const open = (onCreated = vi.fn()) => {
    get.mockResolvedValue(catalogue([setItem(1), setItem(7, used("Round 1 aptitude"))]));
    post.mockResolvedValue({ assessment: {} });
    render(<CreateSoftSkillAssessmentModal basePath="/tpo/soft-skills" setsPath="/tpo/soft-skill-question-sets" onClose={vi.fn()} onCreated={onCreated} />);
    return onCreated;
  };

  const fillDetails = () => {
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Campus Round 2" } });
    fireEvent.click(screen.getByRole("button", { name: /Next: question set/ }));
  };

  it("starts with the details and cannot move on without a title", () => {
    open();

    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Next: question set/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("creates the test, adds the chosen set and publishes it in ONE request", async () => {
    const onCreated = open();
    fillDetails();
    expect(await screen.findByText(/Step 2 of 2/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(await screen.findByRole("radio", { name: /Set 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add Set 1 & publish/ }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith("/tpo/soft-skills", { title: "Campus Round 2", description: undefined, duration_minutes: 45, pass_percentage: 60, question_set_id: 1, publish: true });
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ title: "Campus Round 2", published: true, setLabel: "Set 1" }));
  });

  it("can keep the test as a draft with the set", async () => {
    const onCreated = open();
    fillDetails();
    fireEvent.click(await screen.findByRole("radio", { name: /Set 1/ }));

    fireEvent.click(screen.getByRole("button", { name: /Save as draft with Set 1/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/soft-skills", expect.objectContaining({ question_set_id: 1, publish: false })));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ title: "Campus Round 2", published: false, setLabel: "Set 1" }));
  });

  it("can still create without any set (the old route: attach bank questions afterwards)", async () => {
    const onCreated = open();
    fillDetails();
    await screen.findByText(/Step 2 of 2/);

    fireEvent.click(screen.getByRole("button", { name: "Create without a set" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/soft-skills", expect.objectContaining({ question_set_id: undefined, publish: undefined })));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ title: "Campus Round 2", published: false, setLabel: null }));
  });

  it("an empty draft can be created straight from step 1", async () => {
    const onCreated = open();
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Quick" } });

    fireEvent.click(screen.getByRole("button", { name: "Create empty draft" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ title: "Quick", published: false, setLabel: null }));
  });

  it("shows the server's reason and stays open when the set is refused", async () => {
    const onCreated = open();
    post.mockRejectedValue(new ApiError("That question set is not available.", 422));
    fillDetails();
    fireEvent.click(await screen.findByRole("radio", { name: /Set 1/ }));

    fireEvent.click(screen.getByRole("button", { name: /Add Set 1 & publish/ }));

    expect((await screen.findByText("That question set is not available.")).textContent).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Add Set 1 & publish/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Back returns to the details with what was typed", async () => {
    open();
    fillDetails();
    await screen.findByText(/Step 2 of 2/);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect((screen.getByLabelText("Title *") as HTMLInputElement).value).toBe("Campus Round 2");
  });
});

describe("AddQuestionSetPanel — adding a set to an existing test", () => {
  const props = (over: Partial<React.ComponentProps<typeof AddQuestionSetPanel>> = {}) => ({
    setsPath: "/tpo/soft-skill-question-sets",
    basePath: "/tpo/soft-skills",
    assessmentSlug: "my-test",
    appliedSets: [],
    lockedReason: null,
    onAdded: vi.fn(),
    onToast: vi.fn(),
    ...over,
  });

  it("adds the chosen set and reports what happened", async () => {
    get.mockResolvedValue(catalogue([setItem(3)]));
    post.mockResolvedValue({ added: 24, skipped: 1, applied_sets: [{ id: 1, question_set_id: 3, set_title: "Soft Skill Assessment - Set 3", set_number: 3, questions_added: 24, created_at: "2026-10-12T10:00:00Z" }] });
    const p = props();
    render(<AddQuestionSetPanel {...p} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Set 3/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add Set 3 to this test/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/soft-skills/my-test/question-sets", { question_set_id: 3 }));
    await waitFor(() => expect(p.onAdded).toHaveBeenCalledWith(expect.objectContaining({ added: 24, skipped: 1, setLabel: "Set 3" })));
    expect(p.onToast).toHaveBeenCalledWith("Added 24 questions from Set 3 (1 already in the test were skipped).");
  });

  it("explains why it is locked and offers no picker", () => {
    render(<AddQuestionSetPanel {...props({ lockedReason: "Candidates have already taken this test, so its questions can no longer change." })} />);

    expect(screen.getByText(/Candidates have already taken this test/)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Browse sets" })).toBeNull();
  });

  it("lists the sets the test was built from and keeps them out of the picker", async () => {
    get.mockResolvedValue(catalogue([setItem(3), setItem(4)]));
    render(<AddQuestionSetPanel {...props({ appliedSets: [{ id: 1, question_set_id: 3, set_title: "Soft Skill Assessment - Set 3", set_number: 3, questions_added: 25, created_at: "x" }] })} />);

    expect(screen.getByText("Built from")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browse sets" }));
    await screen.findByText("Already in this test");
    expect(screen.queryByRole("radio", { name: /Set 3/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /Set 4/ })).toBeTruthy();
  });
});
