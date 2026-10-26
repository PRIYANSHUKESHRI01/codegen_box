import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/components/branches/BranchPicker", () => ({ BranchPicker: () => null }));

import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { CreateDriveModal } from "@/components/dashboard/tpo/CreateDriveModal";

beforeEach(() => {
  vi.useFakeTimers();
  get.mockReset();
  post.mockReset();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const srcOf = (el: HTMLElement) => el.querySelector("img")?.getAttribute("src");

describe("CompanyLogo — the real logo is found from the name, however it was typed", () => {
  it("shows the real wordmark for a correctly spelled name", () => {
    const { container } = render(<CompanyLogo name="Capgemini" />);
    expect(srcOf(container)).toBe("/company-logos/capgemini.svg");
  });

  it("shows it for a misspelling — also for a record that was saved with the typo", () => {
    expect(srcOf(render(<CompanyLogo name="capegemni" />).container)).toBe("/company-logos/capgemini.svg");
    cleanup();
    expect(srcOf(render(<CompanyLogo name="Infosis Limited" />).container)).toBe("/company-logos/infosys.svg");
  });

  it("the real logo wins over the emoji stored in the database", () => {
    const { container } = render(<CompanyLogo name="Cognizant" logo="💠" />);
    expect(srcOf(container)).toBe("/company-logos/cognizant.svg");
    expect(container.textContent).not.toContain("💠");
  });

  it("a company we hold no logo for keeps its emoji, or gets a monogram", () => {
    const emoji = render(<CompanyLogo name="Zoho" logo="🟧" />).container;
    expect(emoji.querySelector("img")).toBeNull();
    expect(emoji.textContent).toContain("🟧");
    cleanup();
    expect(render(<CompanyLogo name="Zoho Corp" />).container.textContent).toContain("ZC");
  });

  it("an https logo set on the company comes first", () => {
    expect(srcOf(render(<CompanyLogo name="Capgemini" logo="https://cdn.example/cap.png" />).container)).toBe("https://cdn.example/cap.png");
  });

  it("falls back to the shipped logo, then the emoji, if an image fails to load", () => {
    const { container } = render(<CompanyLogo name="Capgemini" logo="https://cdn.example/broken.png" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(srcOf(container)).toBe("/company-logos/capgemini.svg");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull(); // nothing left to try: the monogram, never a broken-image icon
    expect(container.textContent).toContain("C");
  });
});

describe("scheduling a drive: type the company, the logo attaches", () => {
  const catalogue = (companies: unknown[]) => get.mockResolvedValue({ companies });
  const open = () => render(<CreateDriveModal collegeName="Apex" onClose={() => {}} onCreated={() => {}} />);
  const type = (value: string) => fireEvent.change(screen.getByPlaceholderText(/Search for a company/), { target: { value } });
  const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(400); });

  it("attaches the logo as soon as a known company is typed (no search result needed)", async () => {
    catalogue([]);
    open();
    type("Capgemini");
    expect(srcOf(screen.getByTestId("company-logo-detected"))).toBe("/company-logos/capgemini.svg");
  });

  it("attaches it for the typo, and offers the right spelling", async () => {
    catalogue([]);
    open();
    type("capegemni");
    await settle();

    expect(srcOf(screen.getByTestId("company-logo-detected"))).toBe("/company-logos/capgemini.svg");
    const suggestion = screen.getByRole("button", { name: /Did you mean .?Capgemini.?\?/ });
    fireEvent.click(suggestion);
    expect((screen.getByPlaceholderText(/Search for a company/) as HTMLInputElement).value).toBe("Capgemini");
  });

  it("shows no logo and no suggestion for a company that isn't one we know", async () => {
    catalogue([]);
    open();
    type("Zoho");
    await settle();

    expect(screen.queryByTestId("company-logo-detected")).toBeNull();
    expect(screen.queryByText(/Did you mean/)).toBeNull();
  });

  it("lists the catalogue's similar company as a suggestion, with its real logo, and picks it", async () => {
    catalogue([{ id: 7, name: "Capgemini", slug: "capgemini", logo: "🔷", industry: "IT Services", overview: null, match: "similar" }]);
    open();
    type("capegemni");
    await settle();

    expect(screen.getByText("Similar companies in the catalog")).toBeTruthy();
    const row = screen.getByRole("button", { name: /Capgemini\s*IT Services\s*Similar/ });
    expect(within(row).getByText("Similar")).toBeTruthy();
    expect(srcOf(row)).toBe("/company-logos/capgemini.svg");

    fireEvent.click(row);
    // the picked company replaces the search box, still showing its real logo
    expect(screen.getByText("IT Services")).toBeTruthy();
    expect(screen.getByText("Change")).toBeTruthy();
  });

  it("a company typed in full is not told it was misspelled", async () => {
    catalogue([{ id: 7, name: "Capgemini", slug: "capgemini", logo: null, industry: null, overview: null, match: "exact" }]);
    open();
    type("Capgemini");
    await settle();

    expect(screen.queryByText(/Did you mean/)).toBeNull();
    expect(screen.getByText("In the catalog")).toBeTruthy();
  });
});
