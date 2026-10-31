import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProblemDescriptionPanel } from "@/components/practice/ProblemDescriptionPanel";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";
import type { ProblemDetail } from "@/types/problem";

afterEach(cleanup);

// 700 of the 2000 seeded problems have no constraints / hints, which the database keeps as NULL.
const bare = {
  id: 1, slug: "find-the-sum-of-subsequence-powers", title: "Find the Sum of Subsequence Powers", serial_number: 101,
  difficulty: "hard", tags: null, companies: null, acceptance_rate: 40, total_submissions: 10, solved: false,
  description: "Given an array, return the sum.", constraints: null, hints: null, examples: [], starter_code: {}, case_counts: { sample: 0, hidden: 0 },
} as unknown as ProblemDetail;

describe("a problem stored without constraints, hints or tags", () => {
  it("renders the description panel instead of crashing, and shows no empty sections", () => {
    render(<ProblemDescriptionPanel problem={bare} revealedHints={0} onRevealNextHint={() => {}} />);
    expect(screen.getByText("Given an array, return the sum.")).toBeTruthy();
    expect(screen.queryByText("Constraints")).toBeNull();
    expect(screen.queryByText("Hints")).toBeNull();
  });

  it("renders the header bar with no tags", () => {
    render(<ProblemHeaderBar problem={bare} onBack={() => {}} onRun={() => {}} onSubmit={() => {}} backLabel="Back" />);
    expect(screen.getAllByText(/Find the Sum of Subsequence Powers/).length).toBeGreaterThan(0);
  });
});
