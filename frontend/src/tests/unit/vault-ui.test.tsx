import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { ReadinessComponent } from "@/types/studentStats";
import type { StudentVaultProfile, StudentVaultResponse } from "@/types/vault";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), delete: (path: string) => del(path), put: vi.fn() },
  };
});

vi.mock("@/lib/usePublicPlans", () => ({ usePublicPlan: () => null }));
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1, role: "user" } }) }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

import StudentVaultPage from "@/app/dashboard/vault/page";
import { Toaster } from "@/components/ui/Toaster";
import { resetToasts } from "@/lib/toast";
import { VaultLine } from "@/components/dashboard/student/VaultLine";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { MELLOW_VAULT_URL, vaultDoor } from "@/lib/vaultAccess";

const component = (over: Partial<ReadinessComponent> = {}): ReadinessComponent => ({
  key: "interview_performance",
  label: "AI Interviews",
  score: 80,
  weight_percent: 20,
  contribution: 16,
  detail: "3 recent interviews · average 80%",
  ...over,
});

const profile = (over: Partial<StudentVaultProfile> = {}): StudentVaultProfile => ({
  id: 7,
  status: "pending_consent",
  status_label: "Ready — awaiting your consent",
  is_eligible: true,
  consent: { given: false, given_at: null, withdrawn_at: null },
  qualified_at: "2026-10-10T00:00:00Z",
  peak_readiness: 72,
  legacy_score_percent: null,
  hired: null,
  sync: { state: "idle", on_mellow_vault: false, last_synced_at: null },
  ...over,
});

const page = (over: Partial<StudentVaultResponse> = {}, score = 72): StudentVaultResponse => ({
  access: true,
  readiness: {
    score,
    tier: "In Progress",
    components: [component()],
    next_steps: ["Take another AI mock interview."],
    threshold: 60,
    exit_threshold: 55,
    points_needed: Math.max(0, 60 - score),
  },
  profile: null,
  inquiries: [],
  shared_fields: ["Your name and email address", "Your resume, if you uploaded one"],
  never_shared: ["Your phone number or your parents’ phone number"],
  mellow_vault_connected: true,
  ...over,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
});
afterEach(() => {
  cleanup();
  resetToasts();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// ───────────────────────────── the small pieces ─────────────────────────────

describe("VaultLine", () => {
  it("says how many points are left and links to the Vault", () => {
    render(<VaultLine score={52} vault={{ threshold: 60, qualifies: false, points_needed: 8 }} />);

    expect(screen.getByText("8 points to the Vault")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress to the Vault" }).getAttribute("aria-valuenow")).toBe("52");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/dashboard/vault");
  });

  it("says 'point' for exactly one", () => {
    render(<VaultLine score={59} vault={{ threshold: 60, qualifies: false, points_needed: 1 }} />);

    expect(screen.getByText("1 point to the Vault")).toBeTruthy();
  });

  it("celebrates once the line is reached and drops the progress bar", () => {
    render(<VaultLine score={64} vault={{ threshold: 60, qualifies: true, points_needed: 0 }} />);

    expect(screen.getByText("You're Vault-ready")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders nothing against an API that does not send the Vault block", () => {
    const { container } = render(<VaultLine score={50} vault={undefined} />);

    expect(container.firstChild).toBeNull();
  });
});

describe("ReadinessBreakdown", () => {
  it("explains what each component is made of, except in the compact dashboard card", () => {
    const { rerender } = render(<ReadinessBreakdown components={[component()]} nextSteps={[]} />);
    expect(screen.getByText("3 recent interviews · average 80%")).toBeTruthy();

    rerender(<ReadinessBreakdown components={[component()]} nextSteps={[]} compact />);
    expect(screen.queryByText("3 recent interviews · average 80%")).toBeNull();
  });

  it("still renders against an older API that sends no detail", () => {
    render(<ReadinessBreakdown components={[component({ detail: undefined })]} nextSteps={["Do a thing."]} />);

    expect(screen.getByText("AI Interviews")).toBeTruthy();
    expect(screen.getByText("Do a thing.")).toBeTruthy();
  });
});

// ───────────────────────────── the student's Vault page ─────────────────────────────

describe("StudentVaultPage", () => {
  const open = async (data: StudentVaultResponse) => {
    get.mockResolvedValue(data);
    render(
      <>
        <StudentVaultPage />
        <Toaster />
      </>
    );
    await screen.findByText("Your readiness score");
  };

  it("shows a newcomer how far they are and offers a yes ahead of time, with the list of what is shared", async () => {
    await open(page({}, 41));

    expect(screen.getByRole("heading", { name: "Mellow Vault", level: 1 })).toBeTruthy();
    expect(screen.getByText(/19 more points to reach 60/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress toward the Vault" })).toBeTruthy();
    // The yes is an informed one: what is shared is on the page BEFORE the button is pressed.
    expect(screen.getByText("Your name and email address")).toBeTruthy();
    expect(screen.getByText(/phone number or your parents/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /list me when I'm ready/i })).toBeTruthy();
  });

  it("one click of consent calls the API and shows the result it returns", async () => {
    await open(page({ profile: profile() }));
    post.mockResolvedValue(
      page({
        profile: profile({ status: "visible", status_label: "Live in the Vault", consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null }, sync: { state: "pending", on_mellow_vault: false, last_synced_at: null } }),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /yes, list me in the vault/i }));

    await screen.findByText("You're live in the Vault");
    expect(post).toHaveBeenCalledWith("/me/vault/consent", undefined);
    expect(screen.getByRole("button", { name: /hide my profile/i })).toBeTruthy();
    expect(screen.getByText(/Sending your profile to Mellow Vault/)).toBeTruthy();
  });

  it("hiding is a deliberate two-step: nothing is sent until the student confirms", async () => {
    await open(
      page({
        profile: profile({ status: "visible", status_label: "Live in the Vault", consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null }, sync: { state: "delivered", on_mellow_vault: true, last_synced_at: "2026-10-15T00:00:00Z" } }),
      })
    );
    expect(screen.getByText(/Live on Mellow Vault/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /hide my profile/i }));
    expect(del).not.toHaveBeenCalled();

    del.mockResolvedValue(page({ profile: profile({ status: "hidden_by_candidate", status_label: "Hidden (your choice)" }) }));
    fireEvent.click(screen.getByRole("button", { name: /yes, hide me/i }));

    await screen.findByText("Your profile is hidden");
    expect(del).toHaveBeenCalledWith("/me/vault/consent");
    expect(screen.getByRole("button", { name: /make me visible/i })).toBeTruthy();
  });

  it("'Keep it' backs out without calling the API", async () => {
    await open(page({ profile: profile({ status: "visible", status_label: "Live", consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null } }) }));

    fireEvent.click(screen.getByRole("button", { name: /hide my profile/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep it/i }));

    expect(del).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /hide my profile/i })).toBeTruthy();
  });

  it("tells the truth when Mellow Vault is not connected yet", async () => {
    await open(page({ mellow_vault_connected: false, profile: profile({ status: "visible", status_label: "Live", consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null } }) }));

    expect(screen.getByText(/Visible to hiring partners on AptRun/)).toBeTruthy();
    expect(screen.queryByText(/Sending your profile to Mellow Vault/)).toBeNull();
  });

  it("says so when the hand-off is failing and is being retried", async () => {
    await open(page({ profile: profile({ status: "visible", status_label: "Live", consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null }, sync: { state: "failed", on_mellow_vault: false, last_synced_at: null } }) }));

    expect(screen.getByText(/hit a problem — we're retrying automatically/)).toBeTruthy();
  });

  it("a student who said yes early sees that they will be listed automatically", async () => {
    await open(page({ profile: profile({ status: "not_ready", status_label: "Not Vault-ready yet", is_eligible: false, consent: { given: true, given_at: "2026-10-15T00:00:00Z", withdrawn_at: null } }) }, 48));

    expect(screen.getByText(/You've said yes — waiting for the Vault line/)).toBeTruthy();
    expect(screen.getByText(/listed automatically — no further click needed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /take back my yes/i })).toBeTruthy();
  });

  it("congratulates a hired student and drops the score breakdown", async () => {
    await open(
      page({
        profile: profile({
          status: "hired",
          status_label: "Hired",
          hired: { at: "2026-10-12T00:00:00Z", via: "aptrun_partner", company: { id: 3, name: "Globex", logo: null }, employer_name: null },
        }),
      })
    );

    expect(screen.getByText(/Congratulations — you're hired/)).toBeTruthy();
    expect(screen.getByText(/Globex hired you through the Vault/)).toBeTruthy();
    expect(screen.queryByText("What your score is made of")).toBeNull();
    expect(screen.queryByRole("button", { name: /hide my profile|list me/i })).toBeNull();
  });

  it("names Mellow Vault when that is where the hire happened", async () => {
    await open(page({ profile: profile({ status: "hired", status_label: "Hired", hired: { at: null, via: "mellow_vault", company: null, employer_name: "Initech" } }) }));

    expect(screen.getByText(/Initech hired you through the Vault/)).toBeTruthy();
  });

  it("explains a staff hold without offering buttons that would not work", async () => {
    await open(page({ profile: profile({ status: "hidden_by_mellow", status_label: "Under Mellow review" }) }));

    expect(screen.getByText("Your profile is under Mellow review")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /make me visible|list me/i })).toBeNull();
  });

  it("on a plan without the Vault shows the score and an upgrade prompt instead of the consent button", async () => {
    await open(page({ access: false, profile: profile({ status: "upgrade_required", status_label: "Ready — upgrade to be hired" }) }));

    expect(screen.getByText(/Get hired directly through Mellow Vault/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /upgrade to expert/i }).getAttribute("href")).toBe("/dashboard/billing");
    // Their standing is still theirs to see; only the yes is withheld.
    expect(screen.getByText("Your readiness score")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /list me|make me visible/i })).toBeNull();
  });

  it("a newcomer on a plan without the Vault is shown the upgrade prompt, not a yes-ahead-of-time button", async () => {
    await open(page({ access: false }, 41));

    expect(screen.getByText(/19 more points to reach 60/)).toBeTruthy();
    expect(screen.getByText(/Get hired directly through Mellow Vault/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /list me when I'm ready/i })).toBeNull();
  });

  it("still congratulates a hired student whose plan has since lapsed", async () => {
    await open(page({ access: false, profile: profile({ status: "hired", status_label: "Hired", hired: { at: null, via: "mellow_vault", company: null, employer_name: "Initech" } }) }));

    expect(screen.getByText(/Initech hired you through the Vault/)).toBeTruthy();
    expect(screen.queryByText(/Get hired directly through Mellow Vault/)).toBeNull();
  });

  it("still explains a staff hold to a student without the plan", async () => {
    await open(page({ access: false, profile: profile({ status: "hidden_by_mellow", status_label: "Under Mellow review" }) }));

    expect(screen.getByText("Your profile is under Mellow review")).toBeTruthy();
  });

  it("asks a migrated Talent Pool student to confirm their choice again", async () => {
    await open(page({ profile: profile({ legacy_score_percent: "94.50" }) }));

    expect(screen.getByText(/first qualified through a Mellow Talent Pool test \(94.50%\)/)).toBeTruthy();
  });

  it("lets the student confirm or decline an HR interview", async () => {
    await open(
      page({
        inquiries: [
          {
            id: 21,
            status: "interview_scheduled",
            interview_scheduled_at: "2026-10-30T10:00:00Z",
            interview_mode: "online",
            interview_location: "https://meet.example/abc",
            interview_notes: null,
            responded_at: null,
            company: { id: 3, name: "Globex", logo: null, industry: null },
          },
        ],
      })
    );
    post.mockResolvedValue({});

    expect(screen.getByText("Globex")).toBeTruthy();
    expect(screen.getByText("https://meet.example/abc")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/me/vault/inquiries/21/respond", { decision: "accept" }));
  });

  it("shows the server's message when something fails, and stays usable", async () => {
    await open(page({ profile: profile() }));
    post.mockRejectedValue(new ApiError("Your profile is currently under Mellow review.", 422));

    fireEvent.click(screen.getByRole("button", { name: /yes, list me in the vault/i }));

    await screen.findByText("Your profile is currently under Mellow review.");
    expect(screen.getByRole("button", { name: /yes, list me in the vault/i })).toBeTruthy();
  });

  it("says when the page could not load rather than spinning forever", async () => {
    get.mockRejectedValue(new ApiError("Server unavailable", 503));
    render(
      <>
        <StudentVaultPage />
        <Toaster />
      </>
    );
    await flush();

    await screen.findByText("Server unavailable");
  });
});

// ───────────────────────────── the Mellow Vault door ─────────────────────────────

describe("vaultDoor", () => {
  const door = (data: StudentVaultResponse) => vaultDoor(data);

  it("is locked below the line, and says how far there is to go", () => {
    expect(door(page({}, 41))).toEqual({ state: "locked", reason: "score", pointsNeeded: 19 });
  });

  it("opens at exactly the line, and above it", () => {
    expect(door(page({}, 60)).state).toBe("open");
    expect(door(page({}, 88)).state).toBe("open");
  });

  it("does not lock out a student who is listed and has dipped between the exit and entry lines", () => {
    // Listed at 60, now 57: the server keeps them in until below 55, so the page must not lock them.
    expect(door(page({ profile: profile({ status: "visible" }) }, 57)).state).toBe("open");
  });

  it("stays locked, for the plan's sake, when the score qualifies but the plan does not include the Vault", () => {
    expect(door(page({ access: false }, 75))).toEqual({ state: "locked", reason: "plan", pointsNeeded: 0 });
  });

  it("still celebrates a hire whose plan has since lapsed", () => {
    expect(door(page({ access: false, profile: profile({ status: "hired" }) }, 75)).state).toBe("open");
  });

  it("is locked while Mellow staff hold the profile, whatever the score", () => {
    expect(door(page({ profile: profile({ status: "hidden_by_mellow" }) }, 90))).toMatchObject({ state: "locked", reason: "review" });
  });
});

describe("StudentVaultPage - the Mellow Vault button and what surrounds it", () => {
  const open = async (data: StudentVaultResponse) => {
    get.mockResolvedValue(data);
    render(<StudentVaultPage />);
    await screen.findByText("Your readiness score");
  };

  it("below 60: shows the button locked (not a link), the benefit, the steps and the tracker", async () => {
    await open(page({}, 41));

    const button = screen.getByRole("button", { name: /Open Mellow Vault/ });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe("Locked until your readiness reaches 60% — 19 points to go");
    expect(screen.queryByRole("link", { name: /Open Mellow Vault/ })).toBeNull();

    expect(screen.getByRole("heading", { name: "Cross 60% readiness to unlock Mellow Vault" })).toBeTruthy();
    expect(screen.getByText(/always looking for ready, talented candidates/)).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(screen.getByText("Why Mellow Vault")).toBeTruthy();
    expect(screen.getByText("Your progress to the Vault line")).toBeTruthy();
  });

  it("clicking the locked button does nothing and opens nothing", async () => {
    const opener = vi.spyOn(window, "open").mockImplementation(() => null);
    await open(page({}, 41));
    fireEvent.click(screen.getByRole("button", { name: /Open Mellow Vault/ }));
    expect(opener).not.toHaveBeenCalled();
    opener.mockRestore();
  });

  it("at 60 and above: the button is a real link to Mellow Vault that opens in a new tab", async () => {
    await open(page({ profile: profile() }, 72));

    const link = screen.getByRole("link", { name: /Open Mellow Vault/ });
    expect(link.getAttribute("href")).toBe("https://mellowvault.com/developer_admin");
    expect(link.getAttribute("href")).toBe(MELLOW_VAULT_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.queryByRole("button", { name: /Open Mellow Vault/ })).toBeNull();

    expect(screen.getByRole("heading", { name: "You’re Mellow Vault ready" })).toBeTruthy();
    // the "why / how" pitch is for people who have not got there yet
    expect(screen.queryByText("How it works")).toBeNull();
    expect(screen.queryByText("Why Mellow Vault")).toBeNull();
  });

  it("on a plan without the Vault: score qualifies, button stays locked and says it is the plan, with the upgrade prompt", async () => {
    await open(page({ access: false, profile: profile() }, 72));

    const button = screen.getByRole("button", { name: /Open Mellow Vault/ });
    expect(button.getAttribute("title")).toBe("Locked — Mellow Vault is part of the Expert plan");
    expect(screen.queryByRole("link", { name: /Open Mellow Vault/ })).toBeNull();
    expect(screen.getByRole("link", { name: /See plans/ }).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("under a staff hold: locked, and says the profile is under review", async () => {
    await open(page({ profile: profile({ status: "hidden_by_mellow" }) }, 80));

    expect(screen.getByRole("button", { name: /Open Mellow Vault/ }).getAttribute("title")).toBe("Locked — your profile is under review");
  });
});
