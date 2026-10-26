import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { LeadsPanel } from "@/components/admin/superadmin/LeadsPanel";
import type { LeadStatus, LeadSummary } from "@/types/lead";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});

// The drawers have their own tests; here they only need to exist.
vi.mock("@/components/leads/LeadDetailDrawer", () => ({ LeadDetailDrawer: () => null }));
vi.mock("@/components/admin/superadmin/UserManageDrawer", () => ({ UserManageDrawer: () => null }));

const toast = vi.fn();

const lead = (id: number, name: string, status: LeadStatus = "new", over: Partial<LeadSummary> = {}): LeadSummary => ({
  id,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@example.com`,
  created_at: "2026-10-01T00:00:00Z",
  lead_status: status,
  is_blocked: false,
  plan_name: "Coder",
  subscription_status: "active",
  solved_score: 0,
  note_count: 0,
  assigned_to_name: null,
  ...over,
});

const ALL = [lead(1, "Asha Rao"), lead(2, "Bala Iyer", "contacted", { assigned_to_name: "Maya Marketer" }), lead(3, "Chitra Nair", "converted")];

const KPIS = { total_leads: 3, new_this_week: 3, converted_count: 1, conversion_rate: 33.3 };
const FACETS = { total: 3, by_status: { new: 1, contacted: 1, engaged: 0, converted: 1, lost: 0 }, unassigned: 2 };

const page = (rows: LeadSummary[], over: Record<string, unknown> = {}) => ({
  leads: { data: rows, current_page: 1, last_page: 1, total: rows.length },
  kpis: KPIS,
  facets: FACETS,
  ...over,
});

const calls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/marketing/leads"));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  toast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Leads tab — loading", () => {
  it("shows a placeholder, not an empty list, until the first answer; then the leads and what they add up to", async () => {
    let release!: (v: unknown) => void;
    get.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    render(<LeadsPanel triggerToast={toast} />);

    expect(screen.getByRole("status", { name: "Loading leads" })).toBeTruthy();
    expect(screen.getByText("Loading leads…")).toBeTruthy();
    expect(screen.queryByText("No Mellow Direct leads yet.")).toBeNull();

    await act(async () => release(page(ALL)));

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("3 lead(s) who signed up without a college.")).toBeTruthy();
    expect(screen.getByText("33.3%")).toBeTruthy();
  });

  it("explains a slow first load", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    get.mockImplementation(() => new Promise(() => undefined));
    render(<LeadsPanel triggerToast={toast} />);

    await act(async () => void vi.advanceTimersByTime(4100));
    expect(screen.getByText(/Still working — this is taking longer than usual/)).toBeTruthy();
  });

  it("says why a failed load failed and recovers on Try again — it never claims there are no leads", async () => {
    let fail = true;
    get.mockImplementation(() => (fail ? Promise.reject(new ApiError("The server hit a snag.", 500)) : Promise.resolve(page(ALL))));
    render(<LeadsPanel triggerToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toContain("The server hit a snag.");
    expect(screen.queryByText("No Mellow Direct leads yet.")).toBeNull();
    expect(toast).toHaveBeenCalledWith("The server hit a snag.", "error");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
  });

  it("says there are no leads yet only when there really are none", async () => {
    get.mockResolvedValue(page([], { facets: { total: 0, by_status: { new: 0, contacted: 0, engaged: 0, converted: 0, lost: 0 }, unassigned: 0 }, kpis: { total_leads: 0, new_this_week: 0, converted_count: 0, conversion_rate: 0 } }));
    render(<LeadsPanel triggerToast={toast} />);
    expect(await screen.findByText("No Mellow Direct leads yet.")).toBeTruthy();
  });

  it("keeps the rows (dimmed, 'Updating…') while a new filter loads, and never claims the old rows match it", async () => {
    let releaseSecond!: (v: unknown) => void;
    let n = 0;
    get.mockImplementation(() => (++n === 1 ? Promise.resolve(page(ALL)) : new Promise((resolve) => (releaseSecond = resolve))));
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by lead status" })).getByRole("button", { name: /^Converted/ }));

    expect(await screen.findByText(/Updating…/)).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText(/who signed up without a college/)).toBeTruthy();

    await act(async () => releaseSecond(page([ALL[2]])));
    await waitFor(() => expect(screen.queryByText("Asha Rao")).toBeNull());
    expect(screen.getByText("1 lead(s) match this filter.")).toBeTruthy();
  });

  it("ignores a late answer to an old filter", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    get.mockImplementation((path: string) => {
      const status = new URL(path, "http://x").searchParams.get("status") ?? "";
      if (status === "") return Promise.resolve(page(ALL));
      return new Promise((resolve) => (pending[status] = resolve));
    });
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    const group = screen.getByRole("group", { name: "Filter by lead status" });
    fireEvent.click(within(group).getByRole("button", { name: /^New/ }));
    await waitFor(() => expect(pending["new"]).toBeTruthy());
    fireEvent.click(within(group).getByRole("button", { name: /^Contacted/ }));
    await waitFor(() => expect(pending["contacted"]).toBeTruthy());

    await act(async () => pending["contacted"](page([ALL[1]])));
    await screen.findByText("1 lead(s) match this filter.");
    await act(async () => pending["new"](page([ALL[0]])));

    expect(screen.getByText("Bala Iyer")).toBeTruthy();
    expect(screen.queryByText("Asha Rao")).toBeNull();
  });
});

describe("Leads tab — filters are answered by the server", () => {
  beforeEach(() => {
    get.mockImplementation(() => Promise.resolve(page(ALL)));
  });

  it("shows how many leads each status would list, from the server's counts", async () => {
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    const chip = (name: RegExp) => within(screen.getByRole("group", { name: "Filter by lead status" })).getByRole("button", { name });
    expect(chip(/^All/).textContent).toContain("3");
    expect(chip(/^New/).textContent).toContain("1");
    expect(chip(/^Engaged/).textContent).toContain("0");
    expect(chip(/^Converted/).textContent).toContain("1");
    expect(screen.getByRole("button", { name: /^Unassigned only/ }).textContent).toContain("2");
  });

  it("asks for a status through the API, and 'All' asks for none", async () => {
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");
    const group = screen.getByRole("group", { name: "Filter by lead status" });

    fireEvent.click(within(group).getByRole("button", { name: /^Lost/ }));
    await waitFor(() => expect(calls().at(-1)).toContain("status=lost"));
    expect(within(group).getByRole("button", { name: /^Lost/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(group).getByRole("button", { name: /^All/ }));
    await waitFor(() => expect(calls().at(-1)).not.toContain("status="));
  });

  it("searches the whole book through the server after a short pause, not just the rows on screen", async () => {
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");
    const before = calls().length;

    fireEvent.change(screen.getByLabelText("Search leads"), { target: { value: "n" } });
    fireEvent.change(screen.getByLabelText("Search leads"), { target: { value: "ne" } });
    fireEvent.change(screen.getByLabelText("Search leads"), { target: { value: "nee" } });

    await waitFor(() => expect(calls().length).toBe(before + 1), { timeout: 2000 });
    expect(calls().at(-1)).toContain("search=nee");
  });

  it("asks only for unassigned leads when that switch is on", async () => {
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(screen.getByRole("button", { name: /^Unassigned only/ }));
    await waitFor(() => expect(calls().at(-1)).toContain("assigned=unassigned"));
    expect(screen.getByRole("button", { name: /^Unassigned only/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("says when nothing matches, and Clear filters puts every control back", async () => {
    get.mockImplementation((path: string) => Promise.resolve(path.includes("status=") ? page([]) : page(ALL)));
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by lead status" })).getByRole("button", { name: /^Lost/ }));
    expect(await screen.findByText("No leads match these filters.")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(calls().at(-1)).not.toContain("status=");
  });

  it("appends the next page on Load more and says how far through the list it is", async () => {
    const first = [lead(1, "First One"), lead(2, "First Two")];
    get.mockImplementation((path: string) =>
      Promise.resolve(
        path.includes("page=2")
          ? page([lead(3, "Last One")], { leads: { data: [lead(3, "Last One")], current_page: 2, last_page: 2, total: 3 } })
          : page(first, { leads: { data: first, current_page: 1, last_page: 2, total: 3 } })
      )
    );
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("First One");
    expect(screen.getByText("Showing 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Last One")).toBeTruthy();
    expect(screen.getByText("First One")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});

describe("Leads tab — blocking", () => {
  it("flips Block / Unblock at once and says so, and starts from the server's own flag on the next load", async () => {
    get.mockImplementation(() => Promise.resolve(page([lead(1, "Asha Rao"), lead(2, "Dev Blocked", "new", { is_blocked: true })])));
    post.mockImplementation((path: string) => Promise.resolve({ user: { is_blocked: path.includes("/1/") } }));
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;
    expect(within(rowOf("Asha Rao")).getByRole("button", { name: "Block" })).toBeTruthy();
    expect(within(rowOf("Dev Blocked")).getByRole("button", { name: "Unblock" })).toBeTruthy();

    fireEvent.click(within(rowOf("Asha Rao")).getByRole("button", { name: "Block" }));
    await waitFor(() => expect(within(rowOf("Asha Rao")).getByRole("button", { name: "Unblock" })).toBeTruthy());
    expect(toast).toHaveBeenCalledWith("Asha Rao's account blocked.");

    fireEvent.click(within(rowOf("Dev Blocked")).getByRole("button", { name: "Unblock" }));
    await waitFor(() => expect(within(rowOf("Dev Blocked")).getByRole("button", { name: "Block" })).toBeTruthy());
    expect(toast).toHaveBeenCalledWith("Dev Blocked's account unblocked.");
  });

  it("reports a failed block as an error and leaves the button as it was", async () => {
    get.mockResolvedValue(page([lead(1, "Asha Rao")]));
    post.mockRejectedValue(new ApiError("You can't block this account.", 403));
    render(<LeadsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("You can't block this account.", "error"));
    expect(screen.getByRole("button", { name: "Block" })).toBeTruthy();
  });
});
