import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionBrowser, ROUND_PAGE_SIZE } from "@/components/company-prep/QuestionBrowser";
import { groupByRound, splitQuestion } from "@/lib/companyPrep";
import type { CompanyPrepDetail } from "@/types/companyPrep";

type Q = CompanyPrepDetail["prep_questions"][number];

let nextId = 1;
const q = (round_name: string | null, over: Partial<Q> = {}): Q => ({
  id: nextId++,
  asked_year: 2025,
  category: "Coding",
  round_name,
  question: `Problem: Question ${nextId}\nBody of question ${nextId}, line one.\nLine two.`,
  answer_notes: `Answer ${nextId}`,
  ...over,
});

const STEPS = [
  { name: "Online Assessment", description: "Aptitude and verbal." },
  { name: "Coding Round", description: "Two problems in 45 minutes." },
  { name: "Technical Interview" },
];

beforeEach(() => {
  nextId = 1;
  // framer-motion measures height animations by scrolling; jsdom has no layout and complains.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(cleanup);

describe("splitQuestion", () => {
  it("takes the first line as the headline and drops a leading Problem:/Question: label and a trailing colon", () => {
    expect(splitQuestion("Problem: Count Palindromic Substrings (HCLTech)\nGiven a string s, count them.\nReturn an int.")).toEqual({
      title: "Count Palindromic Substrings (HCLTech)",
      preview: "Given a string s, count them. Return an int.",
      body: "Given a string s, count them.\nReturn an int.",
    });
    expect(splitQuestion("Profit and Loss with Successive Discounts:\nA shirt costs ₹1,000.").title).toBe("Profit and Loss with Successive Discounts");
    expect(splitQuestion("Question - What is ACID?").title).toBe("What is ACID?");
  });

  it("copes with a one-line question, blank leading lines, CRLF and an empty string", () => {
    expect(splitQuestion("Tell me about yourself.")).toEqual({ title: "Tell me about yourself.", preview: "", body: "" });
    expect(splitQuestion("\n\n  Spiral order\r\nrow by row").title).toBe("Spiral order");
    expect(splitQuestion("\n\n  Spiral order\r\nrow by row").body).toBe("row by row");
    expect(splitQuestion("   ")).toEqual({ title: "", preview: "", body: "" });
  });

  it("never leaves the headline empty (a line that is only a label)", () => {
    expect(splitQuestion("Problem:").title).toBe("Problem:");
  });
});

describe("groupByRound", () => {
  const items = [q("Technical Interview"), q("Online Assessment"), q(null), q("Coding Round"), q("Online Assessment"), q("Surprise Round")];

  it("orders rounds by the hiring process, then first appearance, with no-round questions last", () => {
    const groups = groupByRound(items, ["Online Assessment", "Coding Round", "Technical Interview"]);
    expect(groups.map((g) => g.round)).toEqual(["Online Assessment", "Coding Round", "Technical Interview", "Surprise Round", null]);
  });

  it("keeps every question exactly once and keeps their incoming order inside a round", () => {
    const groups = groupByRound(items, ["Online Assessment"]);
    expect(groups.flatMap((g) => g.items)).toHaveLength(items.length);
    const online = groups.find((g) => g.round === "Online Assessment")!;
    expect(online.items.map((i) => i.id)).toEqual([items[1].id, items[4].id]);
  });

  it("treats a blank round name as no round", () => {
    const groups = groupByRound([q("  "), q("")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].round).toBeNull();
    expect(groups[0].items).toHaveLength(2);
  });

  it("is empty for no questions", () => {
    expect(groupByRound([], ["x"])).toEqual([]);
  });
});

describe("QuestionBrowser", () => {
  const build = () => [
    ...Array.from({ length: 3 }, () => q("Online Assessment", { category: "Aptitude" })),
    ...Array.from({ length: 12 }, () => q("Coding Round")),
    ...Array.from({ length: 2 }, () => q("Technical Interview", { category: "Technical" })),
  ];

  const renderBrowser = (questions: Q[], props: Partial<Parameters<typeof QuestionBrowser>[0]> = {}) =>
    render(<QuestionBrowser questions={questions} roundOrder={STEPS.map((s) => s.name)} hiringProcess={STEPS} filtersActive={false} resetKey="a" {...props} />);

  const roundButton = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

  it("shows the questions as a short outline: one section per round, only the first open", () => {
    renderBrowser(build());

    expect(screen.getByText("Expand all").closest("div")?.parentElement?.querySelector("p")?.textContent).toBe("17 questions in 3 rounds");
    expect(roundButton("Online Assessment").getAttribute("aria-expanded")).toBe("true");
    expect(roundButton("Coding Round").getAttribute("aria-expanded")).toBe("false");
    expect(roundButton("Technical Interview").getAttribute("aria-expanded")).toBe("false");
    // 3 rows of the open round — not all 17 questions on the page
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("describes each stage from the hiring process and counts its questions", () => {
    renderBrowser(build());

    expect(within(roundButton("Coding Round")).getByText("Two problems in 45 minutes.")).toBeTruthy();
    expect(within(roundButton("Coding Round")).getByText("12 questions")).toBeTruthy();
    expect(within(roundButton("Technical Interview")).getByText("2 questions")).toBeTruthy();
  });

  it("opens a round on click and closes it again", () => {
    renderBrowser(build());

    fireEvent.click(roundButton("Technical Interview"));
    expect(roundButton("Technical Interview").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("listitem")).toHaveLength(3 + 2);

    fireEvent.click(roundButton("Online Assessment"));
    expect(roundButton("Online Assessment").getAttribute("aria-expanded")).toBe("false");
  });

  it("caps a long round and reveals the rest a page at a time", () => {
    renderBrowser(build());
    fireEvent.click(roundButton("Coding Round"));

    expect(screen.getAllByRole("listitem")).toHaveLength(3 + ROUND_PAGE_SIZE);
    const more = screen.getByRole("button", { name: /Show 4 more/ });
    expect(more.textContent).toContain("4 left");

    fireEvent.click(more);
    expect(screen.getAllByRole("listitem")).toHaveLength(3 + 12);
    expect(screen.queryByRole("button", { name: /Show .* more/ })).toBeNull();
  });

  it("numbers questions continuously across rounds", () => {
    renderBrowser(build());
    fireEvent.click(roundButton("Technical Interview"));
    fireEvent.click(roundButton("Coding Round"));
    fireEvent.click(screen.getByRole("button", { name: /Show 4 more/ }));

    const numbers = screen.getAllByRole("listitem").map((li) => li.querySelector("button span")?.textContent);
    expect(numbers).toEqual(Array.from({ length: 17 }, (_, i) => String(i + 1)));
  });

  it("a row opens in place to the full text, and the solution is one more click", () => {
    const [first] = build();
    renderBrowser([first]);

    const row = screen.getByRole("listitem");
    expect(within(row).getByText(/^Question \d+$/)).toBeTruthy();
    // collapsed: a one-line preview of the body, not the body itself
    expect(row.querySelector(".truncate")?.textContent).toMatch(/Body of question \d+, line one\. Line two\./);
    expect(row.querySelector(".whitespace-pre-wrap")).toBeNull();
    expect(within(row).queryByText(/^Answer/)).toBeNull();

    fireEvent.click(within(row).getAllByRole("button")[0]);
    expect(row.querySelector(".whitespace-pre-wrap")?.textContent).toBe(splitQuestion(first.question).body);
    expect(within(row).queryByText(/^Answer/)).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: /View Verified Solution/ }));
    expect(within(row).getByText(/^Answer/)).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: /Hide Verified Solution/ }));
  });

  it("opens every round when a search or filter is active — the student asked to see those", () => {
    renderBrowser(build(), { filtersActive: true });

    for (const name of ["Online Assessment", "Coding Round", "Technical Interview"]) expect(roundButton(name).getAttribute("aria-expanded")).toBe("true");
  });

  it("goes back to its defaults when the filters change", () => {
    const qs = build();
    const { rerender } = renderBrowser(qs);
    fireEvent.click(roundButton("Technical Interview"));
    expect(roundButton("Technical Interview").getAttribute("aria-expanded")).toBe("true");

    rerender(<QuestionBrowser questions={qs} roundOrder={STEPS.map((s) => s.name)} hiringProcess={STEPS} filtersActive={false} resetKey="b" />);
    expect(roundButton("Technical Interview").getAttribute("aria-expanded")).toBe("false");
  });

  it("Expand all opens every round, question and solution; Collapse all closes the lot", async () => {
    renderBrowser(build());

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(roundButton("Coding Round").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText(/^Answer/).length).toBe(3 + ROUND_PAGE_SIZE + 2);
    expect(screen.getAllByText(/Body of question/).length).toBe(3 + ROUND_PAGE_SIZE + 2);

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    for (const name of ["Online Assessment", "Coding Round", "Technical Interview"]) expect(roundButton(name).getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0)); // the sections animate shut
  });

  it("a single round is simply open, and questions with no round get their own section", () => {
    renderBrowser([q("Coding Round"), q(null)]);

    expect(roundButton("Coding Round").getAttribute("aria-expanded")).toBe("true");
    expect(roundButton("Other questions").getAttribute("aria-expanded")).toBe("false");
  });

  it("copies the original question text and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const [first] = build();
    renderBrowser([first]);

    const row = screen.getByRole("listitem");
    fireEvent.click(within(row).getAllByRole("button")[0]);
    fireEvent.click(within(row).getByRole("button", { name: /Copy/ }));

    expect(writeText).toHaveBeenCalledWith(first.question);
    await within(row).findByText("Copied!");
  });
});
