import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MellowVaultInterviewBanner } from "@/components/dashboard/home/MellowVaultInterviewBanner";
import { api } from "@/lib/api";
import { resetVaultAiAccess } from "@/lib/useVaultAiAccess";
import type { VaultAiAccess } from "@/types/vaultAi";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7 } }),
}));

const OPEN: VaultAiAccess = {
  state: "open",
  audience: "direct",
  study_year: null,
  year_label: null,
  reasons: [],
  required_days: null,
  first_login_at: null,
  unlocks_at: null,
  days_remaining: null,
  waiting_period_met: null,
  readiness: null,
};

const LOCKED: VaultAiAccess = {
  ...OPEN,
  state: "locked",
  audience: "college",
  study_year: 4,
  year_label: "4th year",
  reasons: ["waiting_period", "readiness"],
  required_days: 45,
  days_remaining: 45,
  waiting_period_met: false,
  readiness: { score: 30, required: 60, met: false, points_needed: 30 },
};

/** What /vault-qualification/access says (undefined = the request fails). */
function serve(access: VaultAiAccess | undefined) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === "/vault-qualification/access") return access ? Promise.resolve({ access }) : Promise.reject(new Error("offline"));
    return Promise.reject(new Error("not found"));
  });
}

describe("MellowVaultInterviewBanner", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    resetVaultAiAccess();
  });

  describe("when it is open", () => {
    it("is one small card: the name, what it is in a line, and one button", async () => {
      serve(OPEN);

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Vault AI Interview")).toBeTruthy();
      expect(screen.getByText("Pass 3 voice sets with a 60%+ average to get listed on Mellow Vault.")).toBeTruthy();
      expect(screen.getByText("Start interview")).toBeTruthy();
      expect(screen.getByText("Priority")).toBeTruthy();
      expect(screen.queryByText("Locked")).toBeNull();
    });

    it("links to the Vault AI Interview", async () => {
      serve(OPEN);

      render(<MellowVaultInterviewBanner />);

      const link = await screen.findByRole("link", { name: "Open Vault AI Interview" });
      expect(link.getAttribute("href")).toBe("/dashboard/vault-interviews");
    });

    it("asks only for where the student stands - no side requests for rounds and tracks", async () => {
      serve(OPEN);

      render(<MellowVaultInterviewBanner />);

      await screen.findByText("Start interview");
      expect(vi.mocked(api.get).mock.calls.map((c) => c[0])).toEqual(["/vault-qualification/access"]);
    });

    it("shows a placeholder, not an open card, until the server has answered", () => {
      vi.mocked(api.get).mockImplementation(() => new Promise(() => undefined));

      const { container } = render(<MellowVaultInterviewBanner />);

      expect(container.querySelector("a")).toBeNull();
      expect(screen.queryByText("Start interview")).toBeNull();
      expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    });

    it("is open when the answer cannot be fetched - the server is what refuses, the card only explains", async () => {
      serve(undefined);

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Start interview")).toBeTruthy();
    });

    it("shows the student's best score once they have one, green at the line and above", async () => {
      serve({ ...OPEN, vault_ai_score: 72.4 });

      render(<MellowVaultInterviewBanner />);

      const score = await screen.findByText("72%");
      expect(score.className).toContain("emerald");
    });

    it("shows a score under the line in amber, not as a pass", async () => {
      serve({ ...OPEN, vault_ai_score: 41 });

      render(<MellowVaultInterviewBanner />);

      const score = await screen.findByText("41%");
      expect(score.className).toContain("amber");
    });

    it("shows no score before any series is completed", async () => {
      serve(OPEN);

      render(<MellowVaultInterviewBanner />);

      await screen.findByText("Start interview");
      expect(screen.queryByText(/^Best/)).toBeNull();
    });
  });

  describe("for a college student who has not unlocked it yet", () => {
    it("shows the same card, locked, with the countdown on the button", async () => {
      serve(LOCKED);

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Unlocks in 45 days")).toBeTruthy();
      expect(screen.getByText("Locked")).toBeTruthy();
      expect(screen.queryByText("Start interview")).toBeNull();
      expect(screen.queryByText("Priority")).toBeNull();

      // Still a way in: the page explains what is missing.
      const link = screen.getByRole("link", { name: /locked\. Unlocks in 45 days/i });
      expect(link.getAttribute("href")).toBe("/dashboard/vault-interviews");
    });

    it("says what it needs, in a line", async () => {
      serve(LOCKED);

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Unlocks after 45 days on AptRun and a 60% readiness score.")).toBeTruthy();
    });

    it("counts the days down, with the wait's progress beside it", async () => {
      serve({ ...LOCKED, days_remaining: 44 });

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Unlocks in 44 days")).toBeTruthy();
      expect(screen.getByText("1 of 45 days")).toBeTruthy();
    });

    it("starts the progress at nothing on the first day", async () => {
      serve(LOCKED);

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("0 of 45 days")).toBeTruthy();
    });

    it("says 1 day, not 1 days", async () => {
      serve({ ...LOCKED, days_remaining: 1 });

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Unlocks in 1 day")).toBeTruthy();
    });

    it("asks for readiness once the wait is over", async () => {
      serve({ ...LOCKED, reasons: ["readiness"], days_remaining: 0, waiting_period_met: true });

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Reach 60% readiness to unlock")).toBeTruthy();
    });

    it("tells a student whose college has not set their year", async () => {
      serve({ ...LOCKED, study_year: null, year_label: null, reasons: ["year_not_set"], required_days: null, days_remaining: null });

      render(<MellowVaultInterviewBanner />);

      expect(await screen.findByText("Waiting for your college to set your year")).toBeTruthy();
      expect(screen.getByText("Opens once your college has set your year.")).toBeTruthy();
    });
  });

  it("is not on the page at all for a year that is not offered it", async () => {
    serve({ ...LOCKED, state: "unavailable", study_year: 2, year_label: "2nd year", reasons: ["year_not_offered"], required_days: null, days_remaining: null });

    const { container } = render(<MellowVaultInterviewBanner />);

    await waitFor(() => expect(container.querySelector("a")).toBeNull());
    expect(screen.queryByText("Vault AI Interview")).toBeNull();
  });
});
