import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AccountsPanel } from "@/components/admin/superadmin/AccountsPanel";
import { MellowStaffPanel } from "@/components/admin/superadmin/MellowStaffPanel";
import { credentialAccess } from "@/components/admin/superadmin/credentialAccess";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/components/admin/superadmin/UserManageDrawer", () => ({ UserManageDrawer: () => null }));

const toast = vi.fn();

const account = (id: number, name: string, role = "user", over: Record<string, unknown> = {}) => ({
  id,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@mellow.test`,
  handle: null,
  role,
  is_blocked: false,
  must_change_password: false,
  credential_state: "owner_set",
  credentials_email_sent_at: null,
  created_at: "2026-10-01T00:00:00Z",
  college: null,
  subscription: null,
  permissions: [],
  ...over,
});

const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length, ...over });

const FACETS = {
  roles: { user: 10, admin_tpo: 2, admin_internal: 2, admin_marketing: 1, superadmin: 1 },
  total: 16,
  colleges: [{ id: 9, name: "Tulas University", short_code: "TUL", city: null, accounts: 12 }],
  without_college: 4,
};

const usersCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/users?"));
const facetCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/users/facets"));

function answer(users: (path: string) => unknown, facets: unknown = FACETS) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/superadmin/users/facets")) return Promise.resolve(facets);
    if (path.startsWith("/superadmin/credentials/status")) return Promise.resolve({ unlocked: false });
    if (path.startsWith("/admin/colleges")) return Promise.resolve({ colleges: [] });
    if (path.startsWith("/superadmin/users?")) return users(path);
    return Promise.resolve({});
  });
}

beforeEach(async () => {
  get.mockReset();
  post.mockReset();
  toast.mockReset();
  await credentialAccess.lock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Accounts & Logins", () => {
  const ROWS = [account(1, "Asha Rao"), account(2, "Dev Tpo", "admin_tpo"), account(3, "Maya Ops", "admin_internal")];

  it("shows a placeholder — not '0 account(s)' or 'No accounts found' — until the first answer", async () => {
    let release!: (v: unknown) => void;
    answer(() => new Promise((resolve) => (release = resolve)));
    render(<AccountsPanel triggerToast={toast} />);

    expect(screen.getByRole("status", { name: "Loading accounts" })).toBeTruthy();
    expect(screen.getByText(/Loading accounts…/)).toBeTruthy();
    expect(screen.queryByText(/0 account/)).toBeNull();
    expect(screen.queryByText("No accounts found.")).toBeNull();

    await act(async () => release(page(ROWS)));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText(/3 account\(s\)\./)).toBeTruthy();
  });

  it("explains a slow first load, and says why a failed one failed with a way to retry", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    answer(() => new Promise(() => undefined));
    render(<AccountsPanel triggerToast={toast} />);
    await act(async () => void vi.advanceTimersByTime(4100));
    expect(screen.getByText(/Still working — this is taking longer than usual/)).toBeTruthy();
    cleanup();
    vi.useRealTimers();

    let fail = true;
    answer(() => (fail ? Promise.reject(new ApiError("The server hit a snag.", 500)) : Promise.resolve(page(ROWS))));
    render(<AccountsPanel triggerToast={toast} />);
    expect((await screen.findByRole("alert")).textContent).toContain("The server hit a snag.");
    expect(screen.queryByText("No accounts found.")).toBeNull();
    expect(toast).toHaveBeenCalledWith("The server hit a snag.", "error");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
  });

  it("keeps the rows (dimmed, 'Updating…') while a new filter loads, and a late answer to an old filter never lands", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    answer((path) => {
      const role = new URL(path, "http://x").searchParams.get("role") ?? "";
      return role === "" ? Promise.resolve(page(ROWS)) : new Promise((resolve) => (pending[role] = resolve));
    });
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by account type" })).getByRole("button", { name: /College TPOs/ }));
    await waitFor(() => expect(pending["admin_tpo"]).toBeTruthy());
    expect(screen.getByText(/Updating…/)).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by account type" })).getByRole("button", { name: /Students/ }));
    await waitFor(() => expect(pending["user"]).toBeTruthy());

    await act(async () => pending["user"](page([ROWS[0]])));
    await screen.findByText(/1 account\(s\) match\./);
    await act(async () => pending["admin_tpo"](page([ROWS[1]])));

    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.queryByText("Dev Tpo")).toBeNull();
  });

  it("asks the counts the same question as the list, including the chosen plan", async () => {
    answer(() => Promise.resolve(page(ROWS)));
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.change(screen.getByLabelText("Filter by plan"), { target: { value: "paid" } });
    await waitFor(() => expect(usersCalls().at(-1)).toContain("plan=paid"));
    await waitFor(() => expect(facetCalls().at(-1)).toContain("plan=paid"));
    expect(usersCalls().at(-1)).toContain("role=user");
  });

  it("says when nothing matches, and Clear filters brings everything back", async () => {
    answer((path) => Promise.resolve(path.includes("role=") ? page([]) : page(ROWS)));
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by account type" })).getByRole("button", { name: /College TPOs/ }));
    expect(await screen.findByText("No accounts match this filter.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(usersCalls().at(-1)).not.toContain("role=");
  });

  it("uses the server's 'All' total on the All chip (a chosen plan narrows it to the students on it)", async () => {
    answer(() => Promise.resolve(page(ROWS)), { ...FACETS, total: 7 });
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    const all = await within(screen.getByRole("group", { name: "Filter by account type" })).findByRole("button", { name: /All accounts/ });
    expect(all.textContent).toContain("7");
  });

  it("shows how far through a long list it is, and appends the next page", async () => {
    answer((path) => Promise.resolve(path.includes("page=2") ? page([account(9, "Last Person")], { current_page: 2, last_page: 2, total: 3 }) : page(ROWS.slice(0, 2), { last_page: 2, total: 3 })));
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");
    expect(screen.getByText("Showing 2 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Last Person")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
  });
});

describe("Mellow Staff", () => {
  const STAFF = [account(1, "Aryan Boss", "superadmin"), account(2, "Maya Ops", "admin_internal"), account(3, "Rohan Mkt", "admin_marketing")];
  const staffFacets = { ...FACETS, roles: { admin_internal: 1, admin_marketing: 1, superadmin: 1, user: 40 }, total: 43 };

  const open = async (users: (path: string) => unknown = () => Promise.resolve(page(STAFF))) => {
    answer(users, staffFacets);
    render(<MellowStaffPanel meId={1} triggerToast={toast} />);
    await screen.findByText("Maya Ops");
  };

  it("shows a placeholder until the first answer, then who is on the team", async () => {
    let release!: (v: unknown) => void;
    answer(() => new Promise((resolve) => (release = resolve)), staffFacets);
    render(<MellowStaffPanel meId={1} triggerToast={toast} />);
    expect(screen.getByRole("status", { name: "Loading staff" })).toBeTruthy();
    expect(screen.queryByText("No staff accounts found.")).toBeNull();

    await act(async () => release(page(STAFF)));
    expect(await screen.findByText("Maya Ops")).toBeTruthy();
    expect(screen.getByText(/3 internal account\(s\)/)).toBeTruthy();
  });

  it("says why a failed load failed and recovers on Try again", async () => {
    let fail = true;
    answer(() => (fail ? Promise.reject(new ApiError("Staff service is down.", 500)) : Promise.resolve(page(STAFF))), staffFacets);
    render(<MellowStaffPanel meId={1} triggerToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Staff service is down.");
    expect(toast).toHaveBeenCalledWith("Staff service is down.", "error");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Maya Ops")).toBeTruthy();
  });

  it("has a chip per team whose count is what picking it lists — and never counts students", async () => {
    await open();
    const group = screen.getByRole("group", { name: "Filter by account type" });

    expect(within(group).getByRole("button", { name: /All staff/ }).textContent).toContain("3");
    expect(within(group).getByRole("button", { name: /Internal Ops/ }).textContent).toContain("1");
    expect(within(group).getByRole("button", { name: /Marketing/ }).textContent).toContain("1");
    expect(within(group).getByRole("button", { name: /Superadmins/ }).textContent).toContain("1");

    fireEvent.click(within(group).getByRole("button", { name: /Marketing/ }));
    await waitFor(() => expect(usersCalls().at(-1)).toContain("roles=admin_marketing"));
    fireEvent.click(within(group).getByRole("button", { name: /All staff/ }));
    await waitFor(() => expect(usersCalls().at(-1)).toContain("roles=admin_internal%2Cadmin_marketing%2Csuperadmin"));
  });

  it("searches through the server after a short pause, and the counts follow the search", async () => {
    await open();
    const before = usersCalls().length;

    fireEvent.change(screen.getByLabelText("Search staff"), { target: { value: "m" } });
    fireEvent.change(screen.getByLabelText("Search staff"), { target: { value: "ma" } });
    fireEvent.change(screen.getByLabelText("Search staff"), { target: { value: "may" } });

    await waitFor(() => expect(usersCalls().length).toBe(before + 1), { timeout: 2000 });
    expect(usersCalls().at(-1)).toContain("search=may");
    await waitFor(() => expect(facetCalls().at(-1)).toContain("search=may"));
  });

  it("ignores a late answer to an old team filter", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    await open((path) => {
      const roles = new URL(path, "http://x").searchParams.get("roles") ?? "";
      return roles.includes(",") ? Promise.resolve(page(STAFF)) : new Promise((resolve) => (pending[roles] = resolve));
    });
    const group = screen.getByRole("group", { name: "Filter by account type" });

    fireEvent.click(within(group).getByRole("button", { name: /Internal Ops/ }));
    await waitFor(() => expect(pending["admin_internal"]).toBeTruthy());
    fireEvent.click(within(group).getByRole("button", { name: /Superadmins/ }));
    await waitFor(() => expect(pending["superadmin"]).toBeTruthy());

    await act(async () => pending["superadmin"](page([STAFF[0]])));
    await screen.findByText("1 match this filter.");
    await act(async () => pending["admin_internal"](page([STAFF[1]])));

    expect(screen.getByText("Aryan Boss")).toBeTruthy();
    expect(screen.queryByText("Maya Ops")).toBeNull();
  });

  it("reads the list and the counts again after a staff account is created, instead of patching the rows", async () => {
    await open();
    post.mockResolvedValue({ user: account(4, "New Hire", "admin_marketing"), temporary_password: "Temp-1234", credentials_email_sent: true });
    const listCalls = usersCalls().length;
    const countCalls = facetCalls().length;

    fireEvent.click(screen.getByRole("button", { name: /Add Staff/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("e.g. Maya Iyer"), { target: { value: "New Hire" } });
    fireEvent.change(within(dialog).getByPlaceholderText("maya@mellow.ai"), { target: { value: "hire@mellow.ai" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Account" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    await waitFor(() => expect(usersCalls().length).toBe(listCalls + 1));
    await waitFor(() => expect(facetCalls().length).toBe(countCalls + 1));
  });

  it("says when nothing matches and offers Clear filters", async () => {
    await open((path) => Promise.resolve(path.includes("search=") ? page([]) : page(STAFF)));
    fireEvent.change(screen.getByLabelText("Search staff"), { target: { value: "zzz" } });

    expect(await screen.findByText("No staff match this filter.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Maya Ops")).toBeTruthy();
    expect((screen.getByLabelText("Search staff") as HTMLInputElement).value).toBe("");
  });
});
