import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { StudentsPanel } from "@/components/admin/superadmin/StudentsPanel";
import { resetBranchCatalog } from "@/lib/branches";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const toast = vi.fn();

const student = (id: number, name: string, department: string | null = "engineering") => ({
  id,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@apex.test`,
  handle: null,
  role: "user",
  is_blocked: false,
  department,
  branch: "CSE",
  created_at: "2026-10-01T00:00:00Z",
  college: { id: 1, name: "Apex Institute" },
  subscription: null,
  subscription_plan_name: null,
  readiness_tier: "In Progress",
});

const ALL = [student(1, "Asha Rao"), student(2, "Bala Iyer"), student(3, "Meera Shah", "management")];

const CATALOG = {
  disciplines: [],
  branches: [],
  departments: [
    { code: "engineering", name: "Engineering & Technology", short_name: "Engineering" },
    { code: "management", name: "Management", short_name: "Management" },
    { code: "commerce", name: "Commerce", short_name: "Commerce" },
  ],
};

const FACETS = {
  roles: { user: 3 },
  departments: { engineering: 2, management: 1 },
  colleges: [
    { id: 1, name: "Apex Institute", short_code: "APEX", city: "Pune", accounts: 3 },
    { id: 2, name: "Beta College", short_code: "BETA", city: null, accounts: 0 },
  ],
  without_college: 0,
};

const page = (rows: unknown[], total = rows.length) => ({ data: rows, current_page: 1, last_page: 1, total });

const usersCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/users?"));
const facetCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/users/facets"));

function answerWith(users: (path: string) => unknown) {
  get.mockImplementation((path: string) => {
    if (path.startsWith("/public/branches")) return Promise.resolve(CATALOG);
    if (path.startsWith("/superadmin/users/facets")) return Promise.resolve(FACETS);
    if (path.startsWith("/superadmin/users?")) return users(path);
    return Promise.resolve({});
  });
}

beforeEach(() => {
  get.mockReset();
  toast.mockReset();
  resetBranchCatalog();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Students tab — loading", () => {
  it("shows a placeholder (not '0 student(s)') while the first answer is on its way, then the students", async () => {
    let release!: (v: unknown) => void;
    answerWith(() => new Promise((resolve) => (release = resolve)));
    render(<StudentsPanel triggerToast={toast} />);

    expect(screen.getByRole("status", { name: "Loading students" })).toBeTruthy();
    expect(screen.getByText("Loading students…")).toBeTruthy();
    expect(screen.queryByText(/0 student/)).toBeNull();

    await act(async () => release(page(ALL, 3)));

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("3 student(s) enrolled via a partner college.")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading students" })).toBeNull();
  });

  it("explains a slow first load instead of leaving it looking hung", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    answerWith(() => new Promise(() => undefined));
    render(<StudentsPanel triggerToast={toast} />);

    expect(screen.queryByText(/Still working/)).toBeNull();
    await act(async () => void vi.advanceTimersByTime(4100));
    expect(screen.getByText(/Still working — this is taking longer than usual/)).toBeTruthy();
  });

  it("says why a failed first load failed, and recovers on Try again", async () => {
    let fail = true;
    answerWith(() => (fail ? Promise.reject(new ApiError("The server hit a snag.", 500)) : Promise.resolve(page(ALL))));
    render(<StudentsPanel triggerToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toContain("The server hit a snag.");
    expect(screen.queryByText("No students found.")).toBeNull();
    expect(toast).toHaveBeenCalledWith("The server hit a snag.", "error");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the rows on screen (dimmed, 'Updating…') while a new filter loads, instead of blanking the table", async () => {
    let releaseSecond!: (v: unknown) => void;
    let calls = 0;
    answerWith(() => (++calls === 1 ? Promise.resolve(page(ALL)) : new Promise((resolve) => (releaseSecond = resolve))));
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.change(screen.getByLabelText("Filter by department"), { target: { value: "management" } });

    expect(await screen.findByText(/Updating…/)).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByRole("table").closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
    // …and the count line does not claim the old rows "match this filter" before the new answer is in.
    expect(screen.getByText(/enrolled via a partner college/)).toBeTruthy();

    await act(async () => releaseSecond(page([ALL[2]])));
    await waitFor(() => expect(screen.queryByText("Asha Rao")).toBeNull());
    expect(screen.getByText("1 student(s) match this filter.")).toBeTruthy();
  });

  it("ignores a late answer to an old filter — the newest filter always wins", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    answerWith((path) => new Promise((resolve) => (pending[new URL(path, "http://x").searchParams.get("department") ?? ""] = resolve)));
    render(<StudentsPanel triggerToast={toast} />);
    await waitFor(() => expect(pending[""]).toBeTruthy());
    await act(async () => pending[""](page(ALL)));
    await screen.findByText("Asha Rao");

    fireEvent.change(screen.getByLabelText("Filter by department"), { target: { value: "engineering" } });
    await waitFor(() => expect(pending["engineering"]).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Filter by department"), { target: { value: "management" } });
    await waitFor(() => expect(pending["management"]).toBeTruthy());

    await act(async () => pending["management"](page([ALL[2]])));
    await screen.findByText("1 student(s) match this filter.");
    await act(async () => pending["engineering"](page([ALL[0], ALL[1]])));

    expect(screen.getByText("Meera Shah")).toBeTruthy();
    expect(screen.queryByText("Asha Rao")).toBeNull();
    expect(screen.getByText("1 student(s) match this filter.")).toBeTruthy();
  });
});

describe("Students tab — filters", () => {
  beforeEach(() => answerWith((path) => Promise.resolve(path.includes("department=management") ? page([ALL[2]]) : page(ALL))));

  it("shows how many students each department has, from the server's counts", async () => {
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    await waitFor(() => {
      const labels = within(screen.getByLabelText("Filter by department")).getAllByRole("option").map((o) => o.textContent);
      expect(labels).toEqual(["All departments", "Engineering & Technology (2)", "Management (1)", "Commerce (0)"]);
    });
  });

  it("asks the list and the counts the same question, so a count is what choosing it shows", async () => {
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.change(screen.getByLabelText("Filter by department"), { target: { value: "management" } });
    await screen.findByText("1 student(s) match this filter.");

    expect(usersCalls().at(-1)).toContain("department=management");
    expect(usersCalls().at(-1)).toContain("has_college=1");
    // The university counts are narrowed to the chosen department; the department counts are not narrowed by it.
    expect(facetCalls().at(-1)).toContain("department=management");
    expect(facetCalls().at(-1)).toContain("has_college=1");
  });

  it("narrows by university through the picker and shows that university's count", async () => {
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.click(screen.getByRole("combobox", { name: "Filter by university" }));
    const apex = await screen.findByRole("option", { name: /Apex Institute/ });
    expect(apex.textContent).toContain("3");
    fireEvent.click(within(apex).getByRole("button"));

    await waitFor(() => expect(usersCalls().at(-1)).toContain("college_id=1"));
    await waitFor(() => expect(facetCalls().at(-1)).toContain("college_id=1"));
  });

  it("searches after a short pause, not on every keystroke", async () => {
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");
    const before = usersCalls().length;

    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "m" } });
    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "me" } });
    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "mee" } });

    await waitFor(() => expect(usersCalls().length).toBe(before + 1), { timeout: 2000 });
    expect(usersCalls().at(-1)).toContain("search=mee");
  });

  it("says when nothing matches, and Clear filters puts every control back", async () => {
    answerWith((path) => Promise.resolve(path.includes("department=") ? page([]) : page(ALL)));
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("Asha Rao");

    fireEvent.change(screen.getByLabelText("Filter by department"), { target: { value: "commerce" } });
    expect(await screen.findByText("No students match this filter.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect((screen.getByLabelText("Filter by department") as HTMLSelectElement).value).toBe("");
    expect(usersCalls().at(-1)).not.toContain("department=");
  });

  it("appends the next page on Load more, and shows how far through the list it is", async () => {
    const first = Array.from({ length: 3 }, (_, i) => student(100 + i, `First${i} Person`));
    const second = [student(200, "Last Person")];
    answerWith((path) =>
      Promise.resolve(path.includes("page=2") ? { data: second, current_page: 2, last_page: 2, total: 4 } : { data: first, current_page: 1, last_page: 2, total: 4 })
    );
    render(<StudentsPanel triggerToast={toast} />);
    await screen.findByText("First0 Person");
    expect(screen.getByText("Showing 3 of 4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Last Person")).toBeTruthy();
    expect(screen.getByText("First0 Person")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
