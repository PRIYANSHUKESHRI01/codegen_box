import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/auth";
import { StudentOnboardingGate } from "@/components/onboarding/StudentOnboardingGate";
import { StudentOnboardingModal } from "@/components/onboarding/StudentOnboardingModal";
import { CodingPreferencesSection } from "@/components/settings/CodingPreferencesSection";

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

const STUDENT = {
  id: 7,
  name: "Priya Nair",
  email: "priya@college.edu",
  role: "user",
  onboarding_pending: true,
  primary_language: null,
  preferred_languages: null,
  skill_level: null,
  career_goal: null,
  focus_areas: null,
  weekly_pace: null,
} as unknown as AuthUser;

const SAVED_USER = {
  ...STUDENT,
  onboarding_pending: false,
  primary_language: "python",
  preferred_languages: ["python", "java"],
  skill_level: "intermediate",
  career_goal: "campus_placement",
  focus_areas: ["problem_solving"],
  weekly_pace: "steady",
} as unknown as AuthUser;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("aptrun_token", "token-123");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
const next = () => fireEvent.click(screen.getByRole("button", { name: /continue/i }));

function mountModal() {
  const onDone = vi.fn();
  const onSkip = vi.fn();
  render(
    <AuthProvider>
      <StudentOnboardingModal onDone={onDone} onSkip={onSkip} />
    </AuthProvider>
  );
  return { onDone, onSkip };
}

describe("the first-login wizard", () => {
  beforeEach(() => {
    window.localStorage.setItem("aptrun_user", JSON.stringify(STUDENT));
    get.mockResolvedValue({ user: STUDENT });
  });

  it("will not move on until a main language is chosen", () => {
    mountModal();

    const continueButton = screen.getByRole("button", { name: /continue/i }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(radio("Python3"));
    expect(continueButton.disabled).toBe(false);
  });

  it("needs a level and a goal before the last step", () => {
    mountModal();
    fireEvent.click(radio("Python3"));
    next();

    const continueButton = screen.getByRole("button", { name: /continue/i }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(radio(/comfortable/i));
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(radio(/campus placement/i));
    expect(continueButton.disabled).toBe(false);
  });

  it("saves every answer in one request and reports done", async () => {
    post.mockResolvedValue({ user: SAVED_USER });
    const { onDone } = mountModal();

    fireEvent.click(radio("Python3"));
    fireEvent.click(screen.getByRole("button", { name: "Java" })); // also comfortable with
    next();
    fireEvent.click(radio(/comfortable/i));
    fireEvent.click(radio(/campus placement/i));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Problem solving" }));
    fireEvent.click(radio(/intense/i));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/me/onboarding", {
      primary_language: "python",
      preferred_languages: ["java"],
      skill_level: "intermediate",
      career_goal: "campus_placement",
      focus_areas: ["problem_solving"],
      weekly_pace: "intense",
    });
  });

  it("takes a language out of the 'also' list when it is made the main one", async () => {
    post.mockResolvedValue({ user: SAVED_USER });
    mountModal();

    fireEvent.click(radio("Python3"));
    fireEvent.click(screen.getByRole("button", { name: "Java" }));
    fireEvent.click(radio("Java")); // now Java is the main language
    next();
    fireEvent.click(radio(/comfortable/i));
    fireEvent.click(radio(/campus placement/i));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = post.mock.calls[0][1] as { primary_language: string; preferred_languages: string[] };
    expect(body.primary_language).toBe("java");
    expect(body.preferred_languages).not.toContain("java");
  });

  it("shows the server's reason and keeps the answers when saving fails", async () => {
    post.mockRejectedValue(new ApiError("The selected primary language is invalid.", 422));
    const { onDone } = mountModal();

    fireEvent.click(radio("Python3"));
    next();
    fireEvent.click(radio(/comfortable/i));
    fireEvent.click(radio(/campus placement/i));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect((await screen.findByRole("alert")).textContent).toContain("primary language is invalid");
    expect(onDone).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Finish" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("can be skipped from any step, and goes back without losing answers", () => {
    const { onSkip } = mountModal();

    fireEvent.click(radio("Python3"));
    next();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(radio("Python3").getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("caps the 'also comfortable with' list so it stays a preference", () => {
    mountModal();
    fireEvent.click(radio("Python3"));

    const group = screen.getByRole("group", { name: /other languages you know/i });
    const chips = within(group).getAllByRole("button");
    chips.slice(0, 5).forEach((chip) => fireEvent.click(chip));

    expect(screen.getByText(/5\/5 selected/)).toBeTruthy();
    const unselected = within(group).getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "false");
    expect(unselected.length).toBeGreaterThan(0);
    unselected.forEach((chip) => expect((chip as HTMLButtonElement).disabled).toBe(true));
  });
});

describe("the gate that decides whether to ask", () => {
  function mountGate(user: AuthUser) {
    window.localStorage.setItem("aptrun_user", JSON.stringify(user));
    get.mockResolvedValue({ user });
    return render(
      <AuthProvider>
        <StudentOnboardingGate />
      </AuthProvider>
    );
  }

  it("asks a student the server says still owes the questions — after a short settle", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mountGate(STUDENT);

    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/which language do you code in most/i)).toBeTruthy();
  });

  it("stays quiet for a student who already answered", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mountGate(SAVED_USER);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays quiet for anyone who isn't a student", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mountGate({ ...STUDENT, role: "admin_tpo", onboarding_pending: true } as unknown as AuthUser);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("remembers a skip on the server and closes straight away — even if that call fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    post.mockRejectedValue(new TypeError("Failed to fetch"));
    mountGate(STUDENT);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.click(await screen.findByRole("button", { name: /skip for now/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(post).toHaveBeenCalledWith("/me/onboarding/skip", undefined);
  });
});

describe("Settings → Coding preferences", () => {
  const renderSection = (user: AuthUser) => {
    window.localStorage.setItem("aptrun_user", JSON.stringify(user));
    get.mockResolvedValue({ user });
    const toast = vi.fn();
    render(
      <AuthProvider>
        <CodingPreferencesSection user={user} onToast={toast} />
      </AuthProvider>
    );
    return toast;
  };

  it("shows what is saved, and only enables Save once something changes", () => {
    renderSection(SAVED_USER);

    expect(radio("Python3").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button", { name: /save coding preferences/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(radio(/intense/i));
    expect((screen.getByRole("button", { name: /save coding preferences/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("saves through the preferences endpoint and confirms", async () => {
    put.mockResolvedValue({ user: { ...SAVED_USER, weekly_pace: "intense" } });
    const toast = renderSection(SAVED_USER);

    fireEvent.click(radio(/intense/i));
    fireEvent.click(screen.getByRole("button", { name: /save coding preferences/i }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Coding preferences saved."));
    expect(put).toHaveBeenCalledWith("/me/preferences", expect.objectContaining({ primary_language: "python", weekly_pace: "intense", preferred_languages: ["java"] }));
  });

  it("picks up newer saved answers when it hasn't been edited — a stale cache never shows old answers", () => {
    const stale = { ...STUDENT, primary_language: null, weekly_pace: null } as unknown as AuthUser;
    window.localStorage.setItem("aptrun_user", JSON.stringify(stale));
    get.mockResolvedValue({ user: stale });
    const { rerender } = render(
      <AuthProvider>
        <CodingPreferencesSection user={stale} onToast={vi.fn()} />
      </AuthProvider>
    );
    expect(radio(/steady/i).getAttribute("aria-checked")).toBe("true"); // the default while nothing is saved

    rerender(
      <AuthProvider>
        <CodingPreferencesSection user={SAVED_USER} onToast={vi.fn()} />
      </AuthProvider>
    );

    expect(radio("Python3").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("button", { name: /save coding preferences/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("leaves the student's own edits alone when newer saved answers arrive", () => {
    const stale = { ...STUDENT, primary_language: null, weekly_pace: null } as unknown as AuthUser;
    window.localStorage.setItem("aptrun_user", JSON.stringify(stale));
    get.mockResolvedValue({ user: stale });
    const { rerender } = render(
      <AuthProvider>
        <CodingPreferencesSection user={stale} onToast={vi.fn()} />
      </AuthProvider>
    );

    fireEvent.click(radio("Java")); // started editing

    rerender(
      <AuthProvider>
        <CodingPreferencesSection user={SAVED_USER} onToast={vi.fn()} />
      </AuthProvider>
    );

    expect(radio("Java").getAttribute("aria-checked")).toBe("true");
    expect(radio("Python3").getAttribute("aria-checked")).toBe("false");
  });

  it("explains a refusal instead of failing silently", async () => {
    put.mockRejectedValue(new ApiError("The selected skill level is invalid.", 422));
    renderSection(SAVED_USER);

    fireEvent.click(radio(/intense/i));
    fireEvent.click(screen.getByRole("button", { name: /save coding preferences/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("skill level is invalid");
  });
});
