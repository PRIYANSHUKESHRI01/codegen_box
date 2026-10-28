import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetYearModal, VaultAiChip, YearBreakdown, YearChip, YearSwitcher } from "@/components/dashboard/tpo/cohortYear";
import type { DepartmentBreakdown, YearTab } from "@/lib/studyYear";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock("@/components/portal/cohortKit", () => ({ HpOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

afterEach(cleanup);

const TABS: YearTab[] = [
  { value: "ALL", label: "All years", count: 90 },
  { value: "2", label: "2nd year", count: 20 },
  { value: "3", label: "3rd year", count: 40 },
  { value: "4", label: "4th year", count: 25 },
  { value: "none", label: "Year not set", count: 5, attention: true },
];

describe("YearSwitcher", () => {
  it("offers every year with its head-count", () => {
    render(<YearSwitcher tabs={TABS} value="ALL" onChange={() => undefined} notSetCount={5} />);

    const tabs = within(screen.getByRole("tablist", { name: "Year of study" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["All years90", "2nd year20", "3rd year40", "4th year25", "Year not set5"]);
  });

  it("marks the chosen year", () => {
    render(<YearSwitcher tabs={TABS} value="3" onChange={() => undefined} notSetCount={0} />);

    expect(screen.getByRole("tab", { name: /3rd year/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /4th year/ }).getAttribute("aria-selected")).toBe("false");
  });

  it("hands back the year that was picked", () => {
    const onChange = vi.fn();
    render(<YearSwitcher tabs={TABS} value="ALL" onChange={onChange} notSetCount={0} />);

    fireEvent.click(screen.getByRole("tab", { name: /3rd year/ }));

    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("warns about students with no year, and takes the TPO straight to them", () => {
    const onChange = vi.fn();
    render(<YearSwitcher tabs={TABS} value="3" onChange={onChange} notSetCount={5} />);

    expect(screen.getByText(/5 students have no year on file/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Show them/ }));

    expect(onChange).toHaveBeenCalledWith("none");
  });

  it("says student, not students, for one", () => {
    render(<YearSwitcher tabs={TABS} value="3" onChange={() => undefined} notSetCount={1} />);

    expect(screen.getByText(/1 student has no year on file/)).toBeTruthy();
  });

  it("does not nag when everyone has a year, or when already looking at those who have none", () => {
    const { rerender } = render(<YearSwitcher tabs={TABS} value="3" onChange={() => undefined} notSetCount={0} />);
    expect(screen.queryByText(/no year on file/)).toBeNull();

    rerender(<YearSwitcher tabs={TABS} value="none" onChange={() => undefined} notSetCount={5} />);
    expect(screen.queryByText(/no year on file/)).toBeNull();
  });
});

describe("YearBreakdown", () => {
  const GROUPS: DepartmentBreakdown[] = [
    {
      department: "engineering",
      name: "Engineering & Technology",
      count: 30,
      avgReadiness: 58,
      branches: [
        { key: "code:cse", filter: "code:cse", label: "Computer Science & Engineering", count: 20, avgReadiness: 62, vaultAiOpen: 4 },
        { key: "code:ece", filter: "code:ece", label: "Electronics & Communication", count: 10, avgReadiness: 50, vaultAiOpen: 0 },
      ],
    },
    {
      department: "commerce",
      name: "Commerce & Accounting",
      count: 10,
      avgReadiness: 70,
      branches: [{ key: "none", filter: null, label: "No branch on file", count: 10, avgReadiness: 70, vaultAiOpen: 10 }],
    },
  ];

  it("lays the year out department by department, branch by branch", () => {
    render(<YearBreakdown groups={GROUPS} yearLabel="3rd year" total={40} activeBranch="ALL" onPickBranch={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Engineering & Technology" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Commerce & Accounting" })).toBeTruthy();
    expect(screen.getByText("3rd year · by department and branch")).toBeTruthy();
    expect(screen.getByText("40 students — select a branch to focus the roster on it")).toBeTruthy();
    expect(screen.getByText("4 of 20 Vault AI unlocked")).toBeTruthy();
  });

  it("focuses the roster on a branch when it is clicked, and lets go on a second click", () => {
    const onPick = vi.fn();
    const { rerender } = render(<YearBreakdown groups={GROUPS} yearLabel="3rd year" total={40} activeBranch="ALL" onPickBranch={onPick} />);

    fireEvent.click(screen.getByRole("button", { name: /Computer Science & Engineering/ }));
    expect(onPick).toHaveBeenLastCalledWith("code:cse");

    rerender(<YearBreakdown groups={GROUPS} yearLabel="3rd year" total={40} activeBranch="code:cse" onPickBranch={onPick} />);
    const active = screen.getByRole("button", { name: /Computer Science & Engineering/ });
    expect(active.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(active);
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it("does not make a button out of students with no branch to filter on", () => {
    render(<YearBreakdown groups={GROUPS} yearLabel="3rd year" total={40} activeBranch="ALL" onPickBranch={() => undefined} />);

    expect(screen.queryByRole("button", { name: /No branch on file/ })).toBeNull();
    expect(screen.getByText("No branch on file")).toBeTruthy();
  });

  it("says so when nobody is in the year, and how to fill it", () => {
    render(<YearBreakdown groups={[]} yearLabel="2nd year" total={0} activeBranch="ALL" onPickBranch={() => undefined} />);

    expect(screen.getByText("No students in 2nd year yet")).toBeTruthy();
    expect(screen.getByText(/Add a student and choose their year, or import a roster for this year/)).toBeTruthy();
  });
});

describe("roster chips", () => {
  it("shows a student's year", () => {
    render(<YearChip student={{ study_year: 3, year_label: "3rd year" }} />);

    expect(screen.getByText("3rd year")).toBeTruthy();
  });

  it("flags a student with no year", () => {
    render(<YearChip student={{ study_year: null, year_label: null }} />);

    expect(screen.getByText("Year not set")).toBeTruthy();
  });

  it("shows where a student stands on the Vault AI Interview", () => {
    const { rerender } = render(<VaultAiChip student={{ vault_ai: { state: "locked", reasons: ["waiting_period"], days_remaining: 12, required_days: 45, unlocks_at: null } }} />);
    expect(screen.getByText("Unlocks in 12 days")).toBeTruthy();

    rerender(<VaultAiChip student={{ vault_ai: { state: "open", reasons: [], days_remaining: 0, required_days: 45, unlocks_at: null } }} />);
    expect(screen.getByText("Unlocked")).toBeTruthy();
  });

  it("shows nothing for a row that carries no Vault AI standing", () => {
    const { container } = render(<VaultAiChip student={{ vault_ai: null }} />);

    expect(container.textContent).toBe("");
  });
});

describe("SetYearModal", () => {
  it("cannot be confirmed until a year is chosen", () => {
    render(<SetYearModal count={3} onClose={() => undefined} onConfirm={async () => undefined} />);

    expect(screen.getByText("3 students selected")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Choose a year" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves the selection to the chosen year", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SetYearModal count={1} onClose={() => undefined} onConfirm={onConfirm} />);

    expect(screen.getByText("1 student selected")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("4th year"));
    fireEvent.click(screen.getByRole("button", { name: "Move to 4th year" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(4));
  });

  it("shows the server's reason when it fails, and lets the TPO try again", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Your account is not linked to a college."));
    render(<SetYearModal count={2} onClose={() => undefined} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByLabelText("3rd year"));
    fireEvent.click(screen.getByRole("button", { name: "Move to 3rd year" }));

    await waitFor(() => expect(screen.getByText("Your account is not linked to a college.")).toBeTruthy());
    expect((screen.getByRole("button", { name: "Move to 3rd year" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
