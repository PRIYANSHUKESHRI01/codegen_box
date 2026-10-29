import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiDriveSummary } from "@/lib/studentDrives";

const get = vi.fn();
let authStatus: "loading" | "ready" = "ready";
let user: Record<string, unknown> | null = { role: "user", name: "Asha Rao", college: { name: "NIT Demo" } };

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: authStatus, user: authStatus === "ready" ? user : null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/drives", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) => (
    <main aria-label={title}>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>loading session</div> }));
vi.mock("@/components/ui/CompanyLogo", () => ({ CompanyLogo: ({ name }: { name: string }) => <span aria-hidden>{name[0]}</span> }));

import { exploreTiles } from "@/components/dashboard/home/ExploreGrid";
import { UpcomingDrivesPage, matchesQuery } from "@/components/dashboard/drives/UpcomingDrivesPage";
import { DEFAULT_CAPABILITIES } from "@/lib/departments";
import { groupDrives, mapDriveFromApi } from "@/lib/studentDrives";

const NOW = Date.parse("2026-10-28T10:00:00Z");
const hours = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

const drive = (id: number, name: string, at: string, over: Partial<ApiDriveSummary> = {}): ApiDriveSummary => ({
  id,
  title: `${name} Hiring`,
  company: { id, name, slug: name.toLowerCase(), logo: null },
  role_title: "Software Engineer",
  ctc_range: "6–8 LPA",
  drive_date: at,
  duration_minutes: 90,
  eligibility: { min_cgpa: "6.5", max_backlogs: 0, eligible_branches: null },
  student_eligibility: { status: "eligible", reasons: [] },
  my_application: null,
  ...over,
});

// jsdom has no IntersectionObserver (the portal kit's counters wait to scroll into view); every real browser does.
class InstantObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("IntersectionObserver", InstantObserver);

beforeEach(() => {
  get.mockReset();
  authStatus = "ready";
  user = { role: "user", name: "Asha Rao", college: { name: "NIT Demo" } };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("groupDrives", () => {
  const cards = [
    mapDriveFromApi(drive(1, "Later", hours(72)), NOW),
    mapDriveFromApi(drive(2, "Soon", hours(5), { my_application: { stage: "registered", stage_label: "Registered", ctc_offered: null, is_terminal: false } }), NOW),
    mapDriveFromApi(drive(3, "Gone", hours(-48)), NOW),
    mapDriveFromApi(drive(4, "Barred", hours(10), { student_eligibility: { status: "not_eligible", reasons: ["CGPA below 6.5"] } }), NOW),
  ];

  it("puts what is ahead soonest-first and what is behind most-recent-first", () => {
    const g = groupDrives(cards);
    expect(g.upcoming.map((d) => d.company.name)).toEqual(["Soon", "Barred", "Later"]);
    expect(g.past.map((d) => d.company.name)).toEqual(["Gone"]);
    expect(g.next?.company.name).toBe("Soon");
  });

  it("counts only upcoming drives as eligible, but any drive the student applied to as applied", () => {
    const g = groupDrives(cards);
    expect(g.eligible).toBe(2);
    expect(g.applied).toBe(1);
  });

  it("is empty-safe", () => {
    expect(groupDrives([])).toEqual({ upcoming: [], past: [], next: null, eligible: 0, applied: 0 });
  });
});

describe("matchesQuery", () => {
  const d = mapDriveFromApi(drive(1, "Infosys", hours(5)), NOW);
  it("matches company, role and title, in any case, every word", () => {
    expect(matchesQuery(d, "")).toBe(true);
    expect(matchesQuery(d, "INFOS")).toBe(true);
    expect(matchesQuery(d, "software infosys")).toBe(true);
    expect(matchesQuery(d, "infosys designer")).toBe(false);
  });
});

describe("exploreTiles", () => {
  const ids = (caps = DEFAULT_CAPABILITIES, domainPrep: { label: string } | null = null) => exploreTiles({ caps, domainPrep }).map((t) => t.id);

  it("offers a door to every sidebar section a CSE student has, in the rail's order", () => {
    expect(ids()).toEqual(["practice", "learning", "soft", "projects", "report", "drives", "pyq", "mock", "vault", "contests", "leaderboard"]);
  });

  it("never offers a door the student's programme lacks", () => {
    const noCoding = { ...DEFAULT_CAPABILITIES, coding_practice: false, contests: false, company_prep: false, project_lab: false };
    const got = ids(noCoding, { label: "Commerce Prep" });
    expect(got).toEqual(["domain", "learning", "soft", "report", "drives", "mock", "vault"]);
    expect(got).not.toContain("practice");
    expect(got).not.toContain("contests");
  });

  it("names the Domain Prep tile with the department's own word", () => {
    expect(exploreTiles({ caps: DEFAULT_CAPABILITIES, domainPrep: { label: "Management Prep" } }).find((t) => t.id === "domain")?.title).toBe("Management Prep");
  });

  it("gives every tile a destination and a button label, and never an Overview anchor", () => {
    for (const t of exploreTiles({ caps: DEFAULT_CAPABILITIES, domainPrep: { label: "Core Prep" } })) {
      expect(t.href.startsWith("/dashboard"), t.id).toBe(true);
      expect(t.href, t.id).not.toContain("#");
      expect(t.cta.length, t.id).toBeGreaterThan(3);
    }
  });
});

describe("UpcomingDrivesPage", () => {
  const serve = (drives: ApiDriveSummary[], access = true) => get.mockImplementation((path: string) => (path === "/drives" ? Promise.resolve({ drives, drive_access: access }) : Promise.reject(new Error(`unexpected ${path}`))));

  it("lists the college's drives with eligibility, and opens each one's prep pack", async () => {
    serve([drive(1, "Infosys", hours(30)), drive(2, "Wipro", hours(8), { student_eligibility: { status: "not_eligible", reasons: ["CGPA below 6.5"] } })]);
    render(<UpcomingDrivesPage />);

    expect(await screen.findByRole("heading", { name: "Infosys" })).toBeTruthy();
    expect(screen.getByText("NIT Demo", { exact: false })).toBeTruthy();
    expect(screen.getByText("CGPA below 6.5")).toBeTruthy();

    // soonest first
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Wipro", "Infosys"]);

    const link = screen.getByRole("heading", { name: "Infosys" }).closest("a");
    expect(link?.getAttribute("href")).toBe("/dashboard/drives?driveId=1");
  });

  it("filters by eligibility and by search, and says so when nothing matches", async () => {
    serve([drive(1, "Infosys", hours(30)), drive(2, "Wipro", hours(8), { student_eligibility: { status: "not_eligible", reasons: ["CGPA below 6.5"] } })]);
    render(<UpcomingDrivesPage />);
    await screen.findByRole("heading", { name: "Infosys" });

    fireEvent.click(screen.getByRole("tab", { name: "Not eligible" }));
    expect(screen.queryByRole("heading", { name: "Infosys" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Wipro" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("No drives match that")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("heading", { name: "Infosys" })).toBeTruthy();
  });

  it("keeps past drives and applications on their own tabs", async () => {
    serve([
      drive(1, "Infosys", hours(30)),
      drive(2, "OldCo", hours(-100)),
      drive(3, "AppliedCo", hours(50), { my_application: { stage: "online_test", stage_label: "Online test", ctc_offered: null, is_terminal: false } }),
    ]);
    render(<UpcomingDrivesPage />);
    await screen.findByRole("heading", { name: "Infosys" });
    expect(screen.queryByRole("heading", { name: "OldCo" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Past/ }));
    expect(screen.getByRole("heading", { name: "OldCo" })).toBeTruthy();
    expect(screen.getByText("Drive concluded")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Applied/ }));
    expect(screen.getByRole("heading", { name: "AppliedCo" })).toBeTruthy();
    expect(screen.getAllByText("Online test").length).toBeGreaterThan(0);
  });

  it("explains an empty list rather than showing a blank page", async () => {
    serve([]);
    render(<UpcomingDrivesPage />);
    expect(await screen.findByText("No drives yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Company PYQs/ }).getAttribute("href")).toBe("/dashboard/company-prep");
  });

  it("points at the plans when the plan does not include drives", async () => {
    serve([], false);
    render(<UpcomingDrivesPage />);
    expect(await screen.findByText(/aren’t part of your plan/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /See plans/ }).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("tells a failed load apart from an empty one, and retries", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    render(<UpcomingDrivesPage />);
    expect(await screen.findByText(/couldn’t load your drives/)).toBeTruthy();

    serve([drive(1, "Infosys", hours(30))]);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Infosys" })).toBeTruthy());
  });
});
