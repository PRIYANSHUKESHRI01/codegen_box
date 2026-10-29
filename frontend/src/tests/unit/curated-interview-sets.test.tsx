import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CuratedSetsExplorer } from "@/components/dashboard/interviews/CuratedSetsExplorer";
import { api } from "@/lib/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(msg: string, status: number, _errors?: any, code?: string) {
      super(msg);
      this.status = status;
      this.code = code;
    }
  },
}));

const mockCatalog = {
  roles: [
    {
      key: "backend",
      title: "Backend Developer",
      blurb: "Server-side architecture, APIs, caching, and databases.",
      icon: "Server",
      badge: "High Demand",
      color: "indigo",
      stacks_count: 1,
      sets_count: 3,
      stacks: [
        {
          key: "laravel",
          name: "Laravel (PHP)",
          blurb: "Modern PHP, Eloquent ORM, Service Container.",
          icon: "Code2",
          sets_count: 3,
          sets: [
            {
              id: "backend-laravel-s1-set1",
              set_number: 1,
              title: "Set 1: Architecture & Request Lifecycle",
              duration_minutes: 15,
              description: "Fundamental concepts of Laravel HTTP request lifecycle.",
              tags: ["laravel", "routing"],
              question_count: 5,
              preview_questions: [
                "Walk through the lifecycle of an incoming HTTP request in Laravel.",
                "What is the Service Container in Laravel?",
              ],
            },
            {
              id: "backend-laravel-s1-set2",
              set_number: 2,
              title: "Set 2: Eloquent ORM & Relationships",
              duration_minutes: 15,
              description: "Advanced database modeling with Eloquent.",
              tags: ["laravel", "eloquent"],
              question_count: 5,
              preview_questions: ["Explain the N+1 query problem in Eloquent."],
            },
            {
              id: "backend-laravel-s1-set3",
              set_number: 3,
              title: "Set 3: Systems Design & Caching",
              duration_minutes: 15,
              description: "High concurrency and security in Laravel.",
              tags: ["laravel", "security"],
              question_count: 5,
              preview_questions: ["Explain token authorization and rotation in Laravel Sanctum."],
            },
          ],
        },
      ],
    },
  ],
  stats: {
    total_roles: 1,
    total_stacks: 1,
    total_sets: 3,
    total_questions: 15,
  },
};

const mockQualStatusInProgress = {
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
    sets: [
      {
        set_number: 1,
        set_id: "backend-laravel-s1-set1",
        title: "Set 1: Architecture & Request Lifecycle",
        description: "Fundamental concepts of Laravel HTTP request lifecycle.",
        duration_minutes: 15,
        question_count: 5,
        preview_questions: ["Sample question 1"],
        status: "not_started",
        score_percent: null,
        interview_slug: null,
      },
      {
        set_number: 2,
        set_id: "backend-laravel-s1-set2",
        title: "Set 2: Eloquent ORM & Relationships",
        description: "Advanced database modeling with Eloquent.",
        duration_minutes: 15,
        question_count: 5,
        preview_questions: ["Sample question 2"],
        status: "not_started",
        score_percent: null,
        interview_slug: null,
      },
      {
        set_number: 3,
        set_id: "backend-laravel-s1-set3",
        title: "Set 3: Systems Design & Caching",
        description: "High concurrency and security in Laravel.",
        duration_minutes: 15,
        question_count: 5,
        preview_questions: ["Sample question 3"],
        status: "not_started",
        score_percent: null,
        interview_slug: null,
      },
    ],
    completed_sets_count: 0,
    all_sets_completed: false,
    series_average: null,
  },
  past_attempts: [],
};

describe("CuratedSetsExplorer — Qualification Circuit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/curated-interview-sets") {
        return Promise.resolve(mockCatalog);
      }
      if (url.startsWith("/vault-qualification/status")) {
        return Promise.resolve(mockQualStatusInProgress);
      }
      return Promise.reject(new Error("Not found"));
    });
  });

  it("renders catalog roles, stats and breadcrumbs correctly", async () => {
    render(<CuratedSetsExplorer />);

    await waitFor(() => {
      expect(screen.getByText("Technical Interview Qualification Circuit")).toBeTruthy();
      expect(screen.getByText("15 Authentic Questions")).toBeTruthy();
    });

    expect(screen.getByText("Backend Developer")).toBeTruthy();
    expect(screen.getByText("High Demand")).toBeTruthy();
  });

  it("navigates into stack selector and then into qualification series", async () => {
    render(<CuratedSetsExplorer />);

    await waitFor(() => {
      expect(screen.getByText("Backend Developer")).toBeTruthy();
    });

    // Step 1: Click Backend Developer
    fireEvent.click(screen.getByText("Backend Developer"));

    expect(screen.getByText(/Step 2: Choose Your Track in Backend Developer/i)).toBeTruthy();
    expect(screen.getByText("Laravel (PHP)")).toBeTruthy();

    // Step 2: Click Laravel (PHP)
    fireEvent.click(screen.getByText("Laravel (PHP)"));

    // Step 3: Displays Qualification Circuit
    await waitFor(() => {
      expect(screen.getByText("Laravel (PHP) Qualification Track")).toBeTruthy();
      expect(screen.getByText("Attempt 1 of 3")).toBeTruthy();
      expect(screen.getByText("Set 1: Architecture & Request Lifecycle")).toBeTruthy();
      expect(screen.getByText("Set 2: Eloquent ORM & Relationships")).toBeTruthy();
      expect(screen.getByText("Set 3: Systems Design & Caching")).toBeTruthy();
    });
  });

  it("starts a qualification set via /vault-qualification/start-set and navigates", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      interview: {
        id: 101,
        slug: "laravel-s1-set1-test",
        title: "Laravel Set 1",
        question_count: 5,
      },
    });

    render(<CuratedSetsExplorer />);

    await waitFor(() => {
      expect(screen.getByText("Backend Developer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Backend Developer"));
    fireEvent.click(screen.getByText("Laravel (PHP)"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Set 1/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Start Set 1/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/vault-qualification/start-set", {
        stack: "laravel",
        set_number: 1,
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard/vault-interviews/view?slug=laravel-s1-set1-test");
    });
  });

  it("shows a set that was sat but not yet scored as Scoring, with a link to its result", async () => {
    const scoring = {
      ...mockQualStatusInProgress,
      active_series: {
        ...mockQualStatusInProgress.active_series,
        sets: mockQualStatusInProgress.active_series.sets.map((set, i) =>
          i === 0 ? { ...set, status: "scoring", interview_slug: "laravel-s1-set1-test" } : set
        ),
      },
    };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith("/vault-qualification/status")) return Promise.resolve(scoring);
      return Promise.resolve(mockCatalog);
    });

    render(<CuratedSetsExplorer />);

    await waitFor(() => expect(screen.getByText("Backend Developer")).toBeTruthy());
    fireEvent.click(screen.getByText("Backend Developer"));
    fireEvent.click(screen.getByText("Laravel (PHP)"));

    await waitFor(() => expect(screen.getByText("Scoring…")).toBeTruthy());
    const link = screen.getByRole("link", { name: /View Result/i });
    expect(link.getAttribute("href")).toBe("/dashboard/vault-interviews/view?slug=laravel-s1-set1-test");
    // The set cannot be started a second time while it is being scored.
    expect(screen.queryByRole("button", { name: /Start Set 1/i })).toBeNull();
  });

  it("looks again while a set is being scored, so the score appears by itself — and stops looking once it has", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const statusWith = (set1: Record<string, unknown>) => ({
        ...mockQualStatusInProgress,
        active_series: { ...mockQualStatusInProgress.active_series, sets: mockQualStatusInProgress.active_series.sets.map((set, i) => (i === 0 ? { ...set, ...set1 } : set)) },
      });
      let asked = 0;
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url.startsWith("/vault-qualification/status")) {
          asked += 1;
          return Promise.resolve(asked === 1 ? statusWith({ status: "scoring", interview_slug: "laravel-s1-set1-test" }) : statusWith({ status: "completed", score_percent: 72, interview_slug: "laravel-s1-set1-test" }));
        }
        return Promise.resolve(mockCatalog);
      });

      render(<CuratedSetsExplorer />);
      await waitFor(() => expect(screen.getByText("Backend Developer")).toBeTruthy());
      fireEvent.click(screen.getByText("Backend Developer"));
      fireEvent.click(screen.getByText("Laravel (PHP)"));
      await waitFor(() => expect(screen.getByText("Scoring…")).toBeTruthy());

      await vi.advanceTimersByTimeAsync(4200);

      await waitFor(() => expect(screen.getByText("72%")).toBeTruthy());
      expect(screen.queryByText("Scoring…")).toBeNull();
      const askedWhenScored = asked;
      await vi.advanceTimersByTimeAsync(12000);
      expect(asked).toBe(askedWhenScored);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders 45-day cooldown lockout banner when 3 attempts are exhausted", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/curated-interview-sets") {
        return Promise.resolve(mockCatalog);
      }
      if (url.startsWith("/vault-qualification/status")) {
        return Promise.resolve({
          ...mockQualStatusInProgress,
          status: "cooling_down",
          is_cooling_down: true,
          current_attempt: 3,
          cooldown_until: "2026-12-11T10:00:00Z",
          cooldown_formatted_date: "11 Dec 2026, 10:00 AM",
          cooldown_days_remaining: 45,
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    render(<CuratedSetsExplorer />);

    await waitFor(() => {
      expect(screen.getByText("Backend Developer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Backend Developer"));
    fireEvent.click(screen.getByText("Laravel (PHP)"));

    await waitFor(() => {
      expect(screen.getByText(/45-Day Preparation Cooldown Active/i)).toBeTruthy();
      expect(screen.getByText(/Vault Qualification Limit Reached \(Attempt 3 of 3\)/i)).toBeTruthy();
      expect(screen.getByText("45 Days Remaining")).toBeTruthy();
      expect(screen.getByText("11 Dec 2026, 10:00 AM")).toBeTruthy();
      expect(screen.getByText("AptRun Problem Bank")).toBeTruthy();
      expect(screen.getByText("System Drills")).toBeTruthy();
    });
  });

  it("renders celebration banner when qualified (average >= 60%)", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/curated-interview-sets") {
        return Promise.resolve(mockCatalog);
      }
      if (url.startsWith("/vault-qualification/status")) {
        return Promise.resolve({
          ...mockQualStatusInProgress,
          status: "qualified",
          is_qualified: true,
        });
      }
      return Promise.reject(new Error("Not found"));
    });

    render(<CuratedSetsExplorer />);

    await waitFor(() => {
      expect(screen.getByText("Backend Developer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Backend Developer"));
    fireEvent.click(screen.getByText("Laravel (PHP)"));

    await waitFor(() => {
      expect(screen.getByText("Mellow Vault Verified")).toBeTruthy();
      expect(screen.getByText(/Congratulations! You Are Qualified for Mellow Vault/i)).toBeTruthy();
      expect(screen.getByText("View Your Vault Profile")).toBeTruthy();
    });
  });

  describe("the redesigned circuit", () => {
    const open = async (status: unknown) => {
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === "/curated-interview-sets") return Promise.resolve(mockCatalog);
        if (url.startsWith("/vault-qualification/status")) return Promise.resolve(status);
        return Promise.reject(new Error("Not found"));
      });
      render(<CuratedSetsExplorer />);
      await waitFor(() => expect(screen.getByText("Backend Developer")).toBeTruthy());
      fireEvent.click(screen.getByText("Backend Developer"));
      fireEvent.click(screen.getByText("Laravel (PHP)"));
    };

    const withSets = (statuses: Array<[("not_started" | "completed" | "in_progress"), number | null]>, over: Record<string, unknown> = {}) => ({
      ...mockQualStatusInProgress,
      ...over,
      active_series: {
        ...mockQualStatusInProgress.active_series,
        sets: mockQualStatusInProgress.active_series.sets.map((set, i) => ({
          ...set,
          status: statuses[i][0],
          score_percent: statuses[i][1],
          interview_slug: statuses[i][0] === "completed" ? `slug-${i + 1}` : null,
        })),
        completed_sets_count: statuses.filter(([st]) => st === "completed").length,
        series_average: (over.series_average as number | null | undefined) ?? null,
      },
    });

    it("says whether each finished set cleared the 60% line", async () => {
      await open(withSets([["completed", 72], ["completed", 45], ["not_started", null]]));

      await waitFor(() => expect(screen.getByText("Above the 60% line")).toBeTruthy());
      expect(screen.getByText(/Below the 60% line/)).toBeTruthy();
      expect(screen.getByRole("img", { name: "Round 1 score: 72 out of 100" })).toBeTruthy();
      expect(screen.getByRole("img", { name: "Round 2 score: 45 out of 100" })).toBeTruthy();
    });

    it("shows the series progress and its average so far", async () => {
      await open(withSets([["completed", 70], ["completed", 50], ["not_started", null]], { series_average: 60 }));

      await waitFor(() => expect(screen.getByText("2 of 3 sets completed · need 60% average")).toBeTruthy());
      expect(screen.getByRole("img", { name: "Series average: 60 out of 100" })).toBeTruthy();
    });

    it("shows an empty ring, not a fake zero, before any series average exists", async () => {
      await open(mockQualStatusInProgress);

      await waitFor(() => expect(screen.getByRole("img", { name: "Series average: not scored yet" })).toBeTruthy());
    });

    it("lists the previous attempts, which the API always returned and the page never showed", async () => {
      await open(
        withSets([["not_started", null], ["not_started", null], ["not_started", null]], {
          current_attempt: 2,
          past_attempts: [{ attempt: 1, series_number: 1, scores: { "1": 40, "2": 50, "3": 30 }, average: 40, evaluated_at: "2026-10-20T10:00:00Z", passed: false }],
        })
      );

      const region = await screen.findByRole("region", { name: "Previous attempts" });
      expect(region.textContent).toContain("Attempt 1");
      expect(region.textContent).toContain("40% average");
      expect(region.textContent).toContain("S2 50%");
      expect(screen.getByText("Attempt 2 of 3")).toBeTruthy();
      expect(screen.getByText(/New Series Unlocked for Attempt 2 of 3/)).toBeTruthy();
    });

    it("has no previous-attempts section on a first attempt", async () => {
      await open(mockQualStatusInProgress);

      await screen.findByText("Attempt 1 of 3");
      expect(screen.queryByRole("region", { name: "Previous attempts" })).toBeNull();
    });

    it("never asks a student to upgrade: no plan is needed, so a refusal is just its message", async () => {
      vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error("You have exhausted all 3 qualification attempts."), { status: 402 }));
      await open(mockQualStatusInProgress);

      fireEvent.click(await screen.findByRole("button", { name: /Start Set 1/i }));

      expect((await screen.findByRole("alert")).textContent).toContain("Could not launch interview");
      expect(screen.queryByText(/Upgrade/i)).toBeNull();
      expect(screen.queryByRole("link", { name: /Upgrade/i })).toBeNull();
      // And the button is usable again.
      expect((screen.getByRole("button", { name: /Start Set 1/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("opens a set's sample questions with a keyboard-friendly toggle", async () => {
      await open(mockQualStatusInProgress);

      const toggle = (await screen.findAllByRole("button", { name: /Preview sample questions/ }))[0];
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Sample question 1")).toBeTruthy();
    });

    it("offers a way back when the catalogue cannot be loaded", async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error("offline"));
      vi.mocked(api.get).mockImplementation((url: string) => (url === "/curated-interview-sets" ? Promise.resolve(mockCatalog) : Promise.reject(new Error("x"))));
      render(<CuratedSetsExplorer />);

      fireEvent.click(await screen.findByRole("button", { name: /Try again/ }));

      await waitFor(() => expect(screen.getByText("Backend Developer")).toBeTruthy());
    });

    it("lets a student step back to an earlier step from the trail", async () => {
      await open(mockQualStatusInProgress);
      await screen.findByText("Attempt 1 of 3");

      fireEvent.click(within(screen.getByRole("navigation", { name: "Curated Sets Trail" })).getByRole("button", { name: /All Roles/ }));

      expect(screen.getByText("Step 1: Choose Your Domain")).toBeTruthy();
    });
  });
});
