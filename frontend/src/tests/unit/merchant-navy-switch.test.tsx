import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { buildStudentNav } from "@/components/dashboard/studentNav";
import { MerchantNavyPanel } from "@/components/admin/superadmin/MerchantNavyPanel";
import { ModuleGate } from "@/components/dashboard/ModuleGate";
import { MockInterviewExplorer } from "@/components/dashboard/interviews/MockInterviewExplorer";
import { MODULES_CHANGED_EVENT, PLAN_SYNC_POLL_MS, __resetPlanSyncForTests, startPlanSync, type ModulesChangedDetail } from "@/lib/planSync";

const get = vi.fn();
const put = vi.fn();
const confirm = vi.fn();
let authUser: Record<string, unknown> | null = { role: "user", capabilities: {} };

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: vi.fn(), put: (p: string, b?: unknown) => put(p, b), delete: vi.fn() } };
});
vi.mock("@/lib/dialogs", () => ({ confirmDialog: (o: unknown) => confirm(o) }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: authUser, status: "ready", refresh: vi.fn() }) }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main aria-label={title}>{children}</main>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/dashboard/interviews",
}));

const toast = vi.fn();

const MODULE = {
  key: "merchant_navy",
  label: "Merchant Navy",
  description: "Oral-exam practice for deck officers.",
  enabled: true,
  surfaces: [
    { key: "sidebar", label: "Student sidebar", detail: "Merchant Navy group" },
    { key: "mock_card", label: "Mock AI Interview", detail: "The Merchant Navy card" },
  ],
  content: [
    { key: "second_mate_fg", name: "Second Mate (FG)", live: true, sets: 23, questions: 690 },
    { key: "master_fg", name: "Master (FG)", live: false, sets: 10, questions: 0 },
  ],
  updated_by_name: "Aryan Mehta",
  updated_at: "2026-10-30T09:00:00Z",
};

const listing = (over: Partial<typeof MODULE> = {}) => ({ modules: [{ ...MODULE, ...over }], history: [{ id: 1, action: "x", enabled: true, actor_name: "Aryan Mehta", at: "2026-10-30T09:00:00Z" }] });

beforeEach(() => {
  get.mockReset().mockResolvedValue(listing());
  put.mockReset();
  confirm.mockReset().mockResolvedValue(true);
  toast.mockReset();
  authUser = { role: "user", capabilities: {} };
});
afterEach(cleanup);

describe("the student's sidebar", () => {
  it("drops the Merchant Navy group when the superadmin has switched it off, and keeps everything else", () => {
    const on = buildStudentNav({ projectLabEnabled: true, vaultEnabled: true, capabilities: { merchant_navy: true } });
    const off = buildStudentNav({ projectLabEnabled: true, vaultEnabled: true, capabilities: { merchant_navy: false } });

    expect(on.map((s) => s.title)).toContain("Merchant Navy");
    expect(off.map((s) => s.title)).not.toContain("Merchant Navy");
    // Mock AI Interview itself stays in Placements (only its Merchant Navy card goes, and that comes from the server's catalogue).
    expect(off.find((s) => s.title === "Placements")!.items.map((i) => i.href)).toContain("/dashboard/interviews");
  });

  it("an older cached user with no such key still sees it (the switch ships on)", () => {
    expect(buildStudentNav({ projectLabEnabled: true, vaultEnabled: true, capabilities: { ai_interviews: true } }).map((s) => s.title)).toContain("Merchant Navy");
  });
});

describe("ModuleGate", () => {
  it("shows the page while the section is on", () => {
    authUser = { role: "user", capabilities: { merchant_navy: true } };
    render(
      <ModuleGate capability="merchant_navy" name="Merchant Navy">
        <p>the exams</p>
      </ModuleGate>
    );
    expect(screen.getByText("the exams")).toBeTruthy();
  });

  it("explains calmly, with a way out, when it has been switched off", () => {
    authUser = { role: "user", capabilities: { merchant_navy: false } };
    render(
      <ModuleGate capability="merchant_navy" name="Merchant Navy">
        <p>the exams</p>
      </ModuleGate>
    );
    expect(screen.queryByText("the exams")).toBeNull();
    expect(screen.getByTestId("module-gate").textContent).toMatch(/isn.t available right now/);
    expect(screen.getByRole("link", { name: /back to dashboard/i })).toBeTruthy();
  });

  it("never gates staff", () => {
    authUser = { role: "superadmin", capabilities: { merchant_navy: false } };
    render(
      <ModuleGate capability="merchant_navy" name="Merchant Navy">
        <p>the exams</p>
      </ModuleGate>
    );
    expect(screen.getByText("the exams")).toBeTruthy();
  });
});

describe("Superadmin -> Merchant Navy", () => {
  it("shows the state, where students see it, what is inside and who changed it last", async () => {
    render(<MerchantNavyPanel triggerToast={toast} />);

    expect(await screen.findByText(/Active — students can see it/)).toBeTruthy();
    expect(screen.getByText("Student sidebar")).toBeTruthy();
    expect(screen.getAllByText("Visible")).toHaveLength(2);
    expect(screen.getByText("Second Mate (FG)")).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText(/Last changed .* by Aryan Mehta/)).toBeTruthy();
  });

  it("asks first, then sends an explicit off (never a blind flip) and shows the section hidden", async () => {
    put.mockResolvedValue({ module: { ...MODULE, enabled: false }, changed: true, history: [] });
    render(<MerchantNavyPanel triggerToast={toast} />);
    await screen.findByText(/Active — students can see it/);

    fireEvent.click(screen.getByRole("switch", { name: /merchant navy section/i }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/platform-modules/merchant_navy", { enabled: false }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/deactivate/i), tone: "warning" }));
    expect(await screen.findByText(/Inactive — hidden from every student/)).toBeTruthy();
    expect(screen.getAllByText("Hidden")).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/hidden from every student/i));
  });

  it("does nothing when the superadmin cancels the confirmation", async () => {
    confirm.mockResolvedValue(false);
    render(<MerchantNavyPanel triggerToast={toast} />);
    await screen.findByText(/Active — students can see it/);

    fireEvent.click(screen.getByRole("switch", { name: /merchant navy section/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());

    expect(put).not.toHaveBeenCalled();
    expect(screen.getByText(/Active — students can see it/)).toBeTruthy();
  });

  it("activating needs no confirmation, sends an explicit on, and warns first if no exam is open", async () => {
    get.mockResolvedValue(listing({ enabled: false, content: [{ key: "master_fg", name: "Master (FG)", live: false, sets: 10, questions: 0 }] }));
    put.mockResolvedValue({ module: { ...MODULE, enabled: true }, changed: true, history: [] });
    render(<MerchantNavyPanel triggerToast={toast} />);
    await screen.findByText(/Inactive — hidden from every student/);

    fireEvent.click(screen.getByRole("switch", { name: /merchant navy section/i }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/platform-modules/merchant_navy", { enabled: true }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/no exam is open/i) }));
  });

  it("says plainly when the server refuses, and leaves the switch where it was", async () => {
    put.mockRejectedValue(new ApiError("Too many attempts. Wait a minute.", 429));
    render(<MerchantNavyPanel triggerToast={toast} />);
    await screen.findByText(/Active — students can see it/);

    fireEvent.click(screen.getByRole("switch", { name: /merchant navy section/i }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Too many attempts. Wait a minute.", "error"));
    expect(screen.getByText(/Active — students can see it/)).toBeTruthy();
    expect((screen.getByRole("switch", { name: /merchant navy section/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers a retry when it cannot load", async () => {
    get.mockRejectedValueOnce(new ApiError("Server Error", 500));
    render(<MerchantNavyPanel triggerToast={toast} />);

    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));
    expect(await screen.findByText(/Active — students can see it/)).toBeTruthy();
  });
});

describe("live: a switch reaches an open student screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetPlanSyncForTests();
  });
  afterEach(() => {
    __resetPlanSyncForTests();
    vi.useRealTimers();
  });

  const signal = (modules: Record<string, boolean>, sig: string) => ({ signature: "plan", modules, modules_signature: sig, source: "individual", plan: null, days_remaining: null });

  it("fires one event, carrying what changed, and never reads as a plan change", async () => {
    const events: ModulesChangedDetail[] = [];
    const listener = (e: Event) => events.push((e as CustomEvent<ModulesChangedDetail>).detail);
    window.addEventListener(MODULES_CHANGED_EVENT, listener);

    get.mockResolvedValue(signal({ merchant_navy: true }, "on"));
    const stop = startPlanSync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(0);

    get.mockResolvedValue(signal({ merchant_navy: false }, "off"));
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);
    await vi.advanceTimersByTimeAsync(PLAN_SYNC_POLL_MS);

    expect(events).toEqual([{ modules: { merchant_navy: false }, previous: { merchant_navy: true } }]);
    stop();
    window.removeEventListener(MODULES_CHANGED_EVENT, listener);
  });

  it("the open Mock AI Interview page asks the server for the catalogue again", async () => {
    vi.useRealTimers();
    get.mockReset().mockResolvedValue({ roles: [], stats: { total_roles: 0, total_stacks: 0, live_stacks: 0, total_questions: 0 }, min_questions: 5 });
    render(<MerchantNavyPanelHost />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new CustomEvent(MODULES_CHANGED_EVENT, { detail: { modules: { merchant_navy: false }, previous: { merchant_navy: true } } }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenLastCalledWith("/mock-interviews/catalog");
  });
});

function MerchantNavyPanelHost() {
  return <MockInterviewExplorer />;
}
