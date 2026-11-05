import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The contact form is covered by its own tests.
vi.mock("@/components/marketing-site/TalkToTeamModal", () => ({
  TalkToTeamModal: ({ open, defaultAudience }: { open: boolean; defaultAudience: string }) =>
    open ? <div role="dialog" aria-label="Talk to our team" data-audience={defaultAudience} /> : null,
}));
vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));
// Counting up needs a real viewport; here the number is simply its target.
vi.mock("@/components/ui/AnimatedCounter", () => ({
  AnimatedCounter: ({ target, group }: { target: number; group?: boolean }) => <span>{group ? target.toLocaleString("en-IN") : target}</span>,
}));

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import Home from "@/app/page";
import { DAILY_CONTEST_TIME, LANDING_FAQS, VAULT_READINESS_BAR, buildFaqs } from "@/data/landing";
import { landingFacts, resetLandingData, shortClock } from "@/lib/useLandingData";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";
import type { LandingData } from "@/types/landing";
import { answers, landing } from "./landingFixture";

// jsdom has no IntersectionObserver or matchMedia; the scroll-in animations and the theme toggle need them to exist.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
});
afterAll(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------------------------------- fixtures (shared: ./landingFixture)

function serve(data: LandingData | null) {
  get.mockImplementation(answers(data));
}

beforeEach(() => {
  get.mockReset();
  resetLandingData();
  __resetPublicPlansForTests();
});
afterEach(cleanup);

/** The page once the backend has answered. */
async function loaded(data: LandingData | null = landing()) {
  serve(data);
  const view = render(<Home />);
  if (data) await screen.findByLabelText("The platform in numbers");
  else await waitFor(() => expect(get).toHaveBeenCalledWith("/public/landing"));
  await act(async () => {});
  return view;
}

/** The text of one block, found by its id. */
function section(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no #${id} on the landing page`);
  return el;
}

const textOfPage = () => document.body.textContent ?? "";

// ---------------------------------------------------------------------------------------------- the shape

describe("landing page: short, and in the order a visitor decides", () => {
  it("is eight blocks, not twelve", async () => {
    await loaded();
    const blocks = document.querySelectorAll("main > section");
    expect(blocks).toHaveLength(8);
    // the long-form sections it replaced
    for (const id of ["how-it-works", "features", "outcomes", "audiences", "problems"]) expect(document.getElementById(id)).toBeNull();
  });

  it("leads with the college and gives students their own door", async () => {
    await loaded();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/placement-ready/i);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Every drive, one platform/i);
    expect(screen.getAllByRole("button", { name: /Book a demo/i }).length).toBeGreaterThan(0);
    const studentLink = screen.getAllByRole("link", { name: /I'm a student/i })[0];
    expect(studentLink.getAttribute("href")).toBe("/signup");
    for (const id of ["colleges", "students"]) expect(document.getElementById(id)).not.toBeNull();
  });

  it("Book a demo opens the contact form preset to colleges", async () => {
    await loaded();
    fireEvent.click(screen.getAllByRole("button", { name: /Book a demo/i })[0]);
    expect(screen.getByRole("dialog", { name: "Talk to our team" }).getAttribute("data-audience")).toBe("institution");
  });

  it("shows no coding problems, problem search or hiring-partner pitch", async () => {
    await loaded();
    expect(document.getElementById("problems")).toBeNull();
    expect(screen.queryByText(/Search problems/i)).toBeNull();
    expect(document.getElementById("employers")).toBeNull();
    expect(screen.queryByRole("button", { name: /Hire from partner campuses/i })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(within(nav).queryByRole("link", { name: "Recruiters" })).toBeNull();
  });

  it("the nav reaches the Vault and the rewards pages from any public page", async () => {
    await loaded();
    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(within(nav).getByRole("link", { name: "Mellow Vault" }).getAttribute("href")).toBe("/vault");
    expect(within(nav).getByRole("link", { name: "Rewards" }).getAttribute("href")).toBe("/rewards");
    expect(within(nav).getByRole("link", { name: "Colleges" }).getAttribute("href")).toBe("/colleges");
  });

  it("has a skip link that lands on the main content", async () => {
    await loaded();
    const skip = screen.getByRole("link", { name: /Skip to main content/i });
    expect(skip.getAttribute("href")).toBe("#main");
    expect(document.getElementById("main")?.tagName).toBe("MAIN");
  });
});

// ---------------------------------------------------------------------------------------------- the backend is the source

describe("everything the page quotes comes from the backend", () => {
  it("asks the one landing endpoint, and nothing else public but the price list", async () => {
    await loaded();
    const asked = new Set(get.mock.calls.map((c) => c[0]));
    expect(asked.has("/public/landing")).toBe(true);
    expect(Array.from(asked).filter((p) => !["/public/landing", "/public/plans"].includes(p as string))).toEqual([]);
  });

  it("the Vault bar is the server's: the card, the hero chip and the FAQ say 65%, never the default 60%", async () => {
    await loaded();
    const vault = section("vault");
    expect(within(vault).getByRole("heading", { level: 3 }).textContent).toContain("65%");
    expect(textOfPage()).toContain("Mellow Vault opens at 65%");
    expect(within(section("faq")).getByText(/What is Mellow Vault/).closest("details")!.textContent).toContain("65%");
    expect(vault.textContent).not.toContain(`${VAULT_READINESS_BAR}%`);
  });

  it("the contest hour and length are the server's", async () => {
    await loaded();
    const rewards = section("rewards");
    expect(rewards.textContent).toContain("9:30 PM IST");
    expect(rewards.textContent).toContain("90 minutes");
    expect(rewards.textContent).not.toContain(DAILY_CONTEST_TIME);
  });

  it("this week's vouchers are the ones on offer, with their brand, rank and amount", async () => {
    await loaded();
    const rewards = section("rewards");
    expect(within(rewards).getByText("Burger King")).toBeTruthy();
    expect(within(rewards).getByText("₹499")).toBeTruthy();
    expect(within(rewards).getByText("Domino's")).toBeTruthy();
    expect(within(rewards).getByText("₹299")).toBeTruthy();
    expect(rewards.textContent).toMatch(/Rank #1/);
    expect(rewards.textContent).toMatch(/Resets in/);
    // and the announcement bar quotes the top one
    expect(textOfPage()).toMatch(/wins a Burger King ₹499 voucher/);
  });

  it("the counts are the catalogue's, and only the ones it has", async () => {
    await loaded();
    const proof = screen.getByLabelText("The platform in numbers");
    for (const n of ["2,105", "5,200", "4,225", "378"]) expect(proof.textContent).toContain(n);
    expect(proof.textContent).toContain("19 languages");
    expect(proof.textContent).toContain("9 company packs");
  });

  it("an empty bank is left out rather than printed as zero", async () => {
    const data = landing();
    data.stats!.depth.company_questions = 0;
    await loaded(data);
    const proof = screen.getByLabelText("The platform in numbers");
    expect(proof.textContent).not.toContain("Company prep questions");
    expect(proof.textContent).not.toMatch(/\b0\b/);
  });

  it("the companies strip is the companies that have a prep pack", async () => {
    await loaded();
    const strip = screen.getByLabelText("Companies with prep packs on AptRun");
    expect(within(strip).getAllByAltText("Infosys").length).toBeGreaterThan(0);
    expect(within(strip).getAllByAltText("Wipro").length).toBeGreaterThan(0);
  });

  it("the departments on the college side are the platform's own", async () => {
    await loaded();
    const panel = section("audience-panel");
    expect(within(panel).getByText("Engineering")).toBeTruthy();
    expect(within(panel).getByText("Management")).toBeTruthy();
    expect(panel.textContent).toContain("4 departments");
    expect(panel.textContent).toContain("31 branches");
  });

  it("the student plans are the live price list, discount and all", async () => {
    await loaded();
    const pricing = section("pricing-glance");
    await waitFor(() => expect(within(pricing).getByText("Expert")).toBeTruthy());
    expect(pricing.textContent).toContain("₹1,199"); // 1999 less 40%
    expect(pricing.textContent).toContain("40% off");
    expect(within(pricing).getByText("Coder")).toBeTruthy();
    // Coder is free, and Grandmaster is sold by our team: its row says so and quotes no price at all
    const grandmaster = within(pricing).getByText("Grandmaster").closest("li")!;
    expect(grandmaster.textContent).toContain("Let's talk");
    expect(grandmaster.textContent).not.toMatch(/₹/);
  });
});

describe("numbers that would undersell the product are not printed", () => {
  it("shows no usage figures while they are below the server's floor", async () => {
    await loaded();
    expect(screen.queryByLabelText("Usage")).toBeNull();
    expect(textOfPage()).not.toMatch(/\d[\d,.]*\+?\s*(students|colleges|campuses|companies|recruiters|employers)\s+(placed|onboarded|trust|hired|on\b)/i);
    expect(textOfPage()).not.toMatch(/\d+%\s+placement rate/i);
    expect(textOfPage()).not.toMatch(/trusted by/i);
    expect(textOfPage()).not.toMatch(/testimonial/i);
  });

  it("prints them, exactly, once the server says they are worth printing", async () => {
    const data = landing();
    data.stats!.adoption = { students: 12400, colleges: 62, contests_held: null, solutions_judged: null, vouchers_sent: 118 };
    await loaded(data);
    const usage = screen.getByLabelText("Usage");
    expect(usage.textContent).toContain("12,400 students");
    expect(usage.textContent).toContain("62 colleges");
    expect(usage.textContent).toContain("118 vouchers sent");
    expect(usage.textContent).not.toMatch(/contests held|solutions judged/);
  });
});

describe("when the backend does not answer", () => {
  it("the page still reads, on the defaults, and draws nothing it cannot back", async () => {
    await loaded(null);
    await waitFor(() => expect(screen.queryByLabelText("Dismiss announcement")).toBeNull());

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByLabelText("The platform in numbers")).toBeNull();
    // the Vault card falls back to the default bar and the rewards card says the lineup is announced weekly
    expect(within(section("vault")).getByRole("heading", { level: 3 }).textContent).toContain(`${VAULT_READINESS_BAR}%`);
    expect(section("rewards").textContent).toMatch(/announced on Monday/);
    expect(textOfPage()).not.toMatch(/undefined|NaN|null/);
    // the college side shows the departments it ships with, not a blank
    expect(within(section("audience-panel")).getByText("Engineering")).toBeTruthy();
  });

  it("a week with no voucher on offer says so, and still shows the shelf", async () => {
    const data = landing();
    data.rewards = { ...data.rewards!, live: false, prizes: [] };
    await loaded(data);
    await screen.findAllByText(/announced on Monday/); // the hero card says it too
    expect(within(section("rewards")).queryByText(/Rank #1/)).toBeNull();
    expect(within(section("rewards")).getAllByAltText("Amazon").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------- behaviour

describe("the two sides", () => {
  it("opens on the placement cell and switches to the student's side", async () => {
    await loaded();
    const tabs = screen.getByRole("tablist", { name: "Choose your side" });
    expect(within(tabs).getByRole("tab", { name: /For placement cells/ }).getAttribute("aria-selected")).toBe("true");
    expect(section("audience-panel").textContent).toMatch(/Run the whole placement season/);

    fireEvent.click(within(tabs).getByRole("tab", { name: /For students/ }));
    await waitFor(() => expect(section("audience-panel").textContent).toMatch(/Practise daily\. Compete weekly\. Get found\./));

    const panel = section("audience-panel");
    // the learning centre is built from the real counts, and the Vault tile from the server's bar
    expect(panel.textContent).toContain("2,105");
    expect(panel.textContent).toContain("5,200");
    expect(panel.textContent).toContain("65%");
    expect(panel.textContent).toContain("9:30 PM IST");
    expect(within(panel).getByRole("link", { name: /Create student account/ }).getAttribute("href")).toBe("/signup");
  });

  it("arrow keys move between the tabs", async () => {
    await loaded();
    const first = screen.getByRole("tab", { name: /For placement cells/ });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /For students/ }).getAttribute("aria-selected")).toBe("true"));
    fireEvent.keyDown(screen.getByRole("tab", { name: /For students/ }), { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /For placement cells/ }).getAttribute("aria-selected")).toBe("true"));
  });

  it("a link to /#students opens the student side", async () => {
    window.location.hash = "#students";
    await loaded();
    await waitFor(() => expect(screen.getByRole("tab", { name: /For students/ }).getAttribute("aria-selected")).toBe("true"));
    window.location.hash = "";
  });
});

describe("Mellow Vault card", () => {
  it("opens Mellow Vault in a new tab, safely, and warns screen-reader users", async () => {
    await loaded();
    const link = within(section("vault")).getByRole("link", { name: /Visit Mellow Vault/ });
    expect(link.getAttribute("href")).toBe("https://mellowvault.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.textContent).toContain("opens in a new tab");
  });

  it("the readiness slider locks and unlocks exactly at the SERVER's bar", async () => {
    await loaded(); // bar = 65
    const vault = section("vault");
    const slider = within(vault).getByRole("slider", { name: /Your readiness score/i }) as HTMLInputElement;
    const status = within(vault).getByRole("status");

    fireEvent.change(slider, { target: { value: "64" } });
    expect(status.textContent).toContain("Mellow Vault is locked");
    expect(status.textContent).toContain("1 more point to open it");

    fireEvent.change(slider, { target: { value: "40" } });
    expect(status.textContent).toContain("25 more points");

    fireEvent.change(slider, { target: { value: "65" } });
    expect(status.textContent).toContain("Mellow Vault is unlocked");
    expect(slider.getAttribute("aria-valuetext")).toMatch(/unlocked/);

    fireEvent.change(slider, { target: { value: "100" } });
    expect(status.textContent).toContain("Mellow Vault is unlocked");
  });

  it("keeps the student in control: opt-in, hide, decline", async () => {
    await loaded();
    const promises = within(section("vault")).getByRole("list", { name: "You stay in control" });
    for (const p of ["Opt-in only", "Hide any time", "Decline any company"]) expect(promises.textContent).toContain(p);
  });
});

describe("weekly rewards card", () => {
  it("pitches the weekly board and the join link, and quotes no amount that is not on offer", async () => {
    await loaded();
    const rewards = section("rewards");
    expect(within(rewards).getByRole("heading", { level: 3 }).textContent).toMatch(/Top the weekly leaderboard\.\s*Win vouchers\./);
    expect(within(rewards).getByRole("link", { name: /Join free and play tonight/i }).getAttribute("href")).toBe("/signup");
    expect(rewards.textContent).toMatch(/from zero each Monday/);
    // the only rupee amounts are the live prizes'
    expect((rewards.textContent ?? "").match(/₹\d[\d,]*/g)?.sort()).toEqual(["₹299", "₹499"]);
  });

  it("says the brands are not endorsements, and every logo it names ships", async () => {
    await loaded();
    const rewards = section("rewards");
    expect(rewards.textContent).toMatch(/not affiliated with, or endorsed by/i);
    for (const img of Array.from(rewards.querySelectorAll("img"))) {
      expect(existsSync(path.resolve(__dirname, "../../../public", (img.getAttribute("src") ?? "").replace(/^\//, ""))), img.getAttribute("src") ?? "").toBe(true);
    }
  });
});

describe("FAQ and search-engine data", () => {
  it("answers the Vault, voucher and cost questions", async () => {
    await loaded();
    const faq = section("faq");
    for (const q of [/What is Mellow Vault, and how do students unlock it\?/, /How do the weekly vouchers work\?/, /Do students have to pay\?/]) {
      expect(within(faq).getByText(q)).toBeTruthy();
    }
    expect(faq.querySelectorAll("details")).toHaveLength(6);
  });

  const faqPage = (container: HTMLElement) => {
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!) as Array<Record<string, unknown>>;
    return { data, faq: data.find((d) => d["@type"] === "FAQPage") as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] } };
  };

  it("publishes the FAQ as structured data, word for word, on the live facts", async () => {
    const { container } = await loaded();
    const { data, faq } = faqPage(container);
    const live = buildFaqs(landingFacts(landing()));
    expect(faq.mainEntity).toHaveLength(live.length);
    live.forEach((f, i) => {
      expect(faq.mainEntity[i].name).toBe(f.q);
      expect(faq.mainEntity[i].acceptedAnswer.text).toBe(f.a);
    });
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text).join(" ")).toContain("65%");
    expect(data.some((d) => d["@type"] === "Organization")).toBe(true);
  });

  it("is complete on the defaults before the backend has answered (what a crawler reads in the static HTML)", () => {
    serve(landing());
    const { container } = render(<Home />);
    const { faq } = faqPage(container);
    LANDING_FAQS.forEach((f, i) => {
      expect(faq.mainEntity[i].name).toBe(f.q);
      expect(faq.mainEntity[i].acceptedAnswer.text).toBe(f.a);
    });
  });
});

describe("the fallbacks match the backend's own settings", () => {
  const backend = path.resolve(__dirname, "../../../../backend/config");
  const read = (file: string) => (existsSync(path.join(backend, file)) ? readFileSync(path.join(backend, file), "utf8") : null);

  it("the default Vault bar is the server's enter_score", () => {
    const php = read("vault.php");
    if (!php) return; // frontend checked out alone
    expect(php).toMatch(new RegExp(`'enter_score' => \\(int\\) env\\('VAULT_ENTER_SCORE', ${VAULT_READINESS_BAR}\\)`));
  });

  it("the default contest hour is the server's daily start_time", () => {
    const php = read("contests.php");
    if (!php) return;
    expect(php).toMatch(/'start_time' => env\('DAILY_CONTEST_START_TIME', '20:00'\)/);
    expect(DAILY_CONTEST_TIME).toBe("8 PM IST");
  });

  it("'8:00 PM IST' reads as '8 PM IST' in a sentence, and '9:30 PM IST' is left alone", () => {
    expect(shortClock("8:00 PM IST")).toBe("8 PM IST");
    expect(shortClock("9:30 PM IST")).toBe("9:30 PM IST");
    expect(landingFacts(null)).toMatchObject({ vaultBar: VAULT_READINESS_BAR, dailyTime: DAILY_CONTEST_TIME, weekResets: "Monday" });
  });
});
