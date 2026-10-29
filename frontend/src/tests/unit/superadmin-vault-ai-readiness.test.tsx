import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedUserResponse } from "@/types/adminSubscriptions";
import type { ReadinessDetailResponse } from "@/types/superadminReadiness";
import type { VaultAiQualificationRow, VaultAiStudentResponse } from "@/types/superadminVaultAi";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      put: (path: string, body?: unknown) => put(path, body),
      delete: (path: string, body?: unknown) => del(path, body),
    },
  };
});

import { ReadinessEditModal } from "@/components/admin/superadmin/ReadinessEditModal";
import { OverviewSection, type StudentDetail } from "@/components/admin/superadmin/manage/OverviewSection";
import { VaultAiSection } from "@/components/admin/superadmin/manage/VaultAiSection";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";

const toast = vi.fn();
const reload = vi.fn(async () => {});

const qual = (over: Partial<VaultAiQualificationRow> & { id: number }): VaultAiQualificationRow => ({
  user: { id: 41, name: "Student 1", email: "s1@example.com", college: "Tulas University" },
  stack_key: "laravel",
  stack_name: "Laravel (PHP)",
  role_name: "Backend",
  status: "cooling_down",
  is_blocked: true,
  cooldown_over: false,
  current_attempt: 3,
  max_attempts: 3,
  failed_attempts: 3,
  series_scores: {},
  series_average: null,
  cooldown_until: "2026-12-01T00:00:00Z",
  cooldown_days_remaining: 33,
  qualified_at: null,
  qualified_by_admin: false,
  updated_at: "2026-10-29T00:00:00Z",
  attempt_history: [],
  admin_log: [],
  ...over,
});

const STACKS = [
  { key: "laravel", name: "Laravel (PHP)", role: "Backend", live: true },
  { key: "nodejs", name: "Node.js", role: "Backend", live: true },
];

const studentPayload = (rows: VaultAiQualificationRow[], over: Partial<VaultAiStudentResponse> = {}): VaultAiStudentResponse => ({
  student: { id: 41, name: "Student 1", email: "s1@example.com", college: "Tulas University", study_year: 4, is_blocked: false, vault_ai_score: null },
  gate: { state: "open", audience: "direct", year_label: null, reasons: [], required_days: null, days_remaining: null, readiness: null },
  readiness: { score: 42, tier: "In Progress", overridden: false },
  vault: null,
  qualifications: rows,
  stacks: STACKS,
  ...over,
});

const attempt = (index: number, mark: number) => ({
  index,
  attempt: index + 1,
  series_number: index + 1,
  scores: { "1": mark, "2": mark, "3": mark },
  average: mark,
  evaluated_at: "2026-10-10T00:00:00Z",
  passed: false,
  this_cycle: true,
});

const mountSection = (payload: VaultAiStudentResponse) => {
  get.mockResolvedValue(payload);
  return render(<VaultAiSection userId={41} reload={reload} triggerToast={toast} />);
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
  toast.mockReset();
  reload.mockClear();
});
afterEach(cleanup);

describe("Manage drawer → Vault AI", () => {
  it("shows a blocked student's gate, days left and failed attempts", async () => {
    mountSection(studentPayload([qual({ id: 1, attempt_history: [attempt(0, 40), attempt(1, 50), attempt(2, 30)] })]));

    expect(await screen.findByText(/Failed all 3 series/)).toBeTruthy();
    expect(screen.getByText(/Blocked · 33d left/)).toBeTruthy();
    expect(screen.getAllByText(/Attempt [123]$/)).toHaveLength(3);
    expect(screen.getByText(/independent student/i)).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/superadmin/vault-ai/students/41");
  });

  it("gives a blocked student access again, with a reason, and refreshes the drawer", async () => {
    const blocked = qual({ id: 1, attempt_history: [attempt(0, 40)] });
    const fresh = { ...blocked, status: "in_progress" as const, is_blocked: false, current_attempt: 1, failed_attempts: 0, cooldown_until: null, cooldown_days_remaining: 0 };
    mountSection(studentPayload([blocked]));
    post.mockResolvedValue(studentPayload([fresh]));

    fireEvent.click(await screen.findByRole("button", { name: "Give access again" }));

    const dialog = await screen.findByRole("dialog", { name: /Give 3 fresh attempts/ });
    const submit = within(dialog).getByRole("button", { name: "Give attempts" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "AI scoring was down" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/vault-ai/students/41/stacks/laravel/reset", { reason: "AI scoring was down" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Student 1 has all 3 Laravel (PHP) attempts again."));
    expect(reload).toHaveBeenCalled();
    // the section now shows the fresh state
    expect(await screen.findByText(/of 3/)).toBeTruthy();
    expect(screen.queryByText(/Failed all 3 series/)).toBeNull();
  });

  it("says what the marks will do before they are saved", async () => {
    const sitting = qual({ id: 1, status: "in_progress", is_blocked: false, current_attempt: 3, failed_attempts: 2, cooldown_until: null, cooldown_days_remaining: 0, series_scores: { "1": 40 }, attempt_history: [attempt(0, 40), attempt(1, 50)] });
    mountSection(studentPayload([sitting]));
    put.mockResolvedValue(studentPayload([sitting]));

    fireEvent.click(await screen.findByRole("button", { name: "Enter marks" }));

    const dialog = await screen.findByRole("dialog", { name: /Enter marks/ });
    fireEvent.change(within(dialog).getByLabelText("Set 2 %"), { target: { value: "30" } });
    fireEvent.change(within(dialog).getByLabelText("Set 3 %"), { target: { value: "20" } });

    // 40 / 30 / 20 on the LAST series: the 45-day block.
    expect(within(dialog).getByTestId("marks-consequence").textContent).toMatch(/blocked for 45 days/);

    fireEvent.change(within(dialog).getByLabelText("Set 2 %"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Set 3 %"), { target: { value: "80" } });
    expect(within(dialog).getByTestId("marks-consequence").textContent).toMatch(/qualifies and is added to the Vault/);

    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Paper test marks" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save marks" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/vault-ai/students/41/stacks/laravel/scores", { scores: { "1": 40, "2": 90, "3": 80 }, reason: "Paper test marks" }));
  });

  it("corrects a past attempt by its position in the history", async () => {
    const blocked = qual({ id: 1, attempt_history: [attempt(0, 40), attempt(1, 50), attempt(2, 30)] });
    mountSection(studentPayload([blocked]));
    put.mockResolvedValue(studentPayload([blocked]));

    fireEvent.click(await screen.findByRole("button", { name: "Correct attempt 3 of Laravel (PHP)" }));

    const dialog = await screen.findByRole("dialog", { name: /Correct attempt 3/ });
    fireEvent.change(within(dialog).getByLabelText("Set 1 %"), { target: { value: "100" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Set 1 was mis-scored" } });
    expect(within(dialog).getByTestId("marks-consequence").textContent).toMatch(/still under 60%/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save marks" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/superadmin/vault-ai/students/41/stacks/laravel/scores", { scores: { "1": 100, "2": 30, "3": 30 }, reason: "Set 1 was mis-scored", attempt_index: 2 })
    );
  });

  it("will not save marks that would drop a qualified student under the line", async () => {
    const qualified = qual({ id: 1, status: "qualified", is_blocked: false, series_scores: { "1": 70, "2": 70, "3": 70 }, series_average: 70, qualified_at: "2026-10-20T00:00:00Z", cooldown_until: null, cooldown_days_remaining: 0, failed_attempts: 0 });
    mountSection(studentPayload([qualified]));

    fireEvent.click(await screen.findByRole("button", { name: "Edit marks" }));

    const dialog = await screen.findByRole("dialog", { name: /Enter marks/ });
    fireEvent.change(within(dialog).getByLabelText("Set 1 %"), { target: { value: "10" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Test" } });

    expect(within(dialog).getByTestId("marks-consequence").textContent).toMatch(/under 60%/);
    expect((within(dialog).getByRole("button", { name: "Save marks" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("marks a student qualified only at or above the pass mark", async () => {
    const blocked = qual({ id: 1 });
    mountSection(studentPayload([blocked]));
    post.mockResolvedValue(studentPayload([{ ...blocked, status: "qualified", is_blocked: false, series_average: 72, qualified_by_admin: true }]));

    fireEvent.click(await screen.findByRole("button", { name: "Mark qualified" }));

    const dialog = await screen.findByRole("dialog", { name: /Mark qualified/ });
    const average = within(dialog).getByLabelText(/Series average/);
    const submit = within(dialog).getByRole("button", { name: "Mark qualified" }) as HTMLButtonElement;
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Cleared the offline round" } });

    fireEvent.change(average, { target: { value: "55" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(average, { target: { value: "72" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/vault-ai/students/41/stacks/laravel/qualify", { average: 72, reason: "Cleared the offline round" }));
  });

  it("offers to open the interview for a student who is locked at the gate", async () => {
    const gate = { state: "locked" as const, audience: "college" as const, year_label: "4th year", reasons: ["waiting_period", "readiness"], required_days: 45, days_remaining: 12, readiness: { score: 40, required: 60, met: false, points_needed: 20 } };
    mountSection(studentPayload([], { gate }));
    post.mockResolvedValue(studentPayload([], { gate: { ...gate, state: "open", reasons: [] } }));

    expect(await screen.findByText(/Waiting period: 12 of 45 days still to go/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Open it now/ }));

    const dialog = await screen.findByRole("dialog", { name: /Open the interview now/ });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Drive next week" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Open it" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/vault-ai/students/41/unlock-access", { reason: "Drive next week" }));
  });

  it("does not offer 'open it now' when the lock is not about waiting (year not set)", async () => {
    const gate = { state: "locked" as const, audience: "college" as const, year_label: null, reasons: ["year_not_set"], required_days: null, days_remaining: null, readiness: null };
    mountSection(studentPayload([], { gate }));

    expect(await screen.findByText(/has not said which year/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open it now/ })).toBeNull();
  });
});

const detail = (over: Partial<ReadinessDetailResponse> = {}): ReadinessDetailResponse => ({
  student: { id: 1, name: "Student 1", email: "s1@example.com", college: "Tulas University", study_year: 4 },
  score: 42,
  tier: "In Progress",
  calculated_score: 42,
  calculated_tier: "In Progress",
  vault: { threshold: 60, qualifies: false, points_needed: 18 },
  components: [{ key: "ai_interview", label: "AI interviews", score: 50, weight: 20, contribution: 10 }],
  missed_day_penalty: 0,
  override: null,
  history: [],
  ...over,
});

describe("Manage drawer → readiness score", () => {
  const changed = vi.fn();
  const close = vi.fn();

  beforeEach(() => {
    changed.mockReset();
    close.mockReset();
  });

  it("sets a score with a reason", async () => {
    get.mockResolvedValue(detail());
    put.mockResolvedValue(detail({ score: 75 }));

    render(<ReadinessEditModal studentId={1} onClose={close} onChanged={changed} />);

    const dialog = await screen.findByRole("dialog", { name: /Readiness score/ });
    const input = await within(dialog).findByLabelText("Set the score to");
    const submit = within(dialog).getByRole("button", { name: "Set score" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // no reason yet

    fireEvent.change(input, { target: { value: "75" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Cleared the offline round" } });
    expect(within(dialog).getByText(/meets the Vault line \(60\)/)).toBeTruthy();
    fireEvent.click(submit);

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/readiness/1", { score: 75, reason: "Cleared the offline round" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith("Student 1's readiness score is now 75."));
  });

  it("refuses a score outside 0-100", async () => {
    get.mockResolvedValue(detail());

    render(<ReadinessEditModal studentId={1} onClose={close} onChanged={changed} />);
    const dialog = await screen.findByRole("dialog", { name: /Readiness score/ });

    fireEvent.change(await within(dialog).findByLabelText("Set the score to"), { target: { value: "101" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Too generous" } });

    expect((within(dialog).getByRole("button", { name: "Set score" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText("Enter a whole number from 0 to 100.")).toBeTruthy();
  });

  it("hands a student back to their calculated score", async () => {
    get.mockResolvedValue(detail({ score: 80, override: { score: 80, reason: "College request", set_by: "Admin One", set_at: "2026-10-28T00:00:00Z", expires_at: null, in_force: true } }));
    del.mockResolvedValue(detail({ score: 42 }));

    render(<ReadinessEditModal studentId={1} onClose={close} onChanged={changed} />);
    const dialog = await screen.findByRole("dialog", { name: /Readiness score/ });

    expect(await within(dialog).findByText(/Set to/)).toBeTruthy();
    const clear = within(dialog).getByRole("button", { name: "Use the calculated score" }) as HTMLButtonElement;
    expect(clear.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Request withdrawn" } });
    fireEvent.click(clear);

    await waitFor(() => expect(del).toHaveBeenCalledWith("/superadmin/readiness/1", { reason: "Request withdrawn" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith("Student 1 is back on their calculated score: 42."));
  });

  const manage = { user: { id: 7, role: "user", name: "Student 7", college: null }, capabilities: { edit: false } } as unknown as ManagedUserResponse;
  const studentDetail = (overridden: boolean): StudentDetail => ({
    user: { readiness_score: 76, readiness_tier: "Placement Ready", readiness_overridden: overridden },
    stats: { solved_by_difficulty: { total_solved: 11 }, solved_score: 380, streak: { current: 0, max: 0 } },
  });

  it("the Overview readiness card has a Set score button that opens the editor and refreshes the drawer", async () => {
    get.mockResolvedValue(detail({ student: { id: 7, name: "Student 7", email: "s7@example.com", college: null, study_year: null } }));
    put.mockResolvedValue(detail({ score: 70 }));

    render(<OverviewSection data={manage} reload={reload} triggerToast={toast} detail={studentDetail(false)} />);

    expect(screen.queryByText("Set by hand")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Set score/ }));

    const dialog = await screen.findByRole("dialog", { name: /Readiness score/ });
    fireEvent.change(await within(dialog).findByLabelText("Set the score to"), { target: { value: "70" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Offline round" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Set score" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/readiness/7", { score: 70, reason: "Offline round" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith("Student 7's readiness score is now 70.");
  });

  it("the Overview readiness card says when the score was set by hand", () => {
    render(<OverviewSection data={manage} reload={reload} triggerToast={toast} detail={studentDetail(true)} />);
    expect(screen.getByText("Set by hand")).toBeTruthy();
  });
});

describe("Student side of a hand-set readiness score", () => {
  const components = [{ key: "ai_interview", label: "AI interviews", score: 50, weight_percent: 20, contribution: 10, detail: "" }];

  it("says plainly that the AptRun team set the score, and what activity alone adds up to - without a reason", () => {
    render(
      <ReadinessBreakdown
        components={components}
        nextSteps={[]}
        override={{ active: true, score: 72, calculated_score: 31, calculated_tier: "Needs Training", set_at: "2026-10-28T00:00:00Z", expires_at: null }}
      />
    );

    const note = screen.getByTestId("override-note");
    expect(note.textContent).toContain("Your score of 72 was set by the AptRun team");
    expect(note.textContent).toContain("adds up to 31");
  });

  it("shows no note when nothing was set by hand", () => {
    render(<ReadinessBreakdown components={components} nextSteps={[]} />);
    expect(screen.queryByTestId("override-note")).toBeNull();
  });
});
