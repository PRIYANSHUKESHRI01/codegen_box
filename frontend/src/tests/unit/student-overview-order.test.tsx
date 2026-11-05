import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Overview is a stack of cards. This pins their ORDER — the Vault AI Interview is the second card a student meets, straight after
// the one urgent thing — with every card replaced by a marker, since what each draws has its own tests.
const { marker } = vi.hoisted(() => ({ marker: (id: string) => () => <div data-card={id} /> }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ user: { name: "Alex Chen", college: { name: "Apex" }, capabilities: {} }, status: "ready" }) }));
vi.mock("@/lib/branches", () => ({ useBranchCatalog: () => null }));
vi.mock("@/lib/departments", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/departments")>()), useDomainPrepCopy: () => ({ label: "Core Prep" }) }));
vi.mock("@/lib/useMyStats", () => ({ useMyStats: () => ({ stats: null, loading: true }) }));
vi.mock("@/lib/useContestList", () => ({
  useContestList: () => ({
    contests: [{ id: 1, title: "Daily", start_at: new Date(Date.now() + 3_600_000).toISOString(), has_started: false, has_ended: false }],
    loading: false,
  }),
}));
vi.mock("@/lib/studentDrives", () => ({
  useStudentDrives: () => ({ drives: [], access: null, loading: false }),
  groupDrives: () => ({ upcoming: [], past: [], next: null, eligible: 0, applied: 0 }),
}));

vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: marker("loader") }));
vi.mock("@/components/dashboard/DashboardShell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/dashboard/home/UpNextCard", () => ({ UpNextCard: marker("up-next") }));
vi.mock("@/components/dashboard/home/MellowVaultInterviewBanner", () => ({ MellowVaultInterviewBanner: marker("vault-ai") }));
vi.mock("@/components/dashboard/home/OverviewStats", () => ({ OverviewStats: marker("stats") }));
vi.mock("@/components/leaderboard/WeeklyRewardsBanner", () => ({ WeeklyRewardsBanner: marker("weekly-rewards") }));
vi.mock("@/components/dashboard/home/PracticeShelf", () => ({ PracticeShelf: marker("practice") }));
vi.mock("@/components/dashboard/home/ComingUp", () => ({ ComingUp: marker("coming-up") }));
vi.mock("@/components/dashboard/home/ReadinessCard", () => ({ ReadinessCard: marker("readiness") }));
vi.mock("@/components/dashboard/home/WeeklyGoalsCard", () => ({ WeeklyGoalsCard: marker("goals") }));
vi.mock("@/components/dashboard/home/DomainPrepCard", () => ({ DomainPrepCard: marker("domain-prep") }));
vi.mock("@/components/arena/HackArenaBanner", () => ({ HackArenaBanner: marker("hack-arena") }));
vi.mock("@/components/dashboard/home/ExploreGrid", () => ({ ExploreGrid: marker("explore"), exploreTiles: () => [] }));

import { SoftwareHome } from "@/components/dashboard/home/SoftwareHome";

afterEach(cleanup);

const order = (container: HTMLElement) => Array.from(container.querySelectorAll("[data-card]")).map((el) => el.getAttribute("data-card"));

describe("student Overview card order", () => {
  it("shows the Vault AI Interview second, straight after the one urgent thing", () => {
    const { container } = render(<SoftwareHome />);
    const cards = order(container);

    expect(cards.slice(0, 4)).toEqual(["up-next", "vault-ai", "stats", "weekly-rewards"]);
    expect(cards.indexOf("vault-ai")).toBe(1);
  });

  it("leaves the rest of the page where it was", () => {
    const { container } = render(<SoftwareHome />);

    expect(order(container)).toEqual(["up-next", "vault-ai", "stats", "weekly-rewards", "practice", "coming-up", "readiness", "goals", "hack-arena", "explore"]);
  });
});
