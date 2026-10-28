import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/auth";
import { resetBranchCatalog, type BranchCatalog } from "@/lib/branches";
import { resetDepartmentScopeMemory } from "@/lib/departments";
import { BranchFields, initialBranchAnswers, type BranchAnswers } from "@/components/onboarding/BranchFields";
import { DepartmentScopeBar, resetDepartmentCounts } from "@/components/branches/DepartmentScopeBar";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const NO_CODING = { coding_practice: false, contests: false, company_prep: false, project_lab: false, hackathons: false, skill_drills: false, domain_prep: true };

const CATALOG: BranchCatalog = {
  departments: [
    { code: "engineering", name: "Engineering & Technology", short: "Engineering", icon: "cpu", accent: "indigo", capabilities: {} },
    { code: "management", name: "Management & Business Administration", short: "Management", icon: "briefcase", accent: "violet", capabilities: NO_CODING },
    { code: "commerce", name: "Commerce & Accounting", short: "Commerce", icon: "calculator", accent: "emerald", capabilities: NO_CODING },
    { code: "arts", name: "Arts, Humanities & Social Sciences", short: "Arts & Humanities", icon: "landmark", accent: "rose", capabilities: NO_CODING },
  ],
  disciplines: [
    { code: "cse", name: "Computer Science & IT", short: "CSE / IT", department: "engineering" },
    { code: "mba", name: "MBA · PGDM", short: "MBA", department: "management" },
    { code: "bcom", name: "Bachelor of Commerce", short: "B.Com", department: "commerce" },
    { code: "mcom", name: "Master of Commerce", short: "M.Com", department: "commerce" },
    { code: "lang_lit", name: "Languages & Literature", short: "Lang & Lit", department: "arts" },
  ],
  branches: [
    { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
    { code: "mba_finance", discipline: "mba", name: "MBA (Finance)", short: "MBA-Fin" },
    { code: "bcom", discipline: "bcom", name: "B.Com (General)", short: "B.Com" },
    { code: "bcom_hons", discipline: "bcom", name: "B.Com (Honours)", short: "B.Com Hons" },
    { code: "mcom", discipline: "mcom", name: "M.Com (General)", short: "M.Com" },
    { code: "english", discipline: "lang_lit", name: "BA English", short: "English" },
  ],
  aliases: {},
};

const baseUser = {
  id: 7,
  name: "Asha Rao",
  email: "asha@college.edu",
  role: "user",
  branch: null,
  branch_code: null,
  discipline: null,
  branch_source: null,
  track_focus: null,
  core_interests: null,
};

const asUser = (over: Record<string, unknown> = {}) => ({ ...baseUser, ...over }) as unknown as AuthUser;

function Harness({ user, onValue }: { user: AuthUser; onValue?: (v: BranchAnswers) => void }) {
  const [value, setValue] = useState<BranchAnswers>(initialBranchAnswers(user));
  return (
    <BranchFields
      user={user}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
}

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((path: string) => (path.startsWith("/public/branches") ? Promise.resolve(CATALOG) : Promise.resolve({})));
  resetBranchCatalog();
  resetDepartmentScopeMemory();
  resetDepartmentCounts();
  window.localStorage.clear();
});

afterEach(cleanup);

describe("choosing a branch across departments", () => {
  it("asks an independent student for their department first, and only then shows that department's programmes", async () => {
    render(<Harness user={asUser()} />);

    const departments = await screen.findByRole("radiogroup", { name: "Department" });
    expect(within(departments).getAllByRole("radio")).toHaveLength(4);
    expect(screen.queryByRole("radiogroup", { name: "Branch" })).toBeNull();

    fireEvent.click(within(departments).getByRole("radio", { name: /Commerce/ }));

    // The department's branches are listed straight away — no family step in between.
    const branches = await screen.findByRole("radiogroup", { name: "Branch" });
    expect(within(branches).getAllByRole("radio").map((r) => r.textContent)).toEqual(["B.Com (General)", "B.Com (Honours)", "M.Com (General)"]);
    expect(screen.queryByRole("radio", { name: /MBA/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Computer Science/ })).toBeNull();
  });

  it("hands back the branch picked inside the chosen department", async () => {
    const seen: BranchAnswers[] = [];
    render(<Harness user={asUser()} onValue={(v) => seen.push(v)} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Commerce/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Honours/ }));

    expect(seen.at(-1)?.branchCode).toBe("bcom_hons");
  });

  it("forgets a branch picked in one department when the student moves to another", async () => {
    const seen: BranchAnswers[] = [];
    render(<Harness user={asUser()} onValue={(v) => seen.push(v)} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Commerce/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /B\.Com \(General\)/ }));
    expect(seen.at(-1)?.branchCode).toBe("bcom");

    fireEvent.click(screen.getByRole("radio", { name: /Management/ }));

    expect(seen.at(-1)?.branchCode).toBeNull();
    expect(screen.queryByRole("radio", { name: /B\.Com \(General\)/ })).toBeNull();
  });

  it("does not ask a student whose college runs one department to choose it", async () => {
    render(<Harness user={asUser({ college_id: 3, college: { id: 3, name: "Tulas", departments: ["commerce"] } })} />);

    expect(await screen.findByRole("radiogroup", { name: "Branch" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Department" })).toBeNull();
    expect(screen.queryByRole("radio", { name: /MBA/ })).toBeNull();
  });

  it("offers a college's student only the departments the college runs", async () => {
    render(<Harness user={asUser({ college_id: 3, college: { id: 3, name: "Tulas", departments: ["engineering", "arts"] } })} />);

    const departments = await screen.findByRole("radiogroup", { name: "Department" });
    expect(within(departments).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Engineering & Technology", "Arts, Humanities & Social Sciences"]);
  });

  it("does not ask a student whose roster was imported under a department", async () => {
    render(<Harness user={asUser({ college_id: 3, department: "arts", college: { id: 3, name: "Tulas", departments: ["engineering", "arts"] } })} />);

    const branches = await screen.findByRole("radiogroup", { name: "Branch" });
    expect(within(branches).getAllByRole("radio").map((r) => r.textContent)).toEqual(["BA English"]);
    expect(screen.queryByRole("radiogroup", { name: "Department" })).toBeNull();
  });

  it("shows the branches of an older catalogue that predates departments", async () => {
    get.mockImplementation((path: string) =>
      path.startsWith("/public/branches")
        ? Promise.resolve({ disciplines: [{ code: "cse", name: "Computer Science & IT", short: "CSE / IT" }], branches: [{ code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" }] })
        : Promise.resolve({})
    );
    render(<Harness user={asUser()} />);

    expect(await screen.findByRole("radio", { name: /Computer Science & Engineering/ })).toBeTruthy();
  });
});

describe("the TPO's department switcher", () => {
  const mount = (departments: string[], home = false) => {
    const user = asUser({ role: "admin_tpo", college_id: 3, college: { id: 3, name: "Tulas", departments } });
    window.localStorage.setItem("aptrun_token", "token-123");
    window.localStorage.setItem("aptrun_user", JSON.stringify(user));
    get.mockImplementation((path: string) => {
      if (path.startsWith("/public/branches")) return Promise.resolve(CATALOG);
      if (path === "/tpo/departments") {
        const counts: Record<string, number> = { engineering: 40, commerce: 25, arts: 10 };
        return Promise.resolve({
          departments: CATALOG.departments!.map((d) => ({ ...d, enabled: departments.includes(d.code), students: counts[d.code] ?? 0 })),
          enabled: departments,
        });
      }
      return Promise.resolve({ user });
    });
    render(
      <AuthProvider>
        <DepartmentScopeBar home={home} />
      </AuthProvider>
    );
  };

  it("renders nothing for a college that runs one department — there is nothing to switch between", async () => {
    mount(["engineering"]);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId("department-scope-bar")).toBeNull();
  });

  it("on the dashboard home, a one-department college is told what else it could switch on", async () => {
    mount(["engineering"], true);

    const invite = await screen.findByTestId("department-invite");
    expect(invite.textContent).toMatch(/Engineering only/);
    expect(invite.textContent).toMatch(/Management, Commerce, Arts & Humanities/);
    expect(screen.queryByTestId("department-scope-bar")).toBeNull();
  });

  it("the invitation opens the department manager right there, with every department to tick", async () => {
    mount(["engineering"], true);

    fireEvent.click(within(await screen.findByTestId("department-invite")).getByRole("button", { name: /Add departments/ }));

    expect(await screen.findByText("Departments you run")).toBeTruthy();
    for (const name of [/Engineering & Technology/, /Management/, /Commerce/, /Arts/]) {
      expect(await screen.findByRole("checkbox", { name })).toBeTruthy();
    }
    expect((await screen.findByRole("checkbox", { name: /Engineering & Technology/ })).getAttribute("aria-checked")).toBe("true");
    expect((await screen.findByRole("checkbox", { name: /Commerce/ })).getAttribute("aria-checked")).toBe("false");
  });

  it("a college that already runs several gets a Manage button on the bar", async () => {
    mount(["engineering", "commerce"], true);

    const bar = await screen.findByTestId("department-scope-bar");
    fireEvent.click(within(bar).getByRole("button", { name: /Manage/ }));

    const title = await screen.findByText("Departments you run");
    expect(screen.queryByTestId("department-invite")).toBeNull();
    // The bar is blurred, and a blurred ancestor clips `position: fixed` children to itself — so the dialog must live outside it.
    expect(title.closest('[data-testid="department-scope-bar"]')).toBeNull();
    expect(bar.contains(title)).toBe(false);
  });

  it("offers All plus exactly the departments the college runs, with their student counts", async () => {
    mount(["engineering", "commerce"]);

    const bar = await screen.findByTestId("department-scope-bar");
    const labels = within(bar).getAllByRole("button").map((b) => b.textContent);

    expect(labels[0]).toMatch(/^All departments/);
    expect(labels.slice(1, -1).map((l) => l?.replace(/\d+/g, ""))).toEqual(["Engineering", "Commerce"]);
    expect(labels.at(-1)).toMatch(/Manage/);
    await waitFor(() => expect(within(bar).getByRole("button", { name: /Commerce/ }).textContent).toContain("25"));
    expect(within(bar).queryByRole("button", { name: /Management/ })).toBeNull();
  });

  it("starts on All, moves to the chosen department and remembers it for the college", async () => {
    mount(["engineering", "commerce"]);

    const bar = await screen.findByTestId("department-scope-bar");
    expect(within(bar).getByRole("button", { name: /All departments/ }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(bar).getByRole("button", { name: /Commerce/ }));

    expect(within(bar).getByRole("button", { name: /Commerce/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(bar).getByRole("button", { name: /All departments/ }).getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("aptrun:dept-scope:3")).toBe("commerce");
  });

  it("drops a remembered department the college no longer runs", async () => {
    window.localStorage.setItem("aptrun:dept-scope:3", "management");
    mount(["engineering", "commerce"]);

    const bar = await screen.findByTestId("department-scope-bar");

    await waitFor(() => expect(within(bar).getByRole("button", { name: /All departments/ }).getAttribute("aria-pressed")).toBe("true"));
  });
});
