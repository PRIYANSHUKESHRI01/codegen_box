import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/marketing-site/TalkToTeamModal", () => ({
  TalkToTeamModal: ({ open, defaultAudience }: { open: boolean; defaultAudience: string }) =>
    open ? <div role="dialog" aria-label="Talk to our team" data-audience={defaultAudience} /> : null,
}));
vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));
vi.mock("@/components/ui/AnimatedCounter", () => ({
  AnimatedCounter: ({ target, group }: { target: number; group?: boolean }) => <span>{group ? target.toLocaleString("en-IN") : target}</span>,
}));

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import CollegesRoute from "@/app/colleges/page";
import RewardsRoute from "@/app/rewards/page";
import StudentsRoute from "@/app/students/page";
import VaultRoute from "@/app/vault/page";
import { NAV_LINKS } from "@/data/navigation";
import { resetLandingData } from "@/lib/useLandingData";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";
import type { LandingData } from "@/types/landing";
import { answers, inFuture, landing } from "./landingFixture";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }),
  });
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  get.mockReset();
  resetLandingData();
  __resetPublicPlansForTests();
});
afterEach(cleanup);

/** A page once the backend has answered (or, with `null`, once it has failed to). */
async function open(Route: () => React.ReactElement, data: LandingData | null = landing()) {
  get.mockImplementation(answers(data));
  const view = render(<Route />);
  await waitFor(() => expect(get).toHaveBeenCalledWith("/public/landing"));
  await act(async () => {});
  return view;
}

const text = () => document.body.textContent ?? "";
const h1 = () => screen.getByRole("heading", { level: 1 });

// ---------------------------------------------------------------------------------------------- /rewards

describe("/rewards", () => {
  it("leads with the promise, and quotes the live prize, rank and amount", async () => {
    await open(RewardsRoute);
    expect(h1().textContent).toMatch(/Top the weekly leaderboard\.\s*Win vouchers\./);

    // The prize board in the hero and the lineup section both show what the superadmin has live.
    const lineup = screen.getByRole("heading", { name: /This week's vouchers/ }).closest("section")!;
    expect(within(lineup).getByText("Burger King voucher")).toBeTruthy();
    expect(within(lineup).getAllByText("₹499").length).toBeGreaterThan(0);
    expect(within(lineup).getAllByText(/Rank #1/).length).toBeGreaterThan(0);
    expect(within(lineup).getByText("Domino's voucher")).toBeTruthy();
    expect(text()).toMatch(/resets in/i);
  });

  it("says the contest hour and length the server runs, not the defaults", async () => {
    await open(RewardsRoute);
    expect(text()).toContain("9:30 PM IST");
    expect(text()).toContain("90 minutes");
    expect(text()).not.toContain("8 PM IST");
  });

  it("states the rules the leaderboard really runs on", async () => {
    await open(RewardsRoute);
    const rules = document.getElementById("rules")!;
    for (const title of ["What counts", "The week", "Ties", "Who gets what", "Getting your voucher", "Fair play"]) {
      expect(within(rules).getByRole("heading", { name: title })).toBeTruthy();
    }
    expect(rules.textContent).toMatch(/Monday 00:00 to Sunday 23:59, India time/);
    expect(rules.textContent).toMatch(/lower total penalty ranks higher/);
    expect(rules.textContent).toMatch(/order of value/);
    expect(rules.textContent).toMatch(/A college's own contests do not count/);
  });

  it("shows next week's lineup once the superadmin has chosen it", async () => {
    const data = landing();
    data.rewards!.next = {
      week: { key: "2026-11-09", starts_at: inFuture(5 * 24 * 3_600_000), resets_at: inFuture(12 * 24 * 3_600_000) },
      prizes: [{ rank: 1, brand: "Amazon", amount: 499, logo: "/rewards/amazon.svg", color: "#FF9900", tagline: "Shop for anything you like" }],
    };
    await open(RewardsRoute, data);
    expect(screen.getByText("Coming next week")).toBeTruthy();
    expect(text()).toMatch(/Amazon/);
  });

  it("a week with nothing on offer says the lineup is announced on Monday, and still shows the shelf", async () => {
    const data = landing();
    data.rewards = { ...data.rewards!, live: false, prizes: [] };
    await open(RewardsRoute, data);
    expect(text()).toMatch(/announced on Monday/);
    expect(screen.queryByText("Coming next week")).toBeNull();
    expect(screen.getByText("The shelf the vouchers come from")).toBeTruthy();
    expect(text()).toMatch(/not affiliated with, or endorsed by/i);
  });

  it("never names a student", async () => {
    await open(RewardsRoute);
    expect(text()).not.toMatch(/Meera|Aarav|Rohan|Northfield|Apex Institute/);
    expect(text()).not.toMatch(/sample names|illustrative board/i);
  });

  it("joins free: the main action goes to /signup", async () => {
    await open(RewardsRoute);
    expect(screen.getAllByRole("link", { name: /Join free and play tonight/ })[0].getAttribute("href")).toBe("/signup");
  });
});

// ---------------------------------------------------------------------------------------------- /vault

describe("/vault", () => {
  it("is short: an intro, three steps, the student's controls and one close", async () => {
    await open(VaultRoute);
    expect(document.querySelectorAll("main > section")).toHaveLength(4);
  });

  it("the bar everywhere on the page is the SERVER's (65%), never the default", async () => {
    await open(VaultRoute);
    expect(h1().textContent).toContain("Reach 65% readiness");
    expect(h1().textContent).toContain("Unlock Mellow Vault");
    expect(text()).toContain("Cross 65% and the Vault opens");
    expect(text()).not.toMatch(/\b60%/);
  });

  it("the slider locks and unlocks exactly at that bar", async () => {
    await open(VaultRoute);
    const slider = screen.getByRole("slider", { name: /Your readiness score/i }) as HTMLInputElement;
    const status = screen.getByRole("status");

    fireEvent.change(slider, { target: { value: "64" } });
    expect(status.textContent).toContain("Mellow Vault is locked");
    expect(status.textContent).toContain("1 more point to open it");

    fireEvent.change(slider, { target: { value: "65" } });
    expect(status.textContent).toContain("Mellow Vault is unlocked");
  });

  it("opens Mellow Vault in a new tab, safely, and keeps the student in control", async () => {
    await open(VaultRoute);
    const link = screen.getByRole("link", { name: /Visit Mellow Vault/ });
    expect(link.getAttribute("href")).toBe("https://mellowvault.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    for (const p of ["Opt-in only", "Hide any time", "Decline any company"]) expect(text()).toContain(p);
    expect(text()).toMatch(/Vault access comes with the Expert plan/);
  });

  it("falls back to the default bar when the backend does not answer", async () => {
    await open(VaultRoute, null);
    expect(h1().textContent).toContain("Reach 60% readiness");
  });
});

// ---------------------------------------------------------------------------------------------- /colleges

describe("/colleges", () => {
  it("leads with the college's promise, and Book a demo opens the form preset to colleges", async () => {
    await open(CollegesRoute);
    expect(h1().textContent).toMatch(/Run your entire placement season from one dashboard/);
    fireEvent.click(screen.getAllByRole("button", { name: /Book a demo/i })[0]);
    expect(screen.getByRole("dialog", { name: "Talk to our team" }).getAttribute("data-audience")).toBe("institution");
  });

  it("the numbers and the departments are the backend's", async () => {
    await open(CollegesRoute);
    const proof = screen.getByLabelText("The platform in numbers");
    for (const n of ["2,105", "5,200", "4,225", "378"]) expect(proof.textContent).toContain(n);
    const depts = document.getElementById("depts-heading")!.closest("section")!;
    expect(within(depts).getByText("Engineering")).toBeTruthy();
    expect(within(depts).getByText("Management")).toBeTruthy();
  });

  it("invents no customer, no student count and no sample dashboard figures", async () => {
    await open(CollegesRoute);
    expect(text()).not.toMatch(/Nova Systems|Quantica|Orbit Technologies|Helix Software/);
    expect(text()).not.toMatch(/\b480\b|58 offers|Sample data|illustrative/i);
    expect(text()).not.toMatch(/\d[\d,.]*\+?\s*(students|colleges|campuses)\s+(placed|onboarded|trust|hired|on\b)/i);
    expect(text()).not.toMatch(/trusted by|testimonial/i);
  });

  it("compares the season before and after, and links every capability to its page", async () => {
    await open(CollegesRoute);
    const shift = document.getElementById("shift-heading")!.closest("section")!;
    expect(shift.querySelectorAll("li")).toHaveLength(4);

    const caps = document.getElementById("caps-heading")!.closest("section")!;
    const hrefs = within(caps).getAllByRole("link", { name: /Learn more/ }).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/features/campus-drives",
      "/features/student-onboarding",
      "/features/placement-analytics",
      "/features/proctored-assessments",
      "/features/ai-interviews",
      "/features/company-prep",
    ]);
  });

  it("answers the questions a TPO asks", async () => {
    await open(CollegesRoute);
    const faq = document.getElementById("faq-heading")!.closest("section")!;
    expect(faq.querySelectorAll("details")).toHaveLength(6);
    expect(within(faq).getByText("What reports can I give to management?")).toBeTruthy();
  });

  it("still reads when the backend is down, with the departments it ships with", async () => {
    await open(CollegesRoute, null);
    expect(h1()).toBeTruthy();
    expect(screen.queryByLabelText("The platform in numbers")).toBeNull();
    const depts = document.getElementById("depts-heading")!.closest("section")!;
    expect(within(depts).getByText("Engineering")).toBeTruthy();
    expect(text()).not.toMatch(/undefined|NaN/);
  });
});

// ---------------------------------------------------------------------------------------------- /students

describe("/students", () => {
  it("leads with the student's promise and two doors: sign up, and the rewards", async () => {
    await open(StudentsRoute);
    expect(h1().textContent).toMatch(/Get placement-ready\.\s*Win rewards\. Get found\./);
    expect(screen.getAllByRole("link", { name: /Create student account/ })[0].getAttribute("href")).toBe("/signup");
    expect(screen.getAllByRole("link", { name: /See the rewards/ })[0].getAttribute("href")).toBe("/rewards");
  });

  it("the learning centre, the day and the Vault are built from the backend's numbers", async () => {
    await open(StudentsRoute);
    const learn = document.getElementById("learn-heading")!.closest("section")!;
    for (const n of ["2,105", "5,200", "4,225"]) expect(learn.textContent).toContain(n);
    expect(learn.textContent).toContain("65%");

    const day = document.getElementById("day-heading")!.closest("section")!;
    expect(day.textContent).toContain("9:30 PM IST");
    expect(day.textContent).toContain("90 minutes");
    expect(day.textContent).toContain("Cross 65%");
  });

  it("the rewards and Vault teasers quote the live prize and the server's bar, and lead to their pages", async () => {
    await open(StudentsRoute);
    const next = document.getElementById("next-heading")!.closest("section")!;
    expect(next.textContent).toContain("Burger King ₹499 voucher");
    expect(next.textContent).toContain("Reach 65%. Get found.");
    const hrefs = within(next).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/rewards", "/vault"]);
  });

  it("shows the live student plans, with the discount", async () => {
    await open(StudentsRoute);
    const pricing = document.getElementById("pricing-glance")!;
    await waitFor(() => expect(within(pricing).getByText("Expert")).toBeTruthy());
    expect(pricing.textContent).toContain("₹1,199");
    expect(pricing.textContent).toContain("40% off");
  });

  it("answers what students ask, without a made-up problem count", async () => {
    await open(StudentsRoute);
    const faq = document.getElementById("faq-heading")!.closest("section")!;
    expect(faq.querySelectorAll("details")).toHaveLength(5);
    expect(text()).not.toMatch(/fetched live from our backend/i);
  });

  it("says nothing that is not true of the page: no Search problems, no sample leaderboard", async () => {
    await open(StudentsRoute);
    expect(screen.queryByText(/Search problems/i)).toBeNull();
    expect(text()).not.toMatch(/Meera K|Aarav S|Rohan D/);
  });
});

// ---------------------------------------------------------------------------------------------- the nav

describe("the public navigation", () => {
  it("reaches the two new pages, and the old in-page anchors are gone", () => {
    const hrefOf = (label: string) => NAV_LINKS.find((l) => l.label === label)?.href;
    expect(hrefOf("Rewards")).toBe("/rewards");
    expect(hrefOf("Mellow Vault")).toBe("/vault");
    expect(hrefOf("Colleges")).toBe("/colleges");
    expect(hrefOf("Students")).toBe("/students");
    expect(NAV_LINKS.some((l) => l.href.startsWith("/#"))).toBe(false);
  });
});
