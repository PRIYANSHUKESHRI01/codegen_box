import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/auth";
import { resetBranchCatalog, type BranchCatalog } from "@/lib/branches";
import { StudentOnboardingGate } from "@/components/onboarding/StudentOnboardingGate";
import { StudentOnboardingModal } from "@/components/onboarding/StudentOnboardingModal";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      put: (path: string, body?: unknown) => put(path, body),
    },
  };
});

const CATALOG = (live: string[] = []): BranchCatalog => ({
  disciplines: [
    { code: "cse", name: "Computer Science & IT", short: "CSE / IT", is_live: live.includes("cse") },
    { code: "ece", name: "Electronics & Communication", short: "ECE", is_live: live.includes("ece") },
    { code: "mech", name: "Mechanical", short: "Mech", is_live: live.includes("mech") },
  ],
  branches: [
    { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
    { code: "ece", discipline: "ece", name: "Electronics & Communication Engineering", short: "ECE" },
    { code: "mech", discipline: "mech", name: "Mechanical Engineering", short: "Mech" },
  ],
  aliases: {},
});

const base = {
  id: 9,
  name: "Asha Rao",
  email: "asha@college.edu",
  role: "user",
  onboarding_pending: true,
  branch_pending: false,
  branch: null,
  branch_code: null,
  discipline: null,
  branch_source: null,
  track_focus: null,
  primary_language: null,
  preferred_languages: null,
  skill_level: null,
  career_goal: null,
  focus_areas: null,
  weekly_pace: null,
};

const asUser = (over: Record<string, unknown>) => ({ ...base, ...over }) as unknown as AuthUser;

function setCatalog(live: string[] = []) {
  get.mockImplementation((path: string) => (path.startsWith("/public/branches") ? Promise.resolve(CATALOG(live)) : Promise.resolve({ user: JSON.parse(window.localStorage.getItem("aptrun_user") ?? "{}") })));
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  resetBranchCatalog();
  window.localStorage.clear();
  window.localStorage.setItem("aptrun_token", "token-123");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = (user: AuthUser, live: string[] = []) => {
  window.localStorage.setItem("aptrun_user", JSON.stringify(user));
  setCatalog(live);
  const onDone = vi.fn();
  const onSkip = vi.fn();
  render(
    <AuthProvider>
      <StudentOnboardingModal onDone={onDone} onSkip={onSkip} />
    </AuthProvider>
  );
  return { onDone, onSkip };
};

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
const next = () => fireEvent.click(screen.getByRole("button", { name: /continue/i }));
const continueButton = () => screen.getByRole("button", { name: /continue/i }) as HTMLButtonElement;

describe("wizard without a branch question", () => {
  it("is exactly the three steps it always was for a student whose college branch is known", () => {
    mount(asUser({ branch_pending: false, branch: "CSE", branch_code: "cse", discipline: "cse", branch_source: "college" }));

    expect(screen.getByText(/Step 1 of 3/)).toBeTruthy();
    expect(screen.getByText(/Which language do you code in most/)).toBeTruthy();
  });
});

describe("wizard with the branch step", () => {
  it("asks first, lists the branches straight away, and will not continue until one is picked", async () => {
    mount(asUser({ branch_pending: true }));

    expect(await screen.findByText(/Step 1 of 4/)).toBeTruthy();
    expect(continueButton().disabled).toBe(true);

    // no family step: every branch of the department is there to pick
    expect(await screen.findByRole("radio", { name: /Computer Science & Engineering/ })).toBeTruthy();
    expect(radio(/Electronics & Communication Engineering/)).toBeTruthy();
    expect(continueButton().disabled).toBe(true);

    fireEvent.click(radio(/Mechanical Engineering/));
    expect(continueButton().disabled).toBe(false);
  });

  it("shows a branch the college gave us read-only, and does not ask for it again", async () => {
    mount(asUser({ branch_pending: true, branch: "E&TC", branch_code: "ece", discipline: "ece", branch_source: "college" }), ["ece"]);

    expect(await screen.findByText(/from your college/i)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /Computer Science/ })).toBeNull();
    // Core Prep is live for ECE, so what to lead with IS asked, and is required
    expect(await screen.findByRole("radio", { name: /Core first/ })).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("does not ask what to lead with before Core Prep is live", async () => {
    mount(asUser({ branch_pending: true, branch: "E&TC", branch_code: "ece", discipline: "ece", branch_source: "college" }));

    await screen.findByText(/from your college/i);
    expect(screen.queryByRole("radio", { name: /Core first/ })).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it("asks what to lead with when only the student's own college is a Core Prep pilot", async () => {
    // ECE is not live for everyone (empty live list), but the server says Core Prep is enabled for this student.
    mount(asUser({ branch_pending: true, core_enabled: true, branch: "E&TC", branch_code: "ece", discipline: "ece", branch_source: "college" }));

    expect(await screen.findByRole("radio", { name: /Core first/ })).toBeTruthy();
    expect(continueButton().disabled).toBe(true);
  });

  it("does not let a pilot flag leak to a different branch family", async () => {
    mount(asUser({ branch_pending: true, core_enabled: true, branch: "Mechanical", branch_code: "mech", discipline: "ece", branch_source: "college" }));

    await screen.findByText(/from your college/i);
    expect(screen.queryByRole("radio", { name: /Core first/ })).toBeNull();
  });

  it("lets a core-first student finish without a programming language, and sends no language", async () => {
    const saved = asUser({ onboarding_pending: false, track_focus: "core_first" });
    post.mockResolvedValue({ user: saved });
    const { onDone } = mount(asUser({ branch_pending: true, branch: "Mechanical", branch_code: "mech", discipline: "mech", branch_source: "college" }), ["mech"]);

    fireEvent.click(await screen.findByRole("radio", { name: /Core first/ }));
    next();

    // language step: "I don't code yet" is on offer and is enough
    expect(continueButton().disabled).toBe(true);
    fireEvent.click(await screen.findByRole("checkbox", { name: /I don't code yet/ }));
    expect(continueButton().disabled).toBe(false);
    next();

    fireEvent.click(radio(/Just starting/));
    fireEvent.click(radio(/Core company/));
    next();
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [path, body] = post.mock.calls[0];
    expect(path).toBe("/me/onboarding");
    expect(body).toMatchObject({ track_focus: "core_first", skill_level: "beginner", career_goal: "core_company" });
    expect(body).not.toHaveProperty("primary_language");
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});

describe("a branch that is not on the list", () => {
  const ownBranch = () => screen.getByRole("button", { name: /My branch isn.t listed/ });
  const writeBranch = (text: string) => fireEvent.change(screen.getByPlaceholderText(/Biomedical Engineering/), { target: { value: text } });

  it("offers every listed branch AND a way to write your own", async () => {
    mount(asUser({ branch_pending: true }));

    expect(await screen.findByRole("radio", { name: /Mechanical Engineering/ })).toBeTruthy();
    expect(ownBranch().getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByPlaceholderText(/Biomedical Engineering/)).toBeNull();
  });

  it("needs something written before it will continue, and then hides the listed branches", async () => {
    mount(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("radio", { name: /Mechanical Engineering/ }));
    expect(continueButton().disabled).toBe(false);

    // switching to "my branch isn't listed" drops the pick — it is one or the other
    fireEvent.click(ownBranch());
    expect(ownBranch().getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("radio", { name: /Mechanical Engineering/ })).toBeNull();
    expect(continueButton().disabled).toBe(true);

    writeBranch("B");
    expect(continueButton().disabled).toBe(true);
    writeBranch("Biomedical Engineering");
    expect(continueButton().disabled).toBe(false);
  });

  it("goes back to the list when they change their mind", async () => {
    mount(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("button", { name: /My branch isn.t listed/ }));
    writeBranch("Biomedical Engineering");

    fireEvent.click(ownBranch()); // tap it again to leave "write my own"
    expect(screen.queryByPlaceholderText(/Biomedical Engineering/)).toBeNull();
    expect(continueButton().disabled).toBe(true);
    fireEvent.click(radio(/Electronics & Communication Engineering/));
    expect(continueButton().disabled).toBe(false);
  });

  it("starts from the label the college gave us when we could not read it", async () => {
    mount(asUser({ branch_pending: true, branch: "Mech-A (Day)", branch_code: null, branch_source: "college" }));

    fireEvent.click(await screen.findByRole("button", { name: /My branch isn.t listed/ }));

    expect((screen.getByPlaceholderText(/Biomedical Engineering/) as HTMLInputElement).value).toBe("Mech-A (Day)");
    expect(continueButton().disabled).toBe(false);
  });

  it("sends what they wrote — not a branch code — when the wizard finishes", async () => {
    post.mockResolvedValue({ user: asUser({ onboarding_pending: false, branch: "Biomedical Engineering", branch_source: "self" }) });
    mount(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("button", { name: /My branch isn.t listed/ }));
    writeBranch("  Biomedical   Engineering ");
    next();

    fireEvent.click(await screen.findByRole("radio", { name: /Python/ }));
    next();
    fireEvent.click(radio(/Just starting/));
    fireEvent.click(radio(/Campus placement/));
    next();
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [path, body] = post.mock.calls[0];
    expect(path).toBe("/me/onboarding");
    expect(body).toMatchObject({ branch_label: "Biomedical Engineering", primary_language: "python" });
    expect(body).not.toHaveProperty("branch_code");
  });
});

describe("what follows the department they choose", () => {
  const NO_CODING = { coding_practice: false, contests: false, company_prep: false, project_lab: false, hackathons: false, skill_drills: false, domain_prep: true };
  const DEPT_CATALOG: BranchCatalog = {
    departments: [
      { code: "engineering", name: "Engineering & Technology", short: "Engineering", icon: "cpu", accent: "indigo", capabilities: {} },
      { code: "commerce", name: "Commerce & Accounting", short: "Commerce", icon: "calculator", accent: "emerald", capabilities: NO_CODING },
    ],
    disciplines: [
      { code: "cse", name: "Computer Science & IT", short: "CSE / IT", department: "engineering" },
      { code: "bcom", name: "Bachelor of Commerce", short: "B.Com", department: "commerce" },
    ],
    branches: [
      { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
      { code: "bcom", discipline: "bcom", name: "B.Com (General)", short: "B.Com" },
    ],
    aliases: {},
  };
  const mountWithDepartments = (user: AuthUser) => {
    window.localStorage.setItem("aptrun_user", JSON.stringify(user));
    get.mockImplementation((path: string) => (path.startsWith("/public/branches") ? Promise.resolve(DEPT_CATALOG) : Promise.resolve({ user })));
    render(
      <AuthProvider>
        <StudentOnboardingModal onDone={vi.fn()} onSkip={vi.fn()} />
      </AuthProvider>
    );
  };

  it("asks the department first, then lists only that department's branches", async () => {
    mountWithDepartments(asUser({ branch_pending: true }));

    const departments = await screen.findByRole("radiogroup", { name: "Department" });
    expect(screen.queryByRole("radiogroup", { name: "Branch" })).toBeNull();

    fireEvent.click(within(departments).getByRole("radio", { name: /Engineering/ }));
    expect(radio(/Computer Science & Engineering/)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /B\.Com/ })).toBeNull();
  });

  it("a commerce student's journey has no programming-language step", async () => {
    mountWithDepartments(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("radio", { name: /Commerce/ }));
    fireEvent.click(radio(/B\.Com \(General\)/));
    next();

    // the language step is skipped: About you comes straight after the branch, and the wizard is three steps long
    expect(await screen.findByText(/Step 2 of 3/)).toBeTruthy();
    expect(screen.queryByText(/Which language do you code in most/)).toBeNull();
  });

  it("the same holds when a commerce student writes their own branch", async () => {
    mountWithDepartments(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("radio", { name: /Commerce/ }));
    fireEvent.click(screen.getByRole("button", { name: /My branch isn.t listed/ }));
    fireEvent.change(screen.getByPlaceholderText(/Biomedical Engineering/), { target: { value: "Banking Studies" } });
    next();

    expect(await screen.findByText(/Step 2 of 3/)).toBeTruthy();
  });

  it("an engineering student still gets the language step", async () => {
    mountWithDepartments(asUser({ branch_pending: true }));

    fireEvent.click(await screen.findByRole("radio", { name: /Engineering/ }));
    fireEvent.click(radio(/Computer Science & Engineering/));
    next();

    expect(await screen.findByText(/Step 2 of 4/)).toBeTruthy();
    expect(screen.getByText(/Which language do you code in most/)).toBeTruthy();
  });
});

describe("the gate", () => {
  const mountGate = (user: AuthUser) => {
    vi.useFakeTimers();
    window.localStorage.setItem("aptrun_user", JSON.stringify(user));
    setCatalog();
    render(
      <AuthProvider>
        <StudentOnboardingGate />
      </AuthProvider>
    );
  };

  it("asks only the branch question of a student who already finished onboarding", async () => {
    mountGate(asUser({ onboarding_pending: false, branch_pending: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    vi.useRealTimers();

    expect((await screen.findAllByText(/Which branch are you in\?/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Let's set up your practice/)).toBeNull();
  });

  it("shows the wizard, not two dialogs, when both are owed", async () => {
    mountGate(asUser({ onboarding_pending: true, branch_pending: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    vi.useRealTimers();

    expect(await screen.findByText(/Let's set up your practice/)).toBeTruthy();
    expect(screen.queryByText(/Ask me later/)).toBeNull();
  });

  it("asks nothing of a student with nothing owed", async () => {
    mountGate(asUser({ onboarding_pending: false, branch_pending: false, branch_code: "cse" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
