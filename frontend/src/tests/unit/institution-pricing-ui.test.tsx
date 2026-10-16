import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() },
  };
});

let auth: { user: unknown; status: string } = { user: null, status: "ready" };
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => auth }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { InstitutionPlans } from "@/components/pricing/InstitutionPlans";
import { PricingPageClient } from "@/components/pricing/PricingPageClient";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";
import type { SubscriptionCoverage } from "@/types/subscription";

const flush = () => act(async () => { await Promise.resolve(); });

const tpo = { id: 7, role: "admin_tpo", name: "Priya Nair", email: "priya@apex.edu", phone: "9811122233", college: { id: 1, name: "Apex Institute of Technology" } };

const collegeCoverage = (over: Partial<SubscriptionCoverage> = {}): SubscriptionCoverage => ({
  source: "institution",
  days_remaining: 210,
  is_trial: false,
  status: "active",
  started_at: null,
  current_period_end: null,
  plan: { code: "pro-campus", name: "Pro Campus", audience: "institution" },
  ...over,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth = { user: null, status: "ready" };
  __resetPublicPlansForTests();
});

afterEach(cleanup);

describe("the college / university pricing page", () => {
  it("offers exactly two things — Academic Enterprise and Mellow Academy — and none of the smaller tiers", () => {
    render(<InstitutionPlans />);

    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Academic Enterprise", "Mellow Academy"]);
    expect(screen.queryByText(/pro campus/i)).toBeNull();
    expect(screen.queryByText(/^standard$/i)).toBeNull();
    expect(screen.queryByText(/500 student seats|2,000 student seats/i)).toBeNull();
  });

  it("shows no price anywhere — every card ends in a way to contact the team", () => {
    render(<InstitutionPlans />);

    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText(/\/ year/)).toBeNull();
    expect(screen.queryByText(/^custom$/i)).toBeNull();

    for (const id of ["academic-enterprise", "mellow-academy"]) {
      const card = screen.getByTestId(`offer-${id}`);
      expect(within(card).getByRole("button", { name: /contact our team/i })).toBeTruthy();
      expect(within(card).queryByRole("button", { name: /buy|subscribe|upgrade/i })).toBeNull();
    }
    expect(screen.getByText(/there is no price list/i)).toBeTruthy();
  });

  it("says who each one is for, in one line", () => {
    render(<InstitutionPlans />);

    expect(within(screen.getByTestId("offer-academic-enterprise")).getByText(/best for universities and groups running placements across many departments or campuses/i)).toBeTruthy();
    expect(within(screen.getByTestId("offer-mellow-academy")).getByText(/best for colleges that want to lift placement outcomes/i)).toBeTruthy();
  });

  it("presents Academic Enterprise as the whole-university placement platform", () => {
    render(<InstitutionPlans />);
    const card = screen.getByTestId("offer-academic-enterprise");

    expect(within(card).getByText("One placement platform for your entire university.")).toBeTruthy();
    expect(within(card).getByText("Unlimited students, departments and campuses")).toBeTruthy();
    expect(within(card).getByText(/TPO placement dashboard/)).toBeTruthy();
    expect(within(card).getByText(/Dedicated success manager, custom SLA/)).toBeTruthy();
    // It no longer leans on a card that is gone.
    expect(within(card).queryByText(/everything in/i)).toBeNull();
  });

  it("presents Mellow Academy with its programmes, assured placement and three years of access", () => {
    render(<InstitutionPlans />);
    const card = screen.getByTestId("offer-mellow-academy");

    expect(within(card).getByText("New")).toBeTruthy();
    for (const programme of ["MERN Stack", "Laravel", "Full Stack Development", "Mobile App Development"]) {
      expect(within(card).getByText(programme)).toBeTruthy();
    }
    expect(within(card).getByText("Assured placement for enrolled students")).toBeTruthy();
    expect(within(card).getByText(/3 years of AptRun and the Vault for every enrolled student/)).toBeTruthy();
    expect(within(card).getByText(/Every AptRun feature unlocked/)).toBeTruthy();
    expect(within(card).getByText(/terms are explained by our team/i)).toBeTruthy();
  });

  it("explains what happens after the button, and offers email as the alternative", () => {
    render(<InstitutionPlans />);

    expect(screen.getByText("How it works")).toBeTruthy();
    expect(screen.getByText("Tell us about your campus")).toBeTruthy();
    expect(screen.getByText("We shape the plan with you")).toBeTruthy();
    expect(screen.getByText("Your students get started")).toBeTruthy();
    expect(screen.getByRole("link", { name: "support@mellowvault.com" }).getAttribute("href")).toMatch(/^mailto:support@mellowvault\.com/);
  });
});

describe("contacting the team from a college card", () => {
  it("opens the college form with the clicked offer already in the message, and sends it as a college enquiry", async () => {
    post.mockResolvedValue({ message: "Thanks" });
    render(<InstitutionPlans />);

    fireEvent.click(within(screen.getByTestId("offer-mellow-academy")).getByRole("button", { name: /contact our team/i }));

    expect(screen.getByRole("heading", { name: "Talk to Our Team" })).toBeTruthy();
    // The page already says this is a college: no college/employer switch.
    expect(screen.queryByRole("button", { name: /college \/ tpo/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^employer$/i })).toBeNull();
    expect((screen.getByPlaceholderText("What are you looking for?") as HTMLTextAreaElement).value).toBe("We'd like to know more about Mellow Academy for our college.");

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Priya Nair" } });
    fireEvent.change(screen.getByPlaceholderText("name@organization.com"), { target: { value: "priya@apex.edu" } });
    fireEvent.change(screen.getByPlaceholderText(/apex institute of technology/i), { target: { value: "Apex Institute of Technology" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/contact-requests", {
      name: "Priya Nair",
      email: "priya@apex.edu",
      phone: undefined,
      audience: "institution",
      organization_name: "Apex Institute of Technology",
      message: "We'd like to know more about Mellow Academy for our college.",
    });
    expect(screen.getByText(/thanks, priya/i)).toBeTruthy();
  });

  it("says which card was clicked: Academic Enterprise writes its own line", () => {
    render(<InstitutionPlans />);

    fireEvent.click(within(screen.getByTestId("offer-academic-enterprise")).getByRole("button", { name: /contact our team/i }));

    expect((screen.getByPlaceholderText("What are you looking for?") as HTMLTextAreaElement).value).toBe("We'd like to know more about Academic Enterprise for our university.");
  });

  it("does not ask a signed-in TPO for what we already know, and shows where their college stands", () => {
    auth = { user: tpo, status: "ready" };
    render(<InstitutionPlans coverage={collegeCoverage()} />);

    expect(screen.getByText(/your college is on the/i).textContent).toContain("Pro Campus");
    expect(screen.getByText(/210 days/)).toBeTruthy();

    fireEvent.click(within(screen.getByTestId("offer-mellow-academy")).getByRole("button", { name: /contact our team/i }));

    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Priya Nair");
    expect((screen.getByPlaceholderText("name@organization.com") as HTMLInputElement).value).toBe("priya@apex.edu");
    expect((screen.getByPlaceholderText("+91 98765 43210") as HTMLInputElement).value).toBe("9811122233");
    expect((screen.getByPlaceholderText(/apex institute of technology/i) as HTMLInputElement).value).toBe("Apex Institute of Technology");
  });

  it("tells a TPO whose college has no plan yet to get in touch", () => {
    auth = { user: tpo, status: "ready" };
    render(<InstitutionPlans coverage={{ ...collegeCoverage(), source: "none", days_remaining: null, plan: null }} />);

    expect(screen.getByText(/doesn.t have an active plan yet/i)).toBeTruthy();
  });

  it("shows no college status to a visitor who is not a TPO, or before it is known", () => {
    render(<InstitutionPlans coverage={collegeCoverage()} />);
    expect(screen.queryByText(/your college is on the/i)).toBeNull();

    cleanup();
    auth = { user: tpo, status: "ready" };
    render(<InstitutionPlans coverage={null} />);
    expect(screen.queryByText(/your college is on the/i)).toBeNull();
    expect(screen.queryByText(/doesn.t have an active plan/i)).toBeNull();
  });
});

describe("the audience switch on /pricing", () => {
  const ent = { practice_problems_per_day: null, mock_interviews_per_day: 10, free_trial_uses: null, drive_access: true, hackathon_access: true, vault_access: true, project_lab_access: true, workspace_hours_per_month: 80, active_projects: 3 };
  const base = { discount_percent: 0, discount_amount: 0, is_free: false, contact_only: false, term_days: 365, term_unit: "year", entitlements: ent };
  const PLANS = [
    { ...base, code: "coder", name: "Coder", list_price: 0, sale_price: 0, is_free: true, term_days: null, term_unit: null, entitlements: { ...ent, free_trial_uses: 1, practice_problems_per_day: 1 } },
    { ...base, code: "expert", name: "Expert", list_price: 4999, discount_percent: 40, discount_amount: 2000, sale_price: 2999 },
    { ...base, code: "grandmaster", name: "Grandmaster", list_price: 0, sale_price: 0, contact_only: true, term_days: 1095, term_unit: "3 years" },
  ];

  const mountPage = async () => {
    get.mockImplementation(async (path: string) => {
      if (path === "/public/plans") return { currency: "INR", plans: PLANS };
      return {};
    });
    render(<PricingPageClient />);
    await flush();
  };

  it("shows the individual plans first and the two college offers when switched", async () => {
    await mountPage();

    expect(screen.getByRole("heading", { name: "Coder" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Academic Enterprise" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /for colleges & universities/i }));
    await flush();

    expect(screen.getByRole("heading", { name: "Academic Enterprise" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mellow Academy" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Coder" })).toBeNull();
    // The student-only extras stay off the college page.
    expect(screen.queryByText("Compare plans")).toBeNull();
    expect(screen.queryByText(/the vault: get hired directly/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /for individuals/i }));
    await flush();

    expect(screen.getByRole("heading", { name: "Coder" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Academic Enterprise" })).toBeNull();
  });
});
