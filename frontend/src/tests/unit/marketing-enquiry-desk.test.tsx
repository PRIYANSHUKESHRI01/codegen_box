import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { isOverdue, replyMailto, telLink, waitingFor, whatsappLink } from "@/lib/enquiry";
import type { ContactRequestsResponse, ContactRequestSummary } from "@/types/contactRequest";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});

const me = { current: { id: 5, name: "Maya", role: "admin_marketing", permissions: ["leads", "lead_outreach"] } as Record<string, unknown> };
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: me.current }) }));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>loading</div> }));
vi.mock("@/components/dashboard/DashboardShell", () => ({ DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main aria-label={title}>{children}</main> }));
vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));

import MarketingInquiriesPage from "@/app/marketing/inquiries/page";
import { EnquiryBanner } from "@/components/marketing-site/EnquiryBanner";
import { resetToasts, toast } from "@/lib/toast";

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const row = (over: Partial<ContactRequestSummary> & { id: number; name: string }): ContactRequestSummary => ({
  email: `${over.name.split(" ")[0].toLowerCase()}@college.edu`,
  phone: "9876543210",
  audience: "institution",
  organization_name: "Apex Institute",
  status: "new",
  created_at: ago(2 * HOUR),
  note_count: 0,
  assigned_to_name: "Maya",
  assigned_to_id: 5,
  ...over,
});

const answer = (rows: ContactRequestSummary[], over: Partial<ContactRequestsResponse> = {}): ContactRequestsResponse => ({
  requests: { data: rows, current_page: 1, last_page: 1, total: rows.length },
  scope: "mine",
  kpis: { total: rows.length, new_this_week: rows.length, unassigned: 0, awaiting_first_contact: rows.length, overdue: 0, by_status: { new: rows.length, contacted: 0, qualified: 0, converted: 0, lost: 0 } as never },
  overdue_hours: 24,
  ...over,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  resetToasts();
  me.current = { id: 5, name: "Maya", role: "admin_marketing", permissions: ["leads", "lead_outreach"] };
});
afterEach(cleanup);

describe("enquiry helpers", () => {
  it("says how long an enquiry has waited", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(waitingFor("2026-11-05T11:59:40Z", now)).toBe("just now");
    expect(waitingFor("2026-11-05T11:15:00Z", now)).toBe("45m ago");
    expect(waitingFor("2026-11-05T07:00:00Z", now)).toBe("5h ago");
    expect(waitingFor("2026-11-02T12:00:00Z", now)).toBe("3d ago");
  });

  it("flags only a NEW enquiry that has waited past the limit", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    expect(isOverdue({ status: "new", created_at: "2026-11-04T09:00:00Z" }, 24, now)).toBe(true);
    expect(isOverdue({ status: "new", created_at: "2026-11-05T09:00:00Z" }, 24, now)).toBe(false);
    expect(isOverdue({ status: "contacted", created_at: "2026-10-01T09:00:00Z" }, 24, now)).toBe(false);
  });

  it("builds a reply that is addressed, titled and greets them by first name", () => {
    const href = replyMailto({ email: "asha@college.edu", name: "Asha Rao", organization_name: "Apex Institute" });
    expect(href.startsWith("mailto:asha@college.edu?")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Your enquiry to AptRun — Apex Institute");
    expect(decodeURIComponent(href)).toContain("Hi Asha,");
  });

  it("makes call and WhatsApp links only from a usable number", () => {
    expect(whatsappLink("98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("12345")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
    expect(telLink("+91 98765-43210")).toBe("tel:+919876543210");
    expect(telLink("")).toBeNull();
  });
});

describe("the enquiry desk", () => {
  it("opens on the employee's own book, with the unassigned queue one tab away and counted", async () => {
    get.mockResolvedValue(answer([row({ id: 1, name: "Asha Rao" })], { kpis: { ...answer([]).kpis, unassigned: 3 } }));
    render(<MarketingInquiriesPage />);

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/marketing/contact-requests?scope=mine&page=1");
    const tabs = screen.getByRole("tablist", { name: "Which enquiries" });
    expect(within(tabs).getByRole("tab", { name: /My enquiries/ }).getAttribute("aria-selected")).toBe("true");
    expect(within(tabs).getByRole("tab", { name: /Unassigned\s*3/ })).toBeTruthy();
  });

  it("flags an enquiry nobody has answered for a day and counts it", async () => {
    get.mockResolvedValue(answer([row({ id: 1, name: "Late Larry", created_at: ago(30 * HOUR) })], { kpis: { ...answer([]).kpis, overdue: 1 } }));
    render(<MarketingInquiriesPage />);

    await screen.findByText("Late Larry");
    expect(screen.getAllByText("Overdue").length).toBeGreaterThan(1); // the tile and the row
    expect(screen.getByText("1d ago")).toBeTruthy();
  });

  it("each row can be e-mailed or called without opening it", async () => {
    get.mockResolvedValue(answer([row({ id: 1, name: "Asha Rao" })]));
    render(<MarketingInquiriesPage />);

    await screen.findByText("Asha Rao");
    expect(screen.getByRole("link", { name: "E-mail Asha Rao" }).getAttribute("href")).toMatch(/^mailto:asha@college\.edu\?subject=/);
    expect(screen.getByRole("link", { name: "Call Asha Rao" }).getAttribute("href")).toBe("tel:9876543210");
    expect(screen.queryByText("Your enquiry")).toBeNull();
  });

  it("searching waits for a pause in typing, then asks the server", async () => {
    get.mockResolvedValue(answer([row({ id: 1, name: "Asha Rao" })]));
    render(<MarketingInquiriesPage />);
    await screen.findByText("Asha Rao");
    get.mockClear();

    fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "zeta" } });
    expect(get).not.toHaveBeenCalled();

    await waitFor(() => expect(get).toHaveBeenCalledWith("/marketing/contact-requests?scope=mine&page=1&search=zeta"), { timeout: 2000 });
  });

  it("filters by status and goes back to page one", async () => {
    get.mockResolvedValue(answer([row({ id: 1, name: "Asha Rao" })], { requests: { data: [row({ id: 1, name: "Asha Rao" })], current_page: 1, last_page: 3, total: 60 } }));
    render(<MarketingInquiriesPage />);
    await screen.findByText("Asha Rao");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/marketing/contact-requests?scope=mine&page=2"));

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by status" })).getByRole("button", { name: /^Contacted/ }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/marketing/contact-requests?scope=mine&page=1&status=contacted"));
  });

  it("the unassigned queue offers Claim, and claiming tells the employee and refreshes the desk", async () => {
    const waiting = row({ id: 9, name: "Nobody Yet", assigned_to_name: null, assigned_to_id: null });
    get.mockImplementation((p: string) => Promise.resolve(p.includes("scope=unassigned") ? answer([waiting], { scope: "unassigned" }) : answer([])));
    post.mockResolvedValue({ claimed: true });
    render(<MarketingInquiriesPage />);

    fireEvent.click(await screen.findByRole("tab", { name: /Unassigned/ }));
    await screen.findByText("Nobody Yet");
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);

    get.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Claim/ }));
    });

    expect(post).toHaveBeenCalledWith("/marketing/contact-requests/9/claim", undefined);
    await waitFor(() => expect(get).toHaveBeenCalled());
  });

  it("a claim someone else won says so instead of failing silently, and the desk refreshes", async () => {
    const waiting = row({ id: 9, name: "Nobody Yet", assigned_to_name: null, assigned_to_id: null });
    get.mockImplementation((p: string) => Promise.resolve(p.includes("scope=unassigned") ? answer([waiting], { scope: "unassigned" }) : answer([])));
    post.mockRejectedValue(new ApiError("Someone else has already taken this enquiry.", 409));
    const error = vi.spyOn(toast, "error");
    render(<MarketingInquiriesPage />);

    fireEvent.click(await screen.findByRole("tab", { name: /Unassigned/ }));
    await screen.findByText("Nobody Yet");
    get.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Claim/ }));
    });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith("Someone else has already taken this enquiry.");
  });

  it("the superadmin sees everything and is never offered Claim", async () => {
    me.current = { id: 1, name: "Boss", role: "superadmin", permissions: ["leads"] };
    get.mockResolvedValue(answer([row({ id: 9, name: "Nobody Yet", assigned_to_name: null, assigned_to_id: null })], { scope: "all" }));
    render(<MarketingInquiriesPage />);

    await screen.findByText("Nobody Yet");
    expect(get).toHaveBeenCalledWith("/marketing/contact-requests?scope=all&page=1");
    expect(screen.getByRole("tab", { name: /All enquiries/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Claim/ })).toBeNull();
  });

  it("says so when nothing matches, and when the whole desk is empty", async () => {
    get.mockResolvedValue(answer([]));
    render(<MarketingInquiriesPage />);
    expect(await screen.findByText(/No inquiries yet/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "nothing" } });
    expect(await screen.findByText("No enquiry matches that.", undefined, { timeout: 2000 })).toBeTruthy();
  });

  it("an employee without the leads permission sees the access notice, not the desk", async () => {
    me.current = { id: 5, name: "Maya", role: "admin_marketing", permissions: [] };
    render(<MarketingInquiriesPage />);
    expect((await screen.findAllByText(/access/i)).length).toBeGreaterThan(0);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("the enquiry banner on the marketing home", () => {
  it("tells the employee what is waiting, how much is overdue, and links to the desk", async () => {
    get.mockResolvedValue(answer([], { kpis: { ...answer([]).kpis, awaiting_first_contact: 4, overdue: 2, unassigned: 1 } }));
    render(<EnquiryBanner isSuperadmin={false} />);

    expect(await screen.findByText("4 enquiries are waiting for a first reply")).toBeTruthy();
    expect(screen.getByText("2 overdue")).toBeTruthy();
    expect(screen.getByText("1 in the unassigned queue")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/marketing/inquiries");
    expect(get).toHaveBeenCalledWith("/marketing/contact-requests?scope=mine&status=new");
  });

  it("draws nothing when nothing is waiting, or when the read fails", async () => {
    get.mockResolvedValue(answer([], { kpis: { ...answer([]).kpis, awaiting_first_contact: 0, unassigned: 0 } }));
    const { container } = render(<EnquiryBanner isSuperadmin />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.textContent).toBe("");
    cleanup();

    get.mockRejectedValue(new ApiError("down", 500));
    const failed = render(<EnquiryBanner isSuperadmin={false} />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(failed.container.textContent).toBe("");
  });
});
