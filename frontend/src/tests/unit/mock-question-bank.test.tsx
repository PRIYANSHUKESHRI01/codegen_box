import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockAdminStack, MockCoverage } from "@/types/mockInterview";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const postFormData = vi.fn();
const confirm = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (p: string) => get(p),
      post: (p: string, b?: unknown) => post(p, b),
      put: (p: string, b?: unknown) => put(p, b),
      delete: (p: string) => del(p),
      postFormData: (p: string, f: FormData) => postFormData(p, f),
      getFile: vi.fn(),
    },
  };
});
vi.mock("@/lib/dialogs", () => ({ confirmDialog: (o: unknown) => confirm(o) }));

import { MockQuestionBank } from "@/components/admin/mockInterviews/MockQuestionBank";

const toast = vi.fn();

const coverage = (): MockCoverage => ({
  min_questions: 5,
  stats: { stacks: 2, live: 1, coming_soon: 1 },
  roles: [
    {
      key: "backend",
      title: "Backend Developer",
      color: "indigo",
      stacks: [
        { key: "laravel", name: "Laravel (PHP)", aliases: ["Laravel Developer"], live: true, ready_rounds: 1, total_rounds: 3, questions: 7, grid: [5, 2, 0] },
        { key: "nodejs", name: "Node.js", aliases: [], live: false, ready_rounds: 0, total_rounds: 3, questions: 0, grid: [0, 0, 0] },
      ],
    },
  ],
});

const detail = (count: number): MockAdminStack => ({
  key: "nodejs",
  name: "Node.js",
  blurb: "",
  role: { key: "backend", title: "Backend Developer" },
  live: count >= 5,
  min_questions: 5,
  rounds: [1, 2, 3].map((n) => ({
    id: `mock-nodejs-r${n}`,
    round_number: n,
    title: `Round ${n}: Theme ${n}`,
    description: `About round ${n}.`,
    ready: n === 1 && count >= 5,
    questions:
      n === 1
        ? Array.from({ length: count }, (_, i) => ({ id: i + 1, text: `Explain how you would design the number ${i + 1} part of a Node.js service.`, category: "technical" as const, duration_seconds: 180, note: i === 0 ? "event loop, streams" : null, topic: i === 0 ? "Lights, Shapes & Sound Signals" : null, needs_review: i === 0 }))
        : [],
  })),
});

beforeEach(() => {
  [get, post, put, del, postFormData, confirm, toast].forEach((m) => m.mockReset());
});
afterEach(cleanup);

describe("<MockQuestionBank>", () => {
  it("lists every stack with its question count per round, and which are open", async () => {
    get.mockResolvedValue(coverage());
    render(<MockQuestionBank onToast={toast} />);

    expect(await screen.findByText("Laravel (PHP)")).toBeTruthy();
    expect(screen.getByText("7 questions · 1 of 3 rounds ready")).toBeTruthy();
    expect(screen.getByTitle("Round 1: 5 of 5 needed")).toBeTruthy();
    // the filter button and the stack's chip
    expect(screen.getAllByText("Open")).toHaveLength(2);
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(get).toHaveBeenCalledWith("/admin/mock-interview-bank/coverage");
  });

  it("filters to the stacks still coming soon, and searches by a domain name", async () => {
    get.mockResolvedValue(coverage());
    render(<MockQuestionBank onToast={toast} />);
    await screen.findByText("Laravel (PHP)");

    fireEvent.click(screen.getByRole("button", { name: "Coming soon" }));
    expect(screen.queryByText("Laravel (PHP)")).toBeNull();
    expect(screen.getByText("Node.js")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByPlaceholderText(/Search a stack or domain/), { target: { value: "laravel developer" } });
    expect(screen.getByText("Laravel (PHP)")).toBeTruthy();
    expect(screen.queryByText("Node.js")).toBeNull();
  });

  it("adds a question to a round and shows it at once", async () => {
    get.mockImplementation(async (p: string) => (p.endsWith("/coverage") ? coverage() : { stack: detail(0) }));
    post.mockResolvedValue({ question: {}, stack: detail(1) });
    render(<MockQuestionBank onToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Manage Node.js questions" }));
    const round = await screen.findByRole("region", { name: /Round 1/ });
    fireEvent.click(within(round).getByRole("button", { name: /Add question/ }));

    const dialog = await screen.findByRole("dialog", { name: /Add a question/ });
    const save = within(dialog).getByRole("button", { name: "Add question" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/^Question/), { target: { value: "Explain how you would design the number 1 part of a Node.js service." } });
    expect(save.disabled).toBe(false);
    fireEvent.change(within(dialog).getByLabelText(/Time to answer/), { target: { value: "20" } });
    expect(save.disabled).toBe(true); // 30-600 only
    fireEvent.change(within(dialog).getByLabelText(/Time to answer/), { target: { value: "120" } });
    fireEvent.click(save);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/admin/mock-interview-bank/rounds/mock-nodejs-r1/questions", {
        text: "Explain how you would design the number 1 part of a Node.js service.",
        category: "technical",
        duration_seconds: 120,
        note: null,
        topic: null,
        needs_review: false,
      })
    );
    expect(await screen.findByText(/Explain how you would design the number 1 part/)).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Question added.");
  });

  it("shows a question's topic and a 'needs review' badge, and clearing the flag is saved", async () => {
    get.mockImplementation(async (p: string) => (p.endsWith("/coverage") ? coverage() : { stack: detail(5) }));
    put.mockResolvedValue({ question: {}, stack: detail(5) });
    render(<MockQuestionBank onToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Manage Node.js questions" }));
    const round = await screen.findByRole("region", { name: /Round 1/ });
    expect(within(round).getByText("Lights, Shapes & Sound Signals")).toBeTruthy();
    expect(within(round).getAllByText("Needs review")).toHaveLength(1); // only the first question carries a figure to check

    fireEvent.click(within(round).getByRole("button", { name: /Edit question 1/ }));
    const dialog = await screen.findByRole("dialog");
    const box = within(dialog).getByLabelText(/Answer needs checking/) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/admin/mock-interview-bank/questions/1", expect.objectContaining({ needs_review: false, topic: "Lights, Shapes & Sound Signals" }))
    );
  });

  it("shows the server's reason when a question is refused (a duplicate)", async () => {
    get.mockImplementation(async (p: string) => (p.endsWith("/coverage") ? coverage() : { stack: detail(1) }));
    const { ApiError } = await import("@/lib/api");
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { text: ["This question is already in the round."] }));
    render(<MockQuestionBank onToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Manage Node.js questions" }));
    fireEvent.click(within(await screen.findByRole("region", { name: /Round 1/ })).getByRole("button", { name: /Add question/ }));
    const dialog = await screen.findByRole("dialog", { name: /Add a question/ });
    fireEvent.change(within(dialog).getByLabelText(/^Question/), { target: { value: "Explain how you would design the number 1 part of a Node.js service." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add question" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("already in the round");
  });

  it("removes a question only after confirming", async () => {
    get.mockImplementation(async (p: string) => (p.endsWith("/coverage") ? coverage() : { stack: detail(2) }));
    del.mockResolvedValue({ stack: detail(1) });
    confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MockQuestionBank onToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Manage Node.js questions" }));
    const remove = await screen.findByRole("button", { name: /Remove question 1 of Round 1/ });

    fireEvent.click(remove);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(del).not.toHaveBeenCalled();

    fireEvent.click(remove);
    await waitFor(() => expect(del).toHaveBeenCalledWith("/admin/mock-interview-bank/questions/1"));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Question removed."));
  });

  it("reports what a spreadsheet import added and which rows it skipped", async () => {
    get.mockResolvedValue(coverage());
    postFormData.mockResolvedValue({ added: 12, duplicates: 2, errors: [{ row: 5, message: 'Unknown stack "cobol" - use a key from the Stacks sheet.' }], opened: ["Node.js"] });
    render(<MockQuestionBank onToast={toast} />);

    const file = new File(["stack,round,question"], "questions.csv", { type: "text/csv" });
    fireEvent.change(await screen.findByLabelText("Questions file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Import/ }));

    expect(await screen.findByText(/Unknown stack "cobol"/)).toBeTruthy();
    expect(screen.getByText("Row 5")).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Imported 12 questions — Node.js now open to students.");
    expect(postFormData).toHaveBeenCalledWith("/admin/mock-interview-bank/import", expect.any(FormData));
  });
});
