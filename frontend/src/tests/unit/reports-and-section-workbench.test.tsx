import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoordinatorInsights, CoordinatorStudent } from "@/types/coordinator";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const getFile = vi.fn();
const confirm = vi.fn();
const prompt = vi.fn();
let role = "admin_tpo";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), put: (p: string, b?: unknown) => put(p, b), patch: vi.fn(), delete: vi.fn(), getFile: (p: string) => getFile(p) } };
});
vi.mock("@/lib/dialogs", () => ({ confirmDialog: (o: unknown) => confirm(o), promptDialog: (o: unknown) => prompt(o) }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: { role, name: "Tester" }, status: "ready", refresh: vi.fn() }) }));

import { StudentReportPanel } from "@/components/reports/StudentReportPanel";
import { SectionLeaders, SectionTrendCard } from "@/components/coordinator/SectionInsights";
import { FollowUpBoard, SectionEvents } from "@/components/coordinator/SectionWorkbench";
import { StudentManagePanel } from "@/components/dashboard/tpo/StudentManagePanel";
import { reportBase, studentReportPaths } from "@/lib/reportDocuments";
import { canStartNow, scheduleNote } from "@/lib/interviewSchedule";

const REPORT = { id: "01HXREPORT0000000000000001", kind: "student_report", title: "Asha — student report", filename: "asha.pdf", audience: "staff", size_bytes: 40960, pages: 3, summary: { readiness: 64 }, student: null, interview: null, generated_by: { name: "Rhea", role: "admin_tpo" }, downloads: 0, last_downloaded_at: null, created_at: "2026-11-04T05:00:00Z" };

beforeEach(() => {
  role = "admin_tpo";
  [get, post, put, getFile, confirm, prompt].forEach((m) => m.mockReset());
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  // A download clicks a hidden link; jsdom cannot navigate, and the test only cares that the file was fetched.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => cleanup());

describe("report paths", () => {
  it("point each role at its own prefix, and a student at their own report", () => {
    expect(reportBase("admin_tpo")).toBe("/tpo");
    expect(reportBase("section_coordinator")).toBe("/coordinator");
    expect(reportBase("superadmin")).toBe("/admin");
    expect(reportBase("user")).toBe("/me");

    expect(studentReportPaths("admin_tpo", 7)).toMatchObject({ generate: "/tpo/students/7/reports", list: "/tpo/students/7/reports" });
    expect(studentReportPaths("admin_tpo", 7).download("ABC")).toBe("/tpo/reports/ABC/download");
    expect(studentReportPaths("user")).toMatchObject({ generate: "/me/report", list: "/me/reports" });
  });
});

describe("interview schedule helpers", () => {
  it("says what the window means to a student and who may start", () => {
    expect(scheduleNote({ schedule_state: "unscheduled", opens_at: null, closes_at: null })).toBeNull();
    expect(scheduleNote({ schedule_state: "upcoming", opens_at: "2026-11-10T05:00:00Z", closes_at: null })?.text).toMatch(/^Opens /);
    expect(scheduleNote({ schedule_state: "closed", opens_at: null, closes_at: "2026-11-01T05:00:00Z" })?.tone).toBe("danger");

    expect(canStartNow({ schedule_state: "upcoming", my_session_status: null })).toBe(false);
    expect(canStartNow({ schedule_state: "closed", my_session_status: null })).toBe(false);
    expect(canStartNow({ schedule_state: "closed", my_session_status: "in_progress" })).toBe(true);
    expect(canStartNow({ schedule_state: "open", my_session_status: null })).toBe(true);
  });
});

describe("StudentReportPanel", () => {
  it("makes the report on the server, downloads the stored file and lists it in the history", async () => {
    post.mockResolvedValueOnce({ report: REPORT });
    getFile.mockResolvedValue(new Blob(["%PDF-"], { type: "application/pdf" }));
    get.mockResolvedValueOnce({ reports: [REPORT] });

    render(<StudentReportPanel studentId={7} studentName="Asha" />);

    fireEvent.click(screen.getByRole("button", { name: /download full report/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/students/7/reports", undefined));
    await waitFor(() => expect(getFile).toHaveBeenCalledWith(`/tpo/reports/${REPORT.id}/download`));

    fireEvent.click(screen.getByRole("button", { name: /earlier reports/i }));
    expect(await screen.findByText(/readiness 64/)).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/tpo/students/7/reports");

    fireEvent.click(screen.getByRole("button", { name: /download the report made/i }));
    await waitFor(() => expect(getFile).toHaveBeenCalledTimes(2));
  });

  it("uses the student's own endpoints on their own page", async () => {
    role = "user";
    post.mockResolvedValueOnce({ report: { ...REPORT, audience: "student" } });
    getFile.mockResolvedValue(new Blob(["x"]));

    render(<StudentReportPanel />);
    fireEvent.click(screen.getByRole("button", { name: /download full report/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/me/report", undefined));
    await waitFor(() => expect(getFile).toHaveBeenCalledWith(`/me/reports/${REPORT.id}/download`));
  });
});

const INSIGHTS: CoordinatorInsights = {
  generated_at: "2026-11-04T05:00:00Z",
  trend: {
    points: Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(20 + i).padStart(2, "0")}`, average: 40 + i * 2, active: i, tracked: 12 })),
    change_7d: 6,
    change_28d: null,
  },
  movers: { improved: [{ student_id: 1, name: "Ravi", roll_number: "R1", from: 30, to: 52, change: 22 }], slipped: [{ student_id: 2, name: "Meera", roll_number: "R2", from: 60, to: 44, change: -16 }] },
  follow_ups: [],
  events: [],
  college: { average: 48, students: 300 },
};

const student = (id: number, name: string, readiness: number, blocked = false) => ({ id, name, readiness_score: readiness, is_blocked: blocked }) as unknown as CoordinatorStudent;

describe("section trend and leaders", () => {
  it("draws the trend, the vault line and where the section stands against the college", () => {
    render(<SectionTrendCard insights={INSIGHTS} currentAverage={58} />);

    expect(screen.getByRole("img", { name: /average readiness over 10 days, now 58/i })).toBeTruthy();
    expect(screen.getByText("Vault line 60")).toBeTruthy();
    expect(screen.getByText(/ahead of the college average/i)).toBeTruthy();
    expect(screen.getByText("+6")).toBeTruthy();
  });

  it("says so, instead of drawing nothing, when there is no history yet", () => {
    render(<SectionTrendCard insights={{ ...INSIGHTS, trend: { points: [], change_7d: null, change_28d: null } }} currentAverage={30} />);
    expect(screen.getByText(/appears once your students have a few days of history/i)).toBeTruthy();
  });

  it("lists the five best (blocked students excluded) and who gained or slipped", () => {
    const onOpen = vi.fn();
    const students = [student(1, "Ravi", 90), student(2, "Meera", 80), student(3, "Kabir", 70), student(4, "Isha", 60), student(5, "Zoya", 50), student(6, "Nik", 40), student(7, "Blocked Bo", 99, true)];

    render(<SectionLeaders students={students} insights={INSIGHTS} onOpen={onOpen} />);

    const leaders = screen.getByText("Leading the section").closest(".p-5") as HTMLElement;
    expect(within(leaders).queryByText("Blocked Bo")).toBeNull();
    expect(within(leaders).queryByText("Nik")).toBeNull();

    fireEvent.click(within(leaders).getByText("Ravi"));
    expect(onOpen).toHaveBeenCalledWith(1);

    expect(screen.getByText("(+22)")).toBeTruthy();
    expect(screen.getByText("(-16)")).toBeTruthy();
  });
});

describe("FollowUpBoard", () => {
  const items = [
    { id: 1, student: { id: 10, name: "Ravi", roll_number: null }, kind: "call", body: "Call about attendance", follow_up_on: "2026-11-01", status: "overdue", author: "You", created_at: null },
    { id: 2, student: { id: 11, name: "Meera", roll_number: null }, kind: "note", body: "Check project", follow_up_on: null, status: "no_date", author: "You", created_at: null },
  ] as never;

  it("groups by urgency and marks one done without a reload", async () => {
    put.mockResolvedValue({});
    const onChanged = vi.fn();

    render(<FollowUpBoard items={items} onOpen={vi.fn()} onChanged={onChanged} />);

    expect(screen.getByText("Overdue")).toBeTruthy();
    expect(screen.getByText("Call about attendance")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /done/i })[0]);
    await waitFor(() => expect(put).toHaveBeenCalledWith("/coordinator/notes/1", { resolved: true }));
    await waitFor(() => expect(screen.queryByText("Call about attendance")).toBeNull());
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByText("Check project")).toBeTruthy();
  });

  it("celebrates an empty list", () => {
    render(<FollowUpBoard items={[]} onOpen={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText("All caught up")).toBeTruthy();
  });
});

describe("SectionEvents", () => {
  const event = { id: 5, title: "DBMS mock", slug: "dbms-mock", schedule_state: "open", opens_at: "2026-11-03T05:00:00Z", closes_at: "2026-11-06T05:00:00Z", in_section: 10, completed: 4, in_progress: 1, not_started: 5, average_score: 71, not_started_students: [{ id: 21, name: "Isha", roll_number: null }, { id: 22, name: "Zoya", roll_number: null }] } as never;

  it("shows progress and reminds only those who have not started, after a confirmation", async () => {
    confirm.mockResolvedValue(true);
    post.mockResolvedValue({});

    render(<SectionEvents events={[event]} loading={false} onOpen={vi.fn()} />);

    expect(screen.getByText("4 of 10 done")).toBeTruthy();
    expect(screen.getByText(/71% average/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /remind 2 students/i }));
    await waitFor(() => expect(post).toHaveBeenCalled());

    const [path, body] = post.mock.calls[0];
    expect(path).toBe("/coordinator/students/bulk-notify");
    expect(body).toMatchObject({ student_ids: [21, 22], channel: "in_app" });
    expect(String(body.title)).toContain("DBMS mock");
  });

  it("sends nothing when the coordinator declines", async () => {
    confirm.mockResolvedValue(false);
    render(<SectionEvents events={[event]} loading={false} onOpen={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /remind 2 students/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(post).not.toHaveBeenCalled();
  });

  it("explains an empty section", () => {
    render(<SectionEvents events={[]} loading={false} onOpen={vi.fn()} />);
    expect(screen.getByText("Nothing scheduled for your section")).toBeTruthy();
  });
});

describe("StudentManagePanel", () => {
  const manage = {
    account: { id: 7, email: "asha@example.com", activated: true, created_at: null, last_seen_at: "2026-11-03T05:00:00Z", sessions: 2, is_blocked: false, blocked: null },
    plan: { name: "Free", covered_by_college: false, ends_at: null },
    vault_ai: [],
    can_remove: false,
    remove_blocker: "This student has signed in, so the account is part of your records and cannot be deleted. Block it instead.",
    history: [],
  };
  const row = { id: 7, name: "Asha Verma", email: "asha@example.com" } as never;

  it("loads the account when opened and never shows a password, only why it cannot be removed", async () => {
    get.mockResolvedValue(manage);
    render(<StudentManagePanel student={row} />);

    fireEvent.click(screen.getByRole("button", { name: /manage account/i }));
    expect(await screen.findByText(/has signed in, so the account is part of your records/i)).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/tpo/students/7/manage");
    expect(screen.queryByText(/password/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /remove this account/i })).toBeNull();
  });

  it("blocks with a reason and hands the refreshed row back", async () => {
    get.mockResolvedValue(manage);
    prompt.mockResolvedValue("Left the college");
    post.mockResolvedValue({ student: { id: 7, name: "Asha Verma", is_blocked: true }, message: "Asha Verma is blocked and signed out." });
    const onChanged = vi.fn();

    render(<StudentManagePanel student={row} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /manage account/i }));
    await screen.findByRole("button", { name: /block account/i });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /block account/i }));
    });

    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/students/7/block", { reason: "Left the college" }));
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ is_blocked: true }));
  });

  it("does not send a new login unless the TPO confirms", async () => {
    get.mockResolvedValue(manage);
    confirm.mockResolvedValue(false);

    render(<StudentManagePanel student={row} />);
    fireEvent.click(screen.getByRole("button", { name: /manage account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /send a new login/i }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(post).not.toHaveBeenCalled();
  });
});
