import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillSummary } from "@/lib/drills/api";
import type { PracticeOptions } from "@/types/practiceInterview";
import type { PracticeShelf as ShelfResponse } from "@/types/practiceShelf";

const get = vi.fn();
const post = vi.fn();
const push = vi.fn();
let discipline: string | null = "ece";
let authStatus: "loading" | "ready" = "ready";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown, i?: unknown) => post(p, b, i), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: authStatus, user: authStatus === "ready" ? { role: "user", discipline } : null }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/dashboard" }));
vi.mock("@/components/dashboard/DashboardShell", () => ({ DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main aria-label={title}>{children}</main> }));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>loading session</div> }));
vi.mock("@/components/billing/FreeTrialBanner", () => ({ FreeTrialBanner: () => null }));

import { ApiError } from "@/lib/api";
import { DrillsHub } from "@/components/drills/DrillsHub";
import { PracticeShelf } from "@/components/dashboard/home/PracticeShelf";
import PracticeStudioPage from "@/app/dashboard/interviews/practice/page";
import { recommendNext } from "@/lib/drills/recommend";
import { EMPTY_SUMMARY, resetPendingAttempts } from "@/lib/drills/api";

const summary = (over: Partial<DrillSummary> = {}): DrillSummary => ({ ...EMPTY_SUMMARY, ...over });
const skill = (recent: [number, number][], attempts = recent.length, last_at = "2026-10-20T10:00:00Z") => ({ attempts, correct: recent.filter((r) => r[0]).length, last_at, recent });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  push.mockReset();
  discipline = "ece";
  authStatus = "ready";
  resetPendingAttempts();
});
afterEach(cleanup);

describe("recommendNext", () => {
  it("starts a newcomer on the pack's first skill", () => {
    expect(recommendNext(EMPTY_SUMMARY, "circuits")).toEqual({ skill: "ohms_law", reason: "start" });
  });

  it("points at the weakest skill once there is enough to judge, then at a fresh one, then at the stalest", () => {
    const weak = summary({ skills: { ohms_law: skill([[1, 1], [1, 1], [1, 1], [1, 1]]), series_parallel: skill([[0, 1], [0, 1], [1, 1], [0, 1]]), voltage_divider: skill([[0, 1], [1, 1]]) } });
    expect(recommendNext(weak, "circuits")).toEqual({ skill: "series_parallel", reason: "weak" });

    const solid = summary({ skills: { ohms_law: skill([[1, 1], [1, 1], [1, 1], [1, 1]]) } });
    expect(recommendNext(solid, "circuits")).toEqual({ skill: "series_parallel", reason: "new" });

    const everything = Object.fromEntries(
      ["ohms_law", "series_parallel", "voltage_divider", "current_divider", "power_energy", "rc_time_constant", "lc_resonance", "ac_rms_frequency", "kcl_node", "decibels"].map((id, i) => [id, skill([[1, 1], [1, 1], [1, 1], [1, 1]], 4, `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z`)])
    );
    expect(recommendNext(summary({ skills: everything }), "circuits")).toEqual({ skill: "ohms_law", reason: "refresh" });
  });

  it("returns nothing for an unknown pack", () => {
    expect(recommendNext(EMPTY_SUMMARY, "nope")).toBeNull();
  });
});

describe("<DrillsHub>", () => {
  it("shows the pack built for the student's branch first, with their progress", async () => {
    get.mockResolvedValue(
      summary({
        skills: { ohms_law: skill([[1, 1], [1, 1], [1, 1], [1, 1], [0, 1]], 12) },
        streak: { current: 4, best: 9, active_today: false, today: 0 },
        week: { attempts: 30, days: 3 },
      })
    );
    render(<DrillsHub />);

    expect(await screen.findByText("4")).toBeTruthy();
    expect(screen.getByText(/Practise today to keep it going · best 9/)).toBeTruthy();
    expect(screen.getByText(/30 answers · 3 days/)).toBeTruthy();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf("Circuits & electronics")).toBeLessThan(headings.indexOf("Digital logic & number systems"));
    expect(headings.indexOf("Digital logic & number systems")).toBeLessThan(headings.indexOf("Quick calculations"));
    expect(screen.getAllByText("For your branch")).toHaveLength(2); // circuits + digital are both built for ECE

    const card = screen.getByRole("link", { name: /Ohm's law/ });
    expect(card.getAttribute("href")).toBe("/dashboard/drills/session?skill=ohms_law");
    expect(within(card).getByText("Familiar")).toBeTruthy();
    expect(within(card).getByText(/12 answered/)).toBeTruthy();
  });

  it("recommends where to go next and links straight into it", async () => {
    get.mockResolvedValue(EMPTY_SUMMARY);
    render(<DrillsHub />);
    const upNext = await screen.findByRole("region", { name: "Up next" });
    expect(within(upNext).getByText("Ohm's law")).toBeTruthy();
    expect(within(upNext).getByText(/A good place to begin/)).toBeTruthy();
    expect(within(upNext).getByRole("link", { name: /Practise this/ }).getAttribute("href")).toBe("/dashboard/drills/session?skill=ohms_law");
    expect(screen.getByText(/Answer one question today to start a streak/)).toBeTruthy();
  });

  it("puts the quick-calculation pack first for a mechanical student", async () => {
    discipline = "mech";
    get.mockResolvedValue(EMPTY_SUMMARY);
    render(<DrillsHub />);
    await screen.findByRole("region", { name: "Up next" });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf("Quick calculations")).toBeLessThan(headings.indexOf("Digital logic & number systems"));
    expect(screen.getAllByText("For your branch")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Up next" }).textContent).toContain("Unit conversion");
  });

  it("waits for sign-in before loading anything, and never renders before its data has arrived", async () => {
    // the first render happens while the session is still being verified: no user, no progress yet
    authStatus = "loading";
    get.mockResolvedValue(EMPTY_SUMMARY);
    const { rerender } = render(<DrillsHub />);
    expect(screen.getByText("loading session")).toBeTruthy();
    expect(get).not.toHaveBeenCalled();

    authStatus = "ready";
    rerender(<DrillsHub />);
    expect(screen.getByText("loading session")).toBeTruthy(); // signed in, progress still on its way
    expect(await screen.findByRole("region", { name: "Up next" })).toBeTruthy();
  });

  it("is honest that drills do not change the readiness score, and survives a failed load", async () => {
    get.mockRejectedValue(new ApiError("Server unavailable", 500));
    render(<DrillsHub />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Server unavailable");
    expect(screen.getByText(/don.t change your readiness score|changes your readiness score/)).toBeTruthy();
    // the skills are still there to practise
    expect(screen.getByRole("link", { name: /Ohm's law/ })).toBeTruthy();
  });
});

const shelf = (cards: ShelfResponse["cards"], streak = 0): ShelfResponse => ({ cards, streak: { current: streak, best: streak, active_today: streak > 0, today: 0 } });

describe("<PracticeShelf>", () => {
  it("shows the shared modules in the order the server chose, flagging what the student asked for", async () => {
    get.mockResolvedValue(
      shelf(
        [
          { id: "soft_skills", kind: "soft_skills", sets_total: 45, sets_completed: 3, in_progress: false, pinned: true },
          { id: "interview", kind: "interview", resume: false, role: "ece_embedded", role_title: "Embedded Systems Engineer", recommended: true, for_branch: true, pinned: false },
          { id: "drills", kind: "drills", pack: "circuits", skill: "ohms_law", reason: "start", attempts_today: 0, streak: 0, pinned: false },
          { id: "communication", kind: "communication", pinned: false },
        ],
        5
      )
    );
    render(<PracticeShelf />);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(4);
    ["Soft skills", "AI mock interview", "Skill drills", "Communication"].forEach((title, i) => expect(items[i].textContent, title).toContain(title));
    expect(within(items[0]).getByText("You asked for this")).toBeTruthy();
    expect(within(items[0]).getByText(/3 of 45 question sets done/)).toBeTruthy();
    expect(within(items[1]).getByText("Matches your interests")).toBeTruthy();
    expect(within(items[1]).getByRole("link").getAttribute("href")).toBe("/dashboard/interviews");
    expect(within(items[2]).getByRole("link").getAttribute("href")).toBe("/dashboard/drills/session?skill=ohms_law");
    expect(within(items[3]).getByRole("link").getAttribute("href")).toBe("/dashboard/learning-centre");
    expect(screen.getByText("5-day drill streak")).toBeTruthy();
  });

  it("leads with an interview that was left half-done", async () => {
    get.mockResolvedValue(shelf([{ id: "interview", kind: "interview", resume: true, title: "Embedded Systems Engineer — Technical round", slug: "embedded-abc12", pinned: false }]));
    render(<PracticeShelf />);
    const link = await screen.findByRole("link", { name: /Finish your interview/ });
    expect(link.getAttribute("href")).toBe("/dashboard/interviews/view?slug=embedded-abc12");
    expect(link.textContent).toContain("Embedded Systems Engineer — Technical round");
    expect(link.textContent).toContain("Resume");
  });

  it("renders nothing, not an error, when it cannot load", async () => {
    get.mockRejectedValue(new Error("offline"));
    const { container } = render(<PracticeShelf />);
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });
});

const options = (over: Partial<PracticeOptions> = {}): PracticeOptions => ({
  groups: [
    {
      key: "ece",
      label: "Electronics & Communication",
      is_your_branch: true,
      roles: [
        { key: "ece_embedded", title: "Embedded Systems Engineer", blurb: "Microcontrollers.", recommended: true, questions_available: 12 },
        { key: "ece_vlsi", title: "VLSI / Chip Design Engineer", blurb: "CMOS.", recommended: false, questions_available: 3 },
      ],
    },
    { key: "software", label: "IT & software roles", is_your_branch: false, roles: [{ key: "sw_fresher", title: "Software Engineer — Fresher", blurb: "Campus interview.", recommended: false, questions_available: 20 }] },
  ],
  kinds: [
    { key: "technical", label: "Technical round", blurb: "Fundamentals." },
    { key: "full", label: "Full mock", blurb: "Everything." },
    { key: "hr", label: "HR & behavioural round", blurb: "People." },
  ],
  counts: [5, 8, 10],
  difficulties: ["mixed", "easy", "medium", "hard"],
  limits: { created_today: 1, per_day: 8 },
  defaults: { role: "ece_embedded", kind: "technical", count: 8, difficulty: "mixed" },
  ...over,
});

const serve = (opts: PracticeOptions) =>
  get.mockImplementation((path: string) => (path.includes("practice-interviews/options") ? Promise.resolve(opts) : Promise.resolve({ scope: "individual", coverage: null, entitlements: undefined })));

describe("Practice interview studio", () => {
  it("opens on the branch's recommended role with sensible defaults, grouped with the student's branch first", async () => {
    serve(options());
    render(<PracticeStudioPage />);
    const role = await screen.findByRole("radio", { name: /Embedded Systems Engineer/ });
    expect(role.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /VLSI/ }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Your branch")).toBeTruthy();
    expect(screen.getByText("Matches your interests")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Technical round/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /8 questions/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Mixed" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("1 of 8 built today")).toBeTruthy();
    // a role with few tagged questions says the round also draws on the wider branch bank
    expect(within(screen.getByRole("radio", { name: /VLSI/ })).getByText("Plus wider branch questions")).toBeTruthy();
    expect(within(role).getByText("Question bank ready")).toBeTruthy();
  });

  it("honours a role suggested by the home shelf", async () => {
    window.history.pushState({}, "", "/dashboard/interviews/practice?role=ece_vlsi");
    serve(options());
    render(<PracticeStudioPage />);
    expect((await screen.findByRole("radio", { name: /VLSI/ })).getAttribute("aria-checked")).toBe("true");
    window.history.pushState({}, "", "/");
  });

  it("builds the interview from the choices and opens it", async () => {
    serve(options());
    post.mockResolvedValue({ interview: { slug: "vlsi-mock-x1y2z", title: "VLSI — Full mock", question_count: 10 } });
    render(<PracticeStudioPage />);

    fireEvent.click(await screen.findByRole("radio", { name: /VLSI/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Full mock/ }));
    fireEvent.click(screen.getByRole("radio", { name: /10 questions/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    fireEvent.click(screen.getByRole("button", { name: /Build my interview/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/interviews/view?slug=vlsi-mock-x1y2z"));
    expect(post).toHaveBeenCalledWith("/me/practice-interviews", { role: "ece_vlsi", kind: "full", count: 10, difficulty: "hard" }, undefined);
  });

  it("shows what went wrong, offers the plans page when the limit is the plan's, and lets the student try again", async () => {
    serve(options());
    post.mockRejectedValueOnce(new ApiError("You've reached today's mock interview limit (1) on your plan. Upgrade to practice more.", 402));
    render(<PracticeStudioPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Build my interview/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("today's mock interview limit");
    expect(within(alert).getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/dashboard/billing");
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Build my interview/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("stops at the daily cap and says so", async () => {
    serve(options({ limits: { created_today: 8, per_day: 8 } }));
    render(<PracticeStudioPage />);
    expect(await screen.findByText(/built the most you can today/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Build my interview/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports a studio that cannot open instead of a blank page", async () => {
    get.mockImplementation((path: string) => (path.includes("options") ? Promise.reject(new ApiError("Not available", 403)) : Promise.resolve({})));
    render(<PracticeStudioPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Not available");
  });
});
