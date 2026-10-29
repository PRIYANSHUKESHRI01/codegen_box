import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultAiCoverage, VaultAiStackDetail } from "@/types/vaultAiAdmin";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const getFile = vi.fn();
const postFormData = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (p: string) => get(p),
      post: (p: string, b?: unknown) => post(p, b),
      put: (p: string, b?: unknown) => put(p, b),
      delete: (p: string) => del(p),
      getFile: (p: string) => getFile(p),
      postFormData: (p: string, b: FormData) => postFormData(p, b),
    },
  };
});

const confirm = vi.fn();
vi.mock("@/lib/dialogs", () => ({ confirmDialog: (o: unknown) => confirm(o) }));

import { ApiError } from "@/lib/api";
import { VaultAiQuestionsTab } from "@/components/admin/vault/VaultAiQuestionsTab";

const COVERAGE: VaultAiCoverage = {
  min_questions: 5,
  stats: { stacks: 3, live: 1, coming_soon: 2 },
  roles: [
    {
      key: "backend",
      title: "Backend Developer",
      color: "indigo",
      stacks: [{ key: "laravel", name: "Laravel (PHP)", aliases: ["Laravel Developer"], live: true, ready_sets: 9, total_sets: 9, questions: 135, custom_questions: 0, waiting: 0, interested: 0, grid: [[5, 5, 5], [5, 5, 5], [5, 5, 5]] }],
    },
    {
      key: "data_analyst",
      title: "Data Analyst",
      color: "cyan",
      stacks: [
        { key: "sql", name: "SQL", aliases: ["SQL Developer"], live: false, ready_sets: 2, total_sets: 9, questions: 13, custom_questions: 13, waiting: 7, interested: 9, grid: [[5, 5, 3], [0, 0, 0], [0, 0, 0]] },
        { key: "power_bi", name: "Power BI", aliases: ["Power BI"], live: false, ready_sets: 0, total_sets: 9, questions: 0, custom_questions: 0, waiting: 0, interested: 0, grid: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
      ],
    },
  ],
};

const set = (id: string, n: number, count: number, ready = count >= 5) => ({
  id,
  set_number: n,
  title: `Set ${n}: Round ${n}`,
  description: `About round ${n}.`,
  ready,
  questions: Array.from({ length: count }, (_, i) => ({ id: 100 + i, text: `Question ${i + 1} of ${id}, written in full.`, category: "technical" as const, duration_seconds: 180, note: null, source: "custom" as const })),
});

const SQL: VaultAiStackDetail = {
  key: "sql",
  name: "SQL",
  blurb: "Joins and windows.",
  role: { key: "data_analyst", title: "Data Analyst" },
  aliases: ["SQL Developer"],
  live: false,
  ready_sets: 2,
  total_sets: 9,
  min_questions: 5,
  waiting: 7,
  series: [
    { series_number: 1, title: "Series 1: Core", sets: [set("a-sql-s1-set1", 1, 5), set("a-sql-s1-set2", 2, 5), set("a-sql-s1-set3", 3, 3)] },
    { series_number: 2, title: "Series 2: Applied", sets: [set("a-sql-s2-set1", 1, 0), set("a-sql-s2-set2", 2, 0), set("a-sql-s2-set3", 3, 0)] },
  ],
};

const toast = vi.fn();
const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (path: string) => {
    if (path === "/admin/vault-ai/coverage") return COVERAGE;
    if (path === "/admin/vault-ai/stacks/sql") return { stack: SQL };
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(cleanup);

const mount = async () => {
  render(<VaultAiQuestionsTab onToast={toast} />);
  await screen.findByText("Open to students");
};

describe("the question bank overview", () => {
  it("shows what is open, what is coming soon and how many students are waiting", async () => {
    await mount();

    // "Coming soon" is also a filter button and a chip on each row; the stat label is the small uppercase heading.
    const stat = (label: string) => screen.getAllByText(label).find((el) => el.className.includes("tracking-wider"))?.parentElement as HTMLElement;
    expect(within(stat("Open to students")).getByText("1")).toBeTruthy();
    expect(within(stat("Coming soon")).getByText("2")).toBeTruthy();
    expect(within(stat("Students waiting")).getByText("7")).toBeTruthy();
    expect(within(stat("Needed per set")).getByText("5")).toBeTruthy();

    expect(screen.getByText("2 of 9 sets ready · 13 questions (13 added by staff)")).toBeTruthy();
    expect(screen.getByText("7 waiting")).toBeTruthy();
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("filters to the stacks that still need questions, and by search", async () => {
    await mount();

    fireEvent.click(screen.getByRole("button", { name: "Coming soon" }));
    expect(screen.queryByText("Laravel (PHP)")).toBeNull();
    expect(screen.getByText("SQL")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search stacks"), { target: { value: "power" } });
    expect(screen.queryByText("SQL")).toBeNull();
    expect(screen.getByText("Power BI")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search stacks"), { target: { value: "zzz" } });
    expect(screen.getByText("No stack matches.")).toBeTruthy();
  });

  it("says so when the question bank cannot be loaded, and retries", async () => {
    get.mockRejectedValueOnce(new ApiError("Server error", 500));
    render(<VaultAiQuestionsTab onToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toMatch(/server error/i);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Open to students")).toBeTruthy();
  });
});

describe("filling a stack", () => {
  const openSql = async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /manage sql questions/i }));
    await screen.findByText(/each set needs 5/);
  };

  it("shows every set with how many questions it has", async () => {
    await openSql();

    expect(screen.getByText("2 of 9 sets ready", { exact: false })).toBeTruthy();
    expect(screen.getAllByText("5/5").length).toBe(2);
    expect(screen.getByText("3/5")).toBeTruthy();
    expect(screen.getAllByText("0/5").length).toBe(3);
  });

  it("adds a question to a set and shows the stack as it now stands", async () => {
    const after: VaultAiStackDetail = { ...SQL, series: [{ ...SQL.series[0], sets: [SQL.series[0].sets[0], SQL.series[0].sets[1], set("a-sql-s1-set3", 3, 4)] }, SQL.series[1]] };
    post.mockResolvedValue({ question: { id: 1 }, stack: after });
    await openSql();

    fireEvent.click(screen.getAllByRole("button", { name: /add question/i })[2]);
    const dialog = await screen.findByRole("dialog");
    const save = within(dialog).getByRole("button", { name: /add question/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Question"), { target: { value: "Explain a window function and when you would use one." } });
    fireEvent.change(within(dialog).getByLabelText(/what a strong answer covers/i), { target: { value: "PARTITION BY and ORDER BY; ranking and running totals." } });
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/admin/vault-ai/sets/a-sql-s1-set3/questions", {
      text: "Explain a window function and when you would use one.",
      category: "technical",
      duration_seconds: 180,
      note: "PARTITION BY and ORDER BY; ranking and running totals.",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("4/5")).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Question added.");
  });

  it("congratulates the moment a stack opens", async () => {
    post.mockResolvedValue({ question: { id: 1 }, stack: { ...SQL, live: true, ready_sets: 9 } });
    await openSql();

    fireEvent.click(screen.getAllByRole("button", { name: /add question/i })[2]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Question"), { target: { value: "What does an index cost on every write to the table?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /add question/i }));
    await flush();
    await flush();

    expect(toast).toHaveBeenCalledWith("SQL is now open to students.");
  });

  it("shows the server's reason when a question is refused", async () => {
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { text: ["This question is already in the set."] }));
    await openSql();

    fireEvent.click(screen.getAllByRole("button", { name: /add question/i })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Question"), { target: { value: "What is the difference between WHERE and HAVING?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /add question/i }));
    await flush();
    await flush();

    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toMatch(/already in the set/);
  });

  it("asks before removing a question, and explains a refusal", async () => {
    confirm.mockResolvedValue(true);
    del.mockRejectedValue(new ApiError("The given data was invalid.", 422, { question: ["This stack is open to students, and removing this would leave the set short."] }));
    await openSql();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove question" })[0]);
    await flush();
    await flush();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove this question?", tone: "danger" }));
    expect(del).toHaveBeenCalledWith("/admin/vault-ai/questions/100");
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/open to students/), "error");
  });

  it("removes nothing when the staff member says no", async () => {
    confirm.mockResolvedValue(false);
    await openSql();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove question" })[0]);
    await flush();

    expect(del).not.toHaveBeenCalled();
  });
});

describe("loading questions from a spreadsheet", () => {
  const choose = (name = "questions.xlsx") => {
    const input = screen.getByLabelText("Questions file") as HTMLInputElement;
    const file = new File(["x"], name);
    fireEvent.change(input, { target: { files: [file] } });
    return file;
  };

  it("uploads the file and reports what was added, skipped and wrong", async () => {
    postFormData.mockResolvedValue({ added: 40, duplicates: 2, errors: [{ row: 7, message: 'Unknown stack "nope" — use a key from the Stacks sheet.' }], opened: ["SQL"] });
    await mount();

    const upload = screen.getByRole("button", { name: /^import$/i }) as HTMLButtonElement;
    expect(upload.disabled).toBe(true);

    choose();
    expect(upload.disabled).toBe(false);
    fireEvent.click(upload);
    await flush();
    await flush();

    const [path, body] = postFormData.mock.calls[0] as [string, FormData];
    expect(path).toBe("/admin/vault-ai/import");
    expect((body.get("file") as File).name).toBe("questions.xlsx");

    const result = await screen.findByRole("status");
    expect(result.textContent).toMatch(/40 added/);
    expect(result.textContent).toMatch(/2 already there/);
    expect(result.textContent).toMatch(/1 with problems/);
    expect(result.textContent).toMatch(/Now open: SQL/);
    expect(result.textContent).toMatch(/Row 7: Unknown stack/);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Imported 40 questions — SQL now open/));
    // The overview reloads so the new counts show.
    expect(get.mock.calls.filter(([p]) => p === "/admin/vault-ai/coverage").length).toBe(2);
  });

  it("shows why a file was refused", async () => {
    postFormData.mockRejectedValue(new ApiError("The given data was invalid.", 422, { file: ["The first row must be the header: stack, series, set, question, category, seconds, note."] }));
    await mount();

    choose("wrong.csv");
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await flush();
    await flush();

    expect((await screen.findByRole("alert")).textContent).toMatch(/first row must be the header/);
  });

  it("downloads the template", async () => {
    getFile.mockResolvedValue(new Blob(["x"]));
    const create = vi.fn(() => "blob:x");
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /excel template/i }));
    await flush();
    await flush();

    expect(getFile).toHaveBeenCalledWith("/admin/vault-ai/template");
    expect(create).toHaveBeenCalled();
  });
});
