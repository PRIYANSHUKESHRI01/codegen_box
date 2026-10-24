import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillSummary } from "@/lib/drills/api";

// The full suite runs on a busy machine; a ten-question sitting can take longer than the default 1 s per wait.
configure({ asyncUtilTimeout: 5000 });

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  ApiError: class ApiError extends Error {},
}));

// Predictable questions: the component draws with seeds 97, 194, 291…, so a sitting can be replayed here (including its no-repeat retries).
let seedCounter = 0;
vi.mock("@/lib/drills/rng", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/drills/rng")>()), randomSeed: () => ++seedCounter * 97 }));

import { DrillSession } from "@/components/drills/DrillSession";
import { drawQuestion } from "@/lib/drills/session";
import type { Level } from "@/lib/drills/types";

const summary = (skills: DrillSummary["skills"] = {}, streak: Partial<DrillSummary["streak"]> = {}): DrillSummary => ({
  skills,
  streak: { current: 0, best: 0, active_today: false, today: 0, ...streak },
  week: { attempts: 0, days: 0 },
});

beforeEach(async () => {
  seedCounter = 0;
  get.mockReset();
  post.mockReset();
  post.mockResolvedValue({ accepted: 1, dropped: 0 });
  get.mockResolvedValue(summary());
  window.localStorage.clear();
  const queue = await import("@/lib/drills/api");
  queue.resetPendingAttempts();
});

/** The n-th question (1-based) a fixed-level sitting on `skill` shows. */
function nth(skill: string, level: Level, n: number) {
  const seen = new Set<string>();
  let counter = 0;
  let q = drawQuestion(skill, level, seen, () => ++counter * 97);
  for (let i = 1; i < n; i++) {
    seen.add(q.prompt);
    q = drawQuestion(skill, level, seen, () => ++counter * 97);
  }
  return q;
}

const answerNumber = (value: string) => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
};

describe("<DrillSession>", () => {
  it("shows the first question at the level the student's history says, once it has loaded", async () => {
    const strong = Array.from({ length: 9 }, () => [1, 1] as [number, number]); // nine right in a row: three levels' worth
    get.mockResolvedValue(summary({ ohms_law: { attempts: 9, correct: 9, last_at: "2026-10-01T00:00:00Z", recent: strong } }));
    render(<DrillSession skillId="ohms_law" />);

    expect(await screen.findByText(/Level 3 · Stretch/)).toBeTruthy();
    expect(screen.getByText("1 / 10")).toBeTruthy();
  });

  it("starts a newcomer at the warm-up, and still works when progress can't be loaded", async () => {
    get.mockRejectedValue(new Error("offline"));
    render(<DrillSession skillId="ohms_law" />);

    expect(await screen.findByText(/Level 1 · Warm-up/)).toBeTruthy();
    expect(screen.getByText(/couldn.t load your earlier progress/i)).toBeTruthy();
  });

  it("marks a right answer, shows the working, and queues the attempt with its level and pack", async () => {
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);
    const q = nth("ohms_law", 1, 1);
    expect(screen.getByRole("textbox")).toBeTruthy();

    answerNumber(q.solution.number!);

    const status = await screen.findByRole("status");
    expect(within(status).getByText("Correct")).toBeTruthy();
    expect(within(status).getByText(/Ohm.s law/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next question/ })).toBeTruthy();
    // not sent yet (batched), but queued
    const queue = await import("@/lib/drills/api");
    expect(queue.pendingAttemptCount()).toBe(1);
  });

  it("shows the right answer after a wrong one", async () => {
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);
    answerNumber("123456");

    const status = await screen.findByRole("status");
    expect(within(status).getByText("Not quite")).toBeTruthy();
    expect(within(status).getByText(/The answer is/)).toBeTruthy();
  });

  it("does not check an empty answer", async () => {
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);
    expect(screen.getByRole("button", { name: "Check answer" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Check answer" })).toHaveProperty("disabled", true);
  });

  it("checks with Enter inside the box, moves on with Enter, and never repeats a question", async () => {
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);
    const first = screen.getByRole("textbox");
    fireEvent.change(first, { target: { value: nth("ohms_law", 1, 1).solution.number! } });
    fireEvent.keyDown(first, { key: "Enter" });
    await screen.findByText("Correct");

    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(await screen.findByText("2 / 10")).toBeTruthy();
    expect(screen.queryByText("Correct")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("runs a whole sitting, then summarises it and sends every answer", async () => {
    post.mockResolvedValue({ accepted: 10, dropped: 0 });
    get.mockResolvedValue(summary({}, { current: 1, best: 1, active_today: true, today: 10 }));
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);

    for (let n = 1; n <= 10; n++) {
      answerNumber(n % 2 === 0 ? "999999" : nth("ohms_law", 1, n).solution.number!);
      fireEvent.click(await screen.findByRole("button", { name: n === 10 ? /See your results/ : /Next question/ }));
    }

    expect(await screen.findByLabelText("5 right out of 10")).toBeTruthy();
    expect(screen.getByText("Getting there")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Another 10/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "All skills" }).getAttribute("href")).toBe("/dashboard/drills");

    await waitFor(() => expect(post).toHaveBeenCalled());
    const sent = post.mock.calls.flatMap((c) => (c[1] as { attempts: { skill: string; pack: string; difficulty: number; correct: boolean }[] }).attempts);
    expect(sent).toHaveLength(10);
    expect(sent.every((a) => a.skill === "ohms_law" && a.pack === "circuits" && a.difficulty === 1)).toBe(true);
    expect(sent.filter((a) => a.correct)).toHaveLength(5);
    expect(await screen.findByText(/1-day streak/)).toBeTruthy();
  });

  it("can be ended early from the second question on", async () => {
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} />);
    await screen.findByText(/Level 1/);
    expect(screen.queryByRole("button", { name: "End this sitting" })).toBeNull();
    answerNumber("1");
    fireEvent.click(await screen.findByRole("button", { name: /Next question/ }));
    fireEvent.click(await screen.findByRole("button", { name: "End this sitting" }));
    expect(await screen.findByLabelText(/right out of 1/)).toBeTruthy();
  });

  it("raises the difficulty after three right answers in a row, and lowers it after two wrong", async () => {
    render(<DrillSession skillId="ohms_law" />);
    await screen.findByText(/Level 1 · Warm-up/);

    // three right at level 1 -> level 2
    for (let n = 1; n <= 3; n++) {
      answerNumber(nth("ohms_law", 1, n).solution.number!);
      fireEvent.click(await screen.findByRole("button", { name: /Next question/ }));
    }
    expect(await screen.findByText(/Level 2 · Standard/)).toBeTruthy();

    // two wrong in a row -> back to level 1
    for (let n = 4; n <= 5; n++) {
      answerNumber("999999");
      fireEvent.click(await screen.findByRole("button", { name: /Next question/ }));
    }
    expect(await screen.findByText(/Level 1 · Warm-up/)).toBeTruthy();
  });

  it("holds a level the student pins", async () => {
    render(<DrillSession skillId="ohms_law" />);
    await screen.findByText(/Level 1/);
    fireEvent.click(screen.getByRole("radio", { name: "3" }));
    answerNumber("1");
    fireEvent.click(await screen.findByRole("button", { name: /Next question/ }));
    expect(await screen.findByText(/Level 3 · Stretch/)).toBeTruthy();
  });

  it("lets a multiple-choice question be answered by its number key, then Enter", async () => {
    render(<DrillSession skillId="gate_output" pinnedLevel={1} />);
    await screen.findByRole("radiogroup", { name: "Choose an answer" });
    const q = nth("gate_output", 1, 1);
    if (q.answer.kind !== "choice") throw new Error("expected a choice question");
    const rightIndex = q.answer.options.findIndex((o) => o.id === q.solution.choice);

    const options = () => within(screen.getByRole("radiogroup", { name: "Choose an answer" })).getAllByRole("radio");
    fireEvent.keyDown(window, { key: String(rightIndex + 1) });
    expect(options()[rightIndex].getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(await screen.findByText("Correct")).toBeTruthy();
    expect(options().every((r) => (r as HTMLButtonElement).disabled)).toBe(true);
  });

  it("fills a truth table cell by cell and checks every row", async () => {
    render(<DrillSession skillId="truth_table" pinnedLevel={1} />);
    await screen.findByRole("table");
    const q = nth("truth_table", 1, 1);
    const column = q.solution.table!;
    const check = screen.getByRole("button", { name: "Check answer" });
    expect(check).toHaveProperty("disabled", true);

    const cells = screen.getAllByRole("button", { name: /^Row \d/ });
    expect(cells).toHaveLength(column.length);
    cells.forEach((cell, i) => {
      // first click sets 1, second flips to 0
      fireEvent.click(cell);
      if (column[i] === 0) fireEvent.click(cell);
    });
    expect(check).toHaveProperty("disabled", false);
    fireEvent.click(check);
    expect(await screen.findByText("Correct")).toBeTruthy();
  });

  it("says so, kindly, when the skill doesn't exist", () => {
    render(<DrillSession skillId="no_such_skill" />);
    expect(screen.getByRole("alert").textContent).toMatch(/couldn.t find that drill/i);
    expect(get).not.toHaveBeenCalled();
  });

  it("works inside a proctored sitting: answers carry its id, finishing ends it, and \"Another 10\" asks for a new one", async () => {
    const sitting = { sittingId: 7, end: vi.fn(), restart: vi.fn(), sittingRefused: () => false };
    render(<DrillSession skillId="ohms_law" pinnedLevel={1} sitting={sitting} />);
    await screen.findByText(/Level 1/);

    answerNumber(nth("ohms_law", 1, 1).solution.number!);
    fireEvent.click(await screen.findByRole("button", { name: /Next question/ }));
    expect(sitting.end).not.toHaveBeenCalled(); // still sitting
    fireEvent.click(await screen.findByRole("button", { name: "End this sitting" }));

    expect(sitting.end).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = post.mock.calls[0][1] as { sitting_id: number; attempts: Record<string, unknown>[] };
    expect(body.sitting_id).toBe(7);
    expect(body.attempts[0]).not.toHaveProperty("sitting_id");

    fireEvent.click(await screen.findByRole("button", { name: /Another 10/ }));
    expect(sitting.restart).toHaveBeenCalledTimes(1);
  });
});
