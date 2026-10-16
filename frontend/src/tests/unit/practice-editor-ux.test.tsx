import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunResponse } from "@/types/problem";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});

const routerPrefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: routerPrefetch }) }));

import { ApiError } from "@/lib/api";
import { executeJudged } from "@/lib/judge";
import { __resetProblemPrefetchForTests, invalidateProblem, loadProblem, prefetchProblem } from "@/lib/problemPrefetch";
import { __resetEditorWarmupForTests, warmUpEditor } from "@/lib/editorWarmup";
import { useJudgedRun } from "@/lib/useJudgedRun";
import { JudgingView } from "@/components/practice/JudgingView";
import { VerdictView, describeVerdict } from "@/components/practice/VerdictView";
import { ConsolePanel } from "@/components/practice/ConsolePanel";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";
import { SolveButton } from "@/components/practice/SolveButton";
import type { ProblemDetail } from "@/types/problem";

const caseOf = (n: number, over: Partial<RunResponse["results"][number]> = {}) => ({
  case: n,
  passed: true,
  input: `nums = [${n}]`,
  expected: `${n}`,
  actual: `${n}`,
  ...over,
});

const ACCEPTED: RunResponse = { all_passed: true, results: [caseOf(1), caseOf(2), caseOf(3, { hidden: true, input: undefined, expected: undefined, actual: undefined })], time: "0.02", memory: 4096 };

const WRONG: RunResponse = {
  all_passed: false,
  results: [caseOf(1), caseOf(2, { passed: false, actual: "99" }), caseOf(3, { hidden: true, passed: false, input: undefined, expected: undefined, actual: undefined }), caseOf(4, { not_run: true, passed: false, hidden: true })],
};

/** Let every timer the reveal uses run to the end. */
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(3000); });

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
  post.mockReset();
  routerPrefetch.mockReset();
  __resetProblemPrefetchForTests();
  __resetEditorWarmupForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ───────────────────────────── the verdict, in words ─────────────────────────────

describe("describeVerdict", () => {
  it("calls a fully passed Submit Accepted, and a fully passed Run only a sample pass", () => {
    expect(describeVerdict(ACCEPTED, "submit")).toMatchObject({ kind: "accepted", tone: "success", label: "Accepted", summary: "All 3 test cases passed." });
    expect(describeVerdict(ACCEPTED, "run")).toMatchObject({ kind: "samples_passed", tone: "success", label: "Sample cases passed" });
    expect(describeVerdict(ACCEPTED, "run").summary).toMatch(/submit to check the hidden ones/i);
  });

  it("says where a wrong answer failed first, and never leaks what a hidden case contains", () => {
    const verdict = describeVerdict(WRONG, "submit");

    expect(verdict).toMatchObject({ kind: "wrong_answer", tone: "danger", label: "Wrong Answer" });
    expect(verdict.summary).toBe("1 of 4 test cases passed — failed on case 2.");
    expect(describeVerdict({ ...WRONG, results: [caseOf(1), caseOf(2, { hidden: true, passed: false })] }, "submit").summary).toBe("1 of 2 test cases passed — failed on hidden case 2.");
  });

  it("tells a compile error, a crash and a timeout apart", () => {
    expect(describeVerdict({ results: [], all_passed: false, compile_error: "x" }, "run")).toMatchObject({ kind: "compile_error", label: "Compilation Error", tone: "danger" });
    expect(describeVerdict({ results: [], all_passed: false, runtime_error: "boom", status: "Runtime Error" }, "run")).toMatchObject({ kind: "runtime_error", tone: "danger", label: "Runtime Error" });
    expect(describeVerdict({ results: [], all_passed: false, runtime_error: "slow", status: "Time Limit Exceeded" }, "submit")).toMatchObject({ kind: "time_limit", tone: "warning", label: "Time Limit Exceeded" });
    expect(describeVerdict({ results: [], all_passed: false, runtime_error: "x", status: "Terminated (SIGKILL)" }, "submit").label).toBe("Terminated (SIGKILL)");
  });
});

// ───────────────────────────── while the judge works ─────────────────────────────

describe("JudgingView — it feels like the cases are being checked", () => {
  const started = () => Date.now();

  it("follows the judge's real stages: sent → waiting → running the test cases → verdict", () => {
    const { rerender } = render(<JudgingView action="submit" progress={{ phase: "sending" }} startedAt={started()} fallbackCases={3} />);

    expect(screen.getByText("Judging your submission")).toBeTruthy();
    expect(screen.getByText("Sending your code…")).toBeTruthy();

    rerender(<JudgingView action="submit" progress={{ phase: "queued", position: 12, totalCases: 10 }} startedAt={started()} fallbackCases={3} />);
    expect(screen.getByText("In queue — #12 in line")).toBeTruthy();

    rerender(<JudgingView action="submit" progress={{ phase: "running", totalCases: 10 }} startedAt={started()} fallbackCases={3} />);
    expect(screen.getByText("Running 10 test cases")).toBeTruthy();
    expect(screen.getByText(/checking your output on 10 test cases/i)).toBeTruthy();
    expect(screen.getByText("Verdict")).toBeTruthy();
  });

  it("draws one chip per test case — the real number once the server says it", () => {
    render(<JudgingView action="submit" progress={{ phase: "running", totalCases: 10 }} startedAt={started()} fallbackCases={3} />);

    expect(screen.getAllByTestId("judging-chip")).toHaveLength(10);
  });

  it("draws the cases it already knows about before the server says, and none when it does not know", () => {
    const { unmount } = render(<JudgingView action="submit" progress={{ phase: "sending" }} startedAt={started()} fallbackCases={10} />);
    expect(screen.getAllByTestId("judging-chip")).toHaveLength(10);
    unmount();

    render(<JudgingView action="submit" progress={{ phase: "sending" }} startedAt={started()} fallbackCases={0} />);
    expect(screen.queryAllByTestId("judging-chip")).toHaveLength(0);
  });

  it("the server's number wins over the page's", () => {
    render(<JudgingView action="submit" progress={{ phase: "running", totalCases: 12 }} startedAt={started()} fallbackCases={10} />);

    expect(screen.getAllByTestId("judging-chip")).toHaveLength(12);
  });

  it("where the judge answers in the same request (a synchronous queue), a request still out after half a second reads as running", async () => {
    render(<JudgingView action="submit" progress={{ phase: "sending" }} startedAt={Date.now()} fallbackCases={10} />);
    expect(screen.getByText("Sending your code…")).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(700); });

    expect(screen.getByText("Running 10 test cases")).toBeTruthy();
    expect(screen.getByText(/checking your output on 10 test cases/i)).toBeTruthy();
  });

  it("caps a very large case count instead of drawing a wall", () => {
    render(<JudgingView action="submit" progress={{ phase: "running", totalCases: 120 }} startedAt={started()} fallbackCases={3} />);

    expect(screen.getAllByTestId("judging-chip")).toHaveLength(40);
    expect(screen.getByText("+80 more")).toBeTruthy();
  });

  it("shows a live timer so a slow judge reads as working, not stuck", async () => {
    render(<JudgingView action="run" progress={{ phase: "running", totalCases: 3 }} startedAt={Date.now()} fallbackCases={3} />);

    expect(screen.getByText("0.0s")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(2300); });
    expect(screen.getByText("2.3s")).toBeTruthy();
  });

  it("announces itself to screen readers", () => {
    render(<JudgingView action="run" progress={{ phase: "running", totalCases: 3 }} startedAt={started()} fallbackCases={3} />);

    expect(screen.getByRole("status").getAttribute("aria-label")).toMatch(/running your code/i);
  });
});

// ───────────────────────────── the verdict arriving ─────────────────────────────

describe("VerdictView — checked, then Accepted / Wrong Answer / error", () => {
  it("settles the cases one by one and only then shows the verdict", async () => {
    render(<VerdictView result={ACCEPTED} action="submit" />);

    // At first: still checking, every chip pending, no verdict yet.
    expect(screen.getByText(/checking test cases… 0\/3/i)).toBeTruthy();
    expect(screen.queryByTestId("verdict-banner")).toBeNull();
    expect(screen.getAllByTestId("case-chip").every((chip) => chip.getAttribute("data-state") === "pending")).toBe(true);

    await settle();

    expect(screen.queryByText(/checking test cases/i)).toBeNull();
    expect(screen.getByTestId("verdict-banner").getAttribute("data-verdict")).toBe("accepted");
    expect(within(screen.getByTestId("verdict-banner")).getByText("Accepted")).toBeTruthy();
    expect(screen.getByText("All 3 test cases passed.")).toBeTruthy();
    expect(screen.getAllByTestId("case-chip").map((chip) => chip.getAttribute("data-state"))).toEqual(["passed", "passed", "passed"]);
    // Runtime and memory, when the judge measured them.
    expect(screen.getByText("0.02s")).toBeTruthy();
    expect(screen.getByText("4 MB")).toBeTruthy();
  });

  it("keeps even a hundred-case submission to about a second", async () => {
    const big: RunResponse = { all_passed: true, results: Array.from({ length: 100 }, (_, i) => caseOf(i + 1, { hidden: true })) };
    render(<VerdictView result={big} action="submit" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    expect(screen.getByTestId("verdict-banner")).toBeTruthy();
    expect(screen.getAllByTestId("case-chip")).toHaveLength(100);
  });

  it("opens on the first case that failed, with what went wrong", async () => {
    render(<VerdictView result={WRONG} action="submit" />);
    await settle();

    expect(screen.getByTestId("verdict-banner").getAttribute("data-verdict")).toBe("wrong_answer");
    expect(screen.getByText("1 of 4 test cases passed — failed on case 2.")).toBeTruthy();
    expect(screen.getAllByTestId("case-chip").map((chip) => chip.getAttribute("data-state"))).toEqual(["passed", "failed", "failed", "not_run"]);

    const detail = screen.getByTestId("case-detail");
    expect(within(detail).getByText("Case 2 — failed")).toBeTruthy();
    expect(within(detail).getByText("nums = [2]")).toBeTruthy(); // Input
    expect(within(detail).getByText("99")).toBeTruthy(); // Your output
  });

  it("lets the student look at any case — and shows a hidden one only as passed or failed", async () => {
    render(<VerdictView result={WRONG} action="submit" />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Case 3 (hidden) — failed" }));
    expect(screen.getByText(/hidden test case 3/i).textContent).toMatch(/failed/);
    expect(screen.getByText(/never show their input or expected output/i)).toBeTruthy();
    expect(screen.queryByTestId("case-detail")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Case 4 (hidden) — not evaluated" }));
    expect(screen.getByText(/wasn.t evaluated/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Case 1 — passed" }));
    expect(within(screen.getByTestId("case-detail")).getByText("Case 1 — passed")).toBeTruthy();
  });

  it("shows a compile error at once — there are no cases to check — with the compiler's message", () => {
    render(<VerdictView result={{ results: [], all_passed: false, compile_error: "main.py:3: SyntaxError: invalid syntax" }} action="run" />);

    expect(screen.getByTestId("verdict-banner").getAttribute("data-verdict")).toBe("compile_error");
    expect(screen.getByText("Compilation Error")).toBeTruthy();
    expect(screen.getByText("main.py:3: SyntaxError: invalid syntax")).toBeTruthy();
    expect(screen.queryByText(/checking test cases/i)).toBeNull();
  });

  it("names a timeout and a crash for what they are", async () => {
    const { unmount } = render(<VerdictView result={{ results: [caseOf(1)], all_passed: false, runtime_error: "Killed", status: "Time Limit Exceeded" }} action="submit" />);
    await settle();
    expect(screen.getByText("Time Limit Exceeded")).toBeTruthy();
    expect(screen.getByText(/too slow/i)).toBeTruthy();
    unmount();

    render(<VerdictView result={{ results: [], all_passed: false, runtime_error: "Traceback…", status: "Runtime Error" }} action="submit" />);
    expect(screen.getByText("Runtime Error")).toBeTruthy();
    expect(screen.getByText("Traceback…")).toBeTruthy();
  });

  it("shows no row of \"not evaluated\" cases under an error that stopped everything, but keeps how far a crash got", async () => {
    const stopped: RunResponse = { all_passed: false, runtime_error: "SyntaxError: expected ':'", status: "Runtime Error", results: [caseOf(1, { passed: false, not_run: true }), caseOf(2, { passed: false, not_run: true })] };
    const { unmount } = render(<VerdictView result={stopped} action="run" />);
    expect(screen.getByTestId("verdict-banner")).toBeTruthy(); // at once: there are no cases to check
    expect(screen.queryAllByTestId("case-chip")).toHaveLength(0);
    expect(screen.queryByText(/wasn.t evaluated/i)).toBeNull();
    expect(screen.getByText("SyntaxError: expected ':'")).toBeTruthy();
    unmount();

    // …but a crash on the third case still shows that two passed first.
    render(<VerdictView result={{ ...stopped, results: [caseOf(1), caseOf(2), caseOf(3, { passed: false, not_run: true })] }} action="run" />);
    await settle();
    expect(screen.getAllByTestId("case-chip").map((chip) => chip.getAttribute("data-state"))).toEqual(["passed", "passed", "not_run"]);
  });

  it("after a Run passes every sample, offers to Submit — and that goes to the real judge", async () => {
    const onSubmit = vi.fn();
    render(<VerdictView result={{ all_passed: true, results: [caseOf(1), caseOf(2)] }} action="run" onSubmit={onSubmit} />);
    await settle();

    expect(screen.getByText("Sample cases passed")).toBeTruthy();
    expect(screen.queryByText("Accepted")).toBeNull(); // only the real judge says that
    fireEvent.click(screen.getByRole("button", { name: /submit solution/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("offers no Submit shortcut after a Submit, or after a failed Run", async () => {
    const onSubmit = vi.fn();
    const { unmount } = render(<VerdictView result={ACCEPTED} action="submit" onSubmit={onSubmit} />);
    await settle();
    expect(screen.queryByRole("button", { name: /submit solution/i })).toBeNull();
    unmount();

    render(<VerdictView result={WRONG} action="run" onSubmit={onSubmit} />);
    await settle();
    expect(screen.queryByRole("button", { name: /submit solution/i })).toBeNull();
  });

  it("skips the choreography for someone who asked their system for less motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }) as unknown as MediaQueryList);

    render(<VerdictView result={ACCEPTED} action="submit" />);

    expect(screen.getByTestId("verdict-banner")).toBeTruthy();
    expect(screen.queryByText(/checking test cases/i)).toBeNull();
  });
});

// ───────────────────────────── the console around it ─────────────────────────────

describe("ConsolePanel", () => {
  const base = {
    examples: [{ input: "[1]", output: "1" }],
    activeExample: 0,
    onSelectExample: vi.fn(),
    onTabChange: vi.fn(),
    errorMessage: null,
  };

  it("draws the right number of cases for the action while it waits: a Run's samples, a Submit's everything", () => {
    const counts = { samples: 3, total: 10 };
    const { rerender } = render(<ConsolePanel {...base} activeTab="result" lastAction="run" runState="running" runResult={null} progress={{ phase: "sending" }} startedAt={Date.now()} caseCounts={counts} />);
    expect(screen.getAllByTestId("judging-chip")).toHaveLength(3);

    rerender(<ConsolePanel {...base} activeTab="result" lastAction="submit" runState="running" runResult={null} progress={{ phase: "sending" }} startedAt={Date.now()} caseCounts={counts} />);
    expect(screen.getAllByTestId("judging-chip")).toHaveLength(10);
  });

  it("shows the judging view while a run is in flight, with a spinner on the Result tab", () => {
    render(<ConsolePanel {...base} activeTab="result" lastAction="submit" runState="running" runResult={null} progress={{ phase: "running", totalCases: 7 }} startedAt={Date.now()} />);

    expect(screen.getByText("Judging your submission")).toBeTruthy();
    expect(screen.getByText("Running 7 test cases")).toBeTruthy();
    expect(screen.getByLabelText("Running")).toBeTruthy();
  });

  it("plays a verdict's reveal once — flipping to Testcase and back never replays it", async () => {
    const props = { ...base, lastAction: "submit" as const, runState: "done" as const, runResult: ACCEPTED, resultKey: 1 };
    const { rerender } = render(<ConsolePanel {...props} activeTab="result" />);
    await settle();
    expect(screen.getByTestId("verdict-banner")).toBeTruthy();

    rerender(<ConsolePanel {...props} activeTab="testcase" />);
    rerender(<ConsolePanel {...props} activeTab="result" />);

    expect(screen.getByTestId("verdict-banner")).toBeTruthy();
    expect(screen.queryByText(/checking test cases/i)).toBeNull();
  });

  it("plays it again for a new result", async () => {
    const props = { ...base, lastAction: "submit" as const, runState: "done" as const, activeTab: "result" as const };
    const { rerender } = render(<ConsolePanel {...props} runResult={ACCEPTED} resultKey={1} />);
    await settle();

    rerender(<ConsolePanel {...props} runResult={WRONG} resultKey={2} />);
    expect(screen.getByText(/checking test cases/i)).toBeTruthy();
    await settle();
    expect(screen.getByTestId("verdict-banner").getAttribute("data-verdict")).toBe("wrong_answer");
  });

  it("puts the outcome on the Result tab — but only once it has been revealed, never ahead of it", async () => {
    const { rerender } = render(<ConsolePanel {...base} activeTab="result" lastAction="submit" runState="done" runResult={ACCEPTED} resultKey={1} />);
    expect(screen.queryByTestId("result-tab-dot")).toBeNull(); // still checking the cases
    await settle();
    expect(screen.getByTestId("result-tab-dot").className).toContain("bg-status-success");

    rerender(<ConsolePanel {...base} activeTab="testcase" lastAction="submit" runState="done" runResult={WRONG} resultKey={2} />);
    expect(screen.queryByTestId("result-tab-dot")).toBeNull(); // a new result: the old dot is gone until this one is revealed
    await settle();
    expect(screen.getByTestId("result-tab-dot").className).toContain("bg-status-danger");
  });

  it("says when the judge could not be reached, and offers to try again", () => {
    const onRetry = vi.fn();
    render(<ConsolePanel {...base} activeTab="result" lastAction="run" runState="error" runResult={null} errorMessage="The judge is at capacity right now." onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain("The judge is at capacity right now.");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("invites a first run when nothing has run yet", () => {
    render(<ConsolePanel {...base} activeTab="result" lastAction={null} runState="idle" runResult={null} />);

    expect(screen.getByText(/run your code to see program output/i)).toBeTruthy();
  });
});

// ───────────────────────────── the buttons ─────────────────────────────

describe("ProblemHeaderBar", () => {
  const problem = { id: 1, slug: "two-sum", title: "Two Sum", serial_number: 101, difficulty: "easy", tags: ["Array"], companies: null, acceptance_rate: "50", total_submissions: 10, solved: false } as unknown as ProblemDetail;
  const bar = (props: Partial<React.ComponentProps<typeof ProblemHeaderBar>> = {}) =>
    render(<ProblemHeaderBar problem={problem} onBack={vi.fn()} onRun={vi.fn()} onSubmit={vi.fn()} {...props} />);

  it("shows which button was pressed: Run says Running…, the Submit beside it just waits", () => {
    bar({ running: true, activeAction: "run" });

    expect(screen.getByRole("button", { name: /running…/i })).toBeTruthy();
    const submit = screen.getByRole("button", { name: /^submit$/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("shows Submit judging while a submission is out", () => {
    bar({ running: true, activeAction: "submit" });

    expect(screen.getByRole("button", { name: /judging…/i })).toBeTruthy();
    expect((screen.getByRole("button", { name: /^run$/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is plain Run and Submit when idle, with the shortcuts in their tooltips", () => {
    bar();

    expect(screen.getByRole("button", { name: /^run$/i }).getAttribute("title")).toMatch(/ctrl\/cmd \+ enter/i);
    expect(screen.getByRole("button", { name: /^submit$/i }).getAttribute("title")).toMatch(/shift \+ enter/i);
  });

  it("marks a problem as Solved the moment it is", () => {
    bar({ problem: { ...problem, solved: true } });

    expect(screen.getByText("Solved")).toBeTruthy();
  });
});

describe("SolveButton", () => {
  it("answers a press at once: Opening…, busy, and locked", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<SolveButton slug="two-sum" opening={false} disabled={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "Solve" }));
    expect(onOpen).toHaveBeenCalledWith("two-sum");

    rerender(<SolveButton slug="two-sum" opening disabled onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: /opening…/i }) as HTMLButtonElement;
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
  });

  it("is switched off, not spinning, while a different problem is opening", () => {
    render(<SolveButton slug="two-sum" opening={false} disabled onOpen={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Solve" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("starts getting the next screen ready as soon as the pointer is over it", () => {
    get.mockResolvedValue({ problem: { slug: "two-sum" } });
    render(<SolveButton slug="two-sum" opening={false} disabled={false} onOpen={vi.fn()} />);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Solve" }));

    expect(get).toHaveBeenCalledWith("/problems/two-sum"); // the problem
    expect(routerPrefetch).toHaveBeenCalledWith("/dashboard/practice/view?slug=two-sum"); // the screen's code
  });

  it("does the same for keyboard focus and a touch", () => {
    get.mockResolvedValue({ problem: { slug: "a" } });
    render(<SolveButton slug="a" opening={false} disabled={false} onOpen={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Solve" });

    fireEvent.focus(button);
    fireEvent.touchStart(button);

    expect(routerPrefetch).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(1); // the problem itself is only fetched once
  });
});

// ───────────────────────────── the plumbing ─────────────────────────────

describe("problem prefetch", () => {
  it("hands the solve screen the request the Solve button already started", async () => {
    get.mockResolvedValue({ problem: { slug: "two-sum" } });

    prefetchProblem("two-sum");
    const loaded = await loadProblem("two-sum");

    expect(loaded).toEqual({ problem: { slug: "two-sum" } });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("asks again once the answer is stale, or was invalidated by a submission", async () => {
    get.mockResolvedValue({ problem: { slug: "two-sum" } });

    prefetchProblem("two-sum");
    await vi.advanceTimersByTimeAsync(31_000);
    await loadProblem("two-sum");
    expect(get).toHaveBeenCalledTimes(2);

    invalidateProblem("two-sum");
    await loadProblem("two-sum");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("never serves a failed prefetch — the screen asks for real and sees the real error", async () => {
    get.mockRejectedValueOnce(new ApiError("down", 503)).mockResolvedValueOnce({ problem: { slug: "two-sum" } });

    prefetchProblem("two-sum");
    await vi.advanceTimersByTimeAsync(0);

    await expect(loadProblem("two-sum")).resolves.toEqual({ problem: { slug: "two-sum" } });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("keeps only a handful of problems", async () => {
    get.mockResolvedValue({ problem: {} });

    for (let i = 0; i < 12; i++) prefetchProblem(`p-${i}`);
    get.mockClear();

    await loadProblem("p-0"); // the oldest was dropped…
    expect(get).toHaveBeenCalledTimes(1);
    await loadProblem("p-11"); // …the newest is still warm
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("editor warm-up", () => {
  it("is safe to call from anywhere, any number of times", () => {
    expect(() => {
      warmUpEditor();
      warmUpEditor();
    }).not.toThrow();
  });
});

describe("the judge client passes the case count through", () => {
  it("reports it with each queued / running poll", async () => {
    post.mockResolvedValue({ state: "queued", token: "t1", position: 4, total_cases: 10, poll_after_ms: 10 });
    get.mockResolvedValueOnce({ state: "running", token: "t1", total_cases: 10, poll_after_ms: 10 }).mockResolvedValueOnce({ state: "done", token: "t1", http_status: 200, result: { all_passed: true, results: [] } });
    const seen: unknown[] = [];

    const promise = executeJudged<RunResponse>("/problems/two-sum/submit", { language: "python", code: "x" }, (p) => seen.push(p));
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(seen).toEqual([
      { state: "queued", position: 4, totalCases: 10 },
      { state: "running", position: undefined, totalCases: 10 },
    ]);
  });
});

describe("useJudgedRun", () => {
  const verdict: RunResponse = { all_passed: true, results: [caseOf(1), caseOf(2)] };

  it("goes sending → running → done, following the judge, and holds a verdict that came straight back for a beat", async () => {
    post.mockResolvedValue({ state: "done", token: null, http_status: 200, result: verdict }); // cached: instant
    const onStart = vi.fn();
    const onVerdict = vi.fn();
    const { result } = renderHook(() => useJudgedRun({ endpoint: "/problems/two-sum", language: "python", code: "x", onStart, onVerdict }));

    expect(result.current.state).toBe("idle");
    let finished = false;
    act(() => {
      void result.current.execute("run").then(() => { finished = true; });
    });

    expect(result.current.state).toBe("running");
    expect(result.current.lastAction).toBe("run");
    expect(onStart).toHaveBeenCalledWith("run");
    expect(post).toHaveBeenCalledWith("/problems/two-sum/run", { language: "python", code: "x" });

    // It came straight back, so the cases are shown being checked for the rest of the beat…
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.state).toBe("running");
    expect(result.current.progress).toEqual({ phase: "running", totalCases: 2 });

    // …and then the verdict.
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(finished).toBe(true);
    expect(result.current.state).toBe("done");
    expect(result.current.result).toEqual(verdict);
    expect(result.current.resultKey).toBe(1);
    expect(onVerdict).toHaveBeenCalledWith("run", verdict);
  });

  it("never waits extra when the judge itself took longer than the beat", async () => {
    post.mockResolvedValue({ state: "queued", token: "t", position: 1, total_cases: 2, poll_after_ms: 1000 });
    get.mockResolvedValue({ state: "done", token: "t", http_status: 200, result: verdict });
    const { result } = renderHook(() => useJudgedRun({ endpoint: "/problems/two-sum", language: "python", code: "x" }));

    act(() => { void result.current.execute("submit"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });

    expect(result.current.state).toBe("done");
  });

  it("surfaces the server's reason when the judge cannot take the work, and can try again", async () => {
    post.mockRejectedValueOnce(new ApiError("The judge is at capacity right now. Please try again in a few seconds.", 503));
    const { result } = renderHook(() => useJudgedRun({ endpoint: "/problems/two-sum", language: "python", code: "x" }));

    await act(async () => { await result.current.execute("submit"); });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("The judge is at capacity right now. Please try again in a few seconds.");

    post.mockResolvedValue({ state: "done", token: null, http_status: 200, result: verdict });
    act(() => { void result.current.execute("submit"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(result.current.state).toBe("done");
    expect(result.current.error).toBeNull();
  });

  it("ignores a second press while one is out, and does nothing before the problem is known", async () => {
    post.mockResolvedValue({ state: "queued", token: "t", position: 1, poll_after_ms: 5000 });
    const { result, rerender } = renderHook((props: { endpoint: string | null }) => useJudgedRun({ endpoint: props.endpoint, language: "python", code: "x" }), { initialProps: { endpoint: null as string | null } });

    await act(async () => { await result.current.execute("run"); });
    expect(post).not.toHaveBeenCalled();

    rerender({ endpoint: "/problems/two-sum" });
    act(() => { void result.current.execute("run"); });
    act(() => { void result.current.execute("submit"); });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it("always sends the latest code, even from a long-lived handler", async () => {
    post.mockResolvedValue({ state: "done", token: null, http_status: 200, result: verdict });
    const { result, rerender } = renderHook((props: { code: string }) => useJudgedRun({ endpoint: "/problems/two-sum", language: "python", code: props.code }), { initialProps: { code: "old" } });
    const staleExecute = result.current.execute;

    rerender({ code: "new" });
    await act(async () => { void staleExecute("run"); await vi.advanceTimersByTimeAsync(1000); });

    expect(post).toHaveBeenCalledWith("/problems/two-sum/run", { language: "python", code: "new" });
  });
});
