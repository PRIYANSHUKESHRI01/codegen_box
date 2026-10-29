import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultAiAccess } from "@/types/vaultAi";

const hook = vi.hoisted(() => ({ value: { access: null, loading: false, reload: async () => undefined } as { access: unknown; loading: boolean; reload: () => Promise<void> } }));

vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1 } }) }));
vi.mock("@/lib/useVaultAiAccess", () => ({ useVaultAiAccess: () => hook.value }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/components/dashboard/interviews/CuratedSetsExplorer", () => ({ CuratedSetsExplorer: () => <div>QUALIFICATION CIRCUIT</div> }));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));

import VaultInterviewsPage from "@/app/dashboard/vault-interviews/page";

const BASE: VaultAiAccess = {
  state: "locked",
  audience: "college",
  study_year: 4,
  year_label: "4th year",
  reasons: ["waiting_period", "readiness"],
  required_days: 45,
  first_login_at: "2026-10-01T00:00:00Z",
  unlocks_at: "2026-11-15T00:00:00Z",
  days_remaining: 30,
  waiting_period_met: false,
  readiness: { score: 35, required: 60, met: false, points_needed: 25 },
};

const serve = (access: VaultAiAccess | null, loading = false) => {
  hook.value = { access, loading, reload: async () => undefined };
};

describe("the Vault AI Interview page", () => {
  beforeEach(() => serve(null));

  it("waits for the server's answer instead of flashing the circuit", () => {
    serve(null, true);
    render(<VaultInterviewsPage />);

    expect(screen.getByText("LOADING SESSION")).toBeTruthy();
    expect(screen.queryByText("QUALIFICATION CIRCUIT")).toBeNull();
  });

  it("shows the circuit to a direct user, with no wait and no readiness gate", () => {
    serve({ ...BASE, state: "open", audience: "direct", reasons: [], required_days: null, days_remaining: null, readiness: null });
    render(<VaultInterviewsPage />);

    expect(screen.getByText("QUALIFICATION CIRCUIT")).toBeTruthy();
    expect(screen.queryByText(/is locked/i)).toBeNull();
  });

  it("shows the circuit to a college student who has unlocked it", () => {
    serve({ ...BASE, state: "open", reasons: [], days_remaining: 0, waiting_period_met: true, readiness: { score: 70, required: 60, met: true, points_needed: 0 } });
    render(<VaultInterviewsPage />);

    expect(screen.getByText("QUALIFICATION CIRCUIT")).toBeTruthy();
  });

  it("shows the circuit when the answer could not be fetched — the server is what refuses", () => {
    serve(null, false);
    render(<VaultInterviewsPage />);

    expect(screen.getByText("QUALIFICATION CIRCUIT")).toBeTruthy();
  });

  describe("locked", () => {
    it("explains the lock and hides the circuit", () => {
      serve(BASE);
      render(<VaultInterviewsPage />);

      expect(screen.getByRole("heading", { name: "Your Vault AI Interview is locked" })).toBeTruthy();
      expect(screen.queryByText("QUALIFICATION CIRCUIT")).toBeNull();
    });

    it("shows the days to go, big", () => {
      serve(BASE);
      render(<VaultInterviewsPage />);

      expect(screen.getByText("30")).toBeTruthy();
      expect(screen.getByText("days to go")).toBeTruthy();
    });

    it("lists both things still to do, with progress on each", () => {
      serve(BASE);
      render(<VaultInterviewsPage />);

      expect(screen.getByText("Be on AptRun for 45 days")).toBeTruthy();
      expect(screen.getByText("30 days to go")).toBeTruthy();
      expect(screen.getByText("Reach a readiness score of 60%")).toBeTruthy();
      expect(screen.getByText("25 points to go")).toBeTruthy();
      expect(screen.getByRole("progressbar", { name: "Days on AptRun" }).getAttribute("aria-valuenow")).toBe("33");
      expect(screen.getByRole("progressbar", { name: "Readiness score" }).getAttribute("aria-valuenow")).toBe("35");
    });

    it("says 1 day to go in the singular", () => {
      serve({ ...BASE, days_remaining: 1 });
      render(<VaultInterviewsPage />);

      expect(screen.getByText("day to go")).toBeTruthy();
      expect(screen.getByText("1 day to go")).toBeTruthy();
    });

    it("marks the wait done once it is, and keeps asking for readiness", () => {
      serve({ ...BASE, reasons: ["readiness"], days_remaining: 0, waiting_period_met: true });
      render(<VaultInterviewsPage />);

      expect(screen.getAllByText("Done")).toHaveLength(1);
      expect(screen.queryByText("days to go")).toBeNull();
      expect(screen.getByRole("link", { name: /See how to raise it/i }).getAttribute("href")).toBe("/dashboard/vault");
    });

    it("points at the Mock AI Interview to practise in the meantime", () => {
      serve(BASE);
      render(<VaultInterviewsPage />);

      expect(screen.getByRole("link", { name: /Open Mock AI Interview/i }).getAttribute("href")).toBe("/dashboard/interviews");
    });

    it("says what year the college has them in, so a wrong one can be corrected", () => {
      serve(BASE);
      render(<VaultInterviewsPage />);

      expect(screen.getByText(/Your college has you in 4th year/)).toBeTruthy();
    });

    it("starts a third year's countdown from 90", () => {
      serve({ ...BASE, study_year: 3, year_label: "3rd year", required_days: 90, days_remaining: 90 });
      render(<VaultInterviewsPage />);

      expect(screen.getByText("Be on AptRun for 90 days")).toBeTruthy();
      expect(screen.getByText("90")).toBeTruthy();
    });
  });

  it("tells a student whose year is not set to ask their TPO, with no countdown", () => {
    serve({ ...BASE, study_year: null, year_label: null, reasons: ["year_not_set"], required_days: null, days_remaining: null, unlocks_at: null, readiness: null });
    render(<VaultInterviewsPage />);

    expect(screen.getByRole("heading", { name: "Your college hasn't set your year yet" })).toBeTruthy();
    expect(screen.getByText(/Ask your placement cell/i)).toBeTruthy();
    expect(screen.queryByText("days to go")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("tells a 2nd year it is not open to them yet", () => {
    serve({ ...BASE, state: "unavailable", study_year: 2, year_label: "2nd year", reasons: ["year_not_offered"], required_days: null, days_remaining: null, readiness: null });
    render(<VaultInterviewsPage />);

    expect(screen.getByRole("heading", { name: "The Vault AI Interview isn't open to your year yet" })).toBeTruthy();
    expect(screen.getByText(/3rd and 4th year/)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("QUALIFICATION CIRCUIT")).toBeNull();
  });

  describe("when it is open: the page opens with one card", () => {
    const OPEN_STATE = { ...BASE, state: "open" as const, audience: "direct" as const, reasons: [], required_days: null, days_remaining: null, readiness: null };

    it("says what it is, that it is unlocked and free, and how it works", () => {
      serve(OPEN_STATE);
      render(<VaultInterviewsPage />);

      expect(screen.getByRole("heading", { name: "Get listed on Mellow Vault" })).toBeTruthy();
      expect(screen.getByText("Unlocked")).toBeTruthy();
      expect(screen.getByText("No plan needed")).toBeTruthy();
      expect(screen.getByRole("list", { name: "How it works" }).textContent).toContain("Get listed");
      expect(screen.getByText("QUALIFICATION CIRCUIT")).toBeTruthy();
    });

    it("warns, in one line, about the attempts and the cooldown, and offers practice first", () => {
      serve(OPEN_STATE);
      render(<VaultInterviewsPage />);

      expect(screen.getByText(/Sit it when you.re ready/)).toBeTruthy();
      expect(screen.getByText(/3 attempts/)).toBeTruthy();
      expect(screen.getByRole("link", { name: /Practice first/ }).getAttribute("href")).toBe("/dashboard/interviews");
    });

    it("shows the pass mark before the student has a score", () => {
      serve(OPEN_STATE);
      render(<VaultInterviewsPage />);

      expect(screen.getByText("Pass mark")).toBeTruthy();
      expect(screen.getByText("60%")).toBeTruthy();
    });

    it("shows the student's best score once they have one", () => {
      serve({ ...OPEN_STATE, vault_ai_score: 68.5 });
      render(<VaultInterviewsPage />);

      expect(screen.getByText("Your best")).toBeTruthy();
      expect(screen.getByText("69%")).toBeTruthy();
    });
  });
});
