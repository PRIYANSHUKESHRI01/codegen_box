import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { MarketingTeamPanel } from "@/components/admin/superadmin/marketingTeam/MarketingTeamPanel";
import type { TeamMember, TeamTotals } from "@/components/admin/superadmin/marketingTeam/types";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const confirm = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: (p: string, b?: unknown) => del(p, b) } };
});
vi.mock("@/lib/dialogs", () => ({ confirmDialog: (o: unknown) => confirm(o) }));
vi.mock("@/components/admin/superadmin/UserManageDrawer", () => ({ UserManageDrawer: ({ userId }: { userId: number }) => <aside aria-label="account drawer">drawer for {userId}</aside> }));

const toast = vi.fn();

const member = (over: Partial<TeamMember> & { id: number; name: string }): TeamMember => ({
  email: `${over.name.toLowerCase()}@mellow.test`,
  handle: over.name.toLowerCase(),
  is_blocked: false,
  blocked_reason: null,
  permissions: ["leads", "lead_outreach"],
  must_change_password: false,
  created_at: "2026-10-01T00:00:00Z",
  leads: { open: 4, converted: 2, total: 9 },
  enquiries: { open: 3, total: 5 },
  ...over,
});

const ASHA = member({ id: 1, name: "Asha" });
const RAVI = member({ id: 2, name: "Ravi", permissions: ["leads"], leads: { open: 0, converted: 0, total: 0 }, enquiries: { open: 0, total: 0 } });

const TOTALS: TeamTotals = { employees: 2, active: 2, open_leads: 4, open_enquiries: 3, unassigned_leads: 0, unassigned_enquiries: 0 };

const team = (employees: TeamMember[], totals: Partial<TeamTotals> = {}) => ({ employees, totals: { ...TOTALS, employees: employees.length, ...totals } });

const WORKLOAD = { workload: { leads_open: 4, leads_closed: 5, enquiries_open: 3, enquiries_closed: 2 }, colleagues: [{ id: 2, name: "Ravi", email: "ravi@mellow.test" }] };

const route = (map: Record<string, unknown>) =>
  get.mockImplementation((path: string) => {
    const hit = Object.keys(map).find((k) => path === k || path.startsWith(k));
    return hit ? Promise.resolve(map[hit]) : Promise.reject(new ApiError("not mocked: " + path, 404));
  });

const openMenu = async (name: string) => {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`manage ${name}`, "i") }));
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  toast.mockReset();
  confirm.mockReset().mockResolvedValue(true);
  route({ "/superadmin/marketing-team/1/workload": WORKLOAD, "/superadmin/marketing-team": team([ASHA, RAVI]) });
});
afterEach(cleanup);

describe("the team view", () => {
  it("shows each person with what they carry, and the totals", async () => {
    render(<MarketingTeamPanel triggerToast={toast} />);
    const rows = await screen.findAllByTestId("team-row");

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Asha")).toBeTruthy();
    expect(rows[0].textContent).toMatch(/4\s*leads/);
    expect(rows[0].textContent).toMatch(/3\s*enquiries/);
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns plainly when work is waiting and nobody active can take it", async () => {
    route({ "/superadmin/marketing-team": team([member({ id: 3, name: "Meena", is_blocked: true })], { active: 0, unassigned_enquiries: 2, unassigned_leads: 1 }) });
    render(<MarketingTeamPanel triggerToast={toast} />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/3 items are waiting for an owner/);
    expect(alert.textContent).toMatch(/no active marketing employee/i);
  });

  it("filters by status and by search, and says when nobody matches", async () => {
    route({ "/superadmin/marketing-team": team([ASHA, member({ id: 3, name: "Meena", is_blocked: true })]) });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await screen.findAllByTestId("team-row");

    fireEvent.click(screen.getByRole("button", { name: "Blocked" }));
    expect(screen.getAllByTestId("team-row")).toHaveLength(1);
    expect(screen.getByText("Meena")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search the marketing team"), { target: { value: "zzz" } });
    expect(await screen.findByText(/No one matches/)).toBeTruthy();
  });

  it("invites the first hire when the team is empty", async () => {
    route({ "/superadmin/marketing-team": team([], { employees: 0, active: 0 }) });
    render(<MarketingTeamPanel triggerToast={toast} />);

    expect(await screen.findByText(/No marketing employees yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add the first one/i }));
    expect(await screen.findByLabelText(/full name/i)).toBeTruthy();
  });
});

describe("adding", () => {
  it("creates a marketing account with the chosen access and shows the one-time password", async () => {
    post.mockResolvedValue({ user: { id: 9, name: "Kabir", email: "kabir@mellow.test" }, temporary_password: "Tmp-Pass-123", credentials_email_sent: true });
    render(<MarketingTeamPanel triggerToast={toast} />);
    fireEvent.click(await screen.findByRole("button", { name: /add marketing employee/i }));

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Kabir" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "kabir@mellow.test" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /send bulk lead emails/i }));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users", { name: "Kabir", email: "kabir@mellow.test", role: "admin_marketing", permissions: ["leads"] }));
    expect(await screen.findByText("Tmp-Pass-123")).toBeTruthy();
    expect(screen.getByText(/emailed to kabir@mellow.test/i)).toBeTruthy();
  });

  it("keeps the form and shows the server's reason when the email is taken", async () => {
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { email: ["The email has already been taken."] }));
    render(<MarketingTeamPanel triggerToast={toast} />);
    fireEvent.click(await screen.findByRole("button", { name: /add marketing employee/i }));
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Kabir" } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "asha@mellow.test" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/already been taken/)).toBeTruthy();
    expect((screen.getByLabelText(/work email/i) as HTMLInputElement).value).toBe("asha@mellow.test");
  });
});

describe("handing work over", () => {
  it("shows what would move, defaults to sharing evenly, and sends only open work unless asked", async () => {
    post.mockResolvedValue({ leads: 4, enquiries: 3 });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /reassign work/i }));

    expect(await screen.findByText(/open leads · 5 closed/)).toBeTruthy();
    expect((screen.getByRole("radio", { name: /share evenly/i }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /move 7 items/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/marketing-team/1/reassign", { reassign_mode: "distribute", reassign_to: null, include_closed: false }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Moved 4 leads and 3 enquiries from Asha/));
  });

  it("can give it all to one named colleague, closed ones included", async () => {
    post.mockResolvedValue({ leads: 9, enquiries: 5 });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /reassign work/i }));
    await screen.findByText(/open leads · 5 closed/);

    fireEvent.click(screen.getByRole("checkbox", { name: /also move their closed ones/i }));
    fireEvent.click(screen.getByRole("radio", { name: /give it all to one person/i }));
    expect((screen.getByLabelText("Colleague who takes over") as HTMLSelectElement).value).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: /move 14 items/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/marketing-team/1/reassign", { reassign_mode: "to", reassign_to: 2, include_closed: true }));
  });

  it("offers only 'leave unassigned' when there is nobody else to share with", async () => {
    route({ "/superadmin/marketing-team/1/workload": { ...WORKLOAD, colleagues: [] }, "/superadmin/marketing-team": team([ASHA]) });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /reassign work/i }));

    expect(await screen.findByText(/no other active marketing employee/i)).toBeTruthy();
    expect((screen.getByRole("radio", { name: /share evenly/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: /leave it unassigned/i }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("blocking", () => {
  it("asks first, blocks, then offers to hand over what they still hold", async () => {
    post.mockResolvedValue({});
    confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /^block$/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/1/toggle-block", undefined));
    expect(confirm).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: "Block Asha?" }));
    expect(confirm).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: expect.stringMatching(/hand over their open work/i) }));
    expect(await screen.findByText(/Reassign work/)).toBeTruthy();
  });

  it("does nothing when the confirmation is cancelled", async () => {
    confirm.mockResolvedValue(false);
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /^block$/i }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(post).not.toHaveBeenCalled();
  });
});

describe("deleting", () => {
  const openDelete = async () => {
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await screen.findByText(/holds/);
  };
  const button = () => screen.getByRole("button", { name: /delete permanently/i }) as HTMLButtonElement;

  it("stays off until the work has a home, the email is typed and the password entered", async () => {
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openDelete();

    expect(button().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/type .* to confirm/i), { target: { value: "asha@mellow" } });
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "pw" } });
    expect(button().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/type .* to confirm/i), { target: { value: "ASHA@mellow.test" } });
    expect(button().disabled).toBe(false);
  });

  it("sends the handover choice with the confirmation and says where the work went", async () => {
    del.mockResolvedValue({ deleted: true, leads: 9, enquiries: 5 });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openDelete();

    fireEvent.change(screen.getByLabelText(/type .* to confirm/i), { target: { value: "asha@mellow.test" } });
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "pw" } });
    fireEvent.click(button());

    await waitFor(() => expect(del).toHaveBeenCalledWith("/superadmin/marketing-team/1", { password: "pw", confirm_email: "asha@mellow.test", reassign_mode: "distribute", reassign_to: null }));
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Asha was deleted\. 9 leads and 5 enquiries were handed over/));
  });

  it("shows the server's refusal and clears the password, leaving the dialog open", async () => {
    del.mockRejectedValue(new ApiError("The given data was invalid.", 422, { password: ["That is not your password. Enter the password you sign in with."] }));
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openDelete();

    fireEvent.change(screen.getByLabelText(/type .* to confirm/i), { target: { value: "asha@mellow.test" } });
    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "nope" } });
    fireEvent.click(button());

    expect(await screen.findByText(/not your password/)).toBeTruthy();
    expect((screen.getByLabelText(/your password/i) as HTMLInputElement).value).toBe("");
    expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/was deleted/));
  });

  it("asks for nothing about handover when they carry nothing", async () => {
    route({ "/superadmin/marketing-team/2/workload": { workload: { leads_open: 0, leads_closed: 0, enquiries_open: 0, enquiries_closed: 0 }, colleagues: [] }, "/superadmin/marketing-team": team([ASHA, RAVI]) });
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Ravi");
    fireEvent.click(screen.getByRole("menuitem", { name: /^delete$/i }));

    expect(await screen.findByText(/holds no leads or enquiries/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("access and account", () => {
  it("saves a changed set of sections", async () => {
    post.mockResolvedValue({});
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /edit access/i }));

    fireEvent.click(await screen.findByRole("checkbox", { name: /send bulk lead emails/i }));
    fireEvent.click(screen.getByRole("button", { name: /save access/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/1/permissions", { permissions: ["leads"] }));
  });

  it("opens the existing account drawer for details, password and sign-out", async () => {
    render(<MarketingTeamPanel triggerToast={toast} />);
    await openMenu("Asha");
    fireEvent.click(screen.getByRole("menuitem", { name: /account & password/i }));

    expect(await screen.findByLabelText("account drawer")).toBeTruthy();
  });
});
