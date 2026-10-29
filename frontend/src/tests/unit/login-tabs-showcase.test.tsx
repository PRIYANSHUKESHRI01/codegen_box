import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const push = vi.fn();
const login = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: vi.fn(), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/login" }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ login }) }));
vi.mock("@/lib/usePublicPlatformData", () => ({ usePublicStats: () => ({ problems_total: 2005, languages_total: 19, problems_easy: 0, problems_medium: 0, problems_hard: 0, topics_total: 0, test_cases_total: 0 }) }));
vi.mock("@/lib/sessionEvents", () => ({ takeSignedOutNotice: () => null }));
vi.mock("@/components/auth/AuthChrome", () => ({ AuthChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/auth/ForgotPasswordModal", () => ({ ForgotPasswordModal: () => null }));
vi.mock("@/components/auth/ForcePasswordResetModal", () => ({ ForcePasswordResetModal: () => null }));

import { ApiError } from "@/lib/api";
import LoginPage from "@/app/login/page";

beforeEach(() => {
  post.mockReset();
  push.mockReset();
  login.mockReset();
});
afterEach(cleanup);

describe("sign-in tabs", () => {
  it("offers Student and College TPO only — Hiring Partner is switched off for now", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /Student/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /College TPO/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Hiring Partner/ })).toBeNull();
  });

  it("tells people who signed up on Mellow Vault that the same email and password work here — on every tab", async () => {
    render(<LoginPage />);
    expect(screen.getByText("Already on Mellow Vault?")).toBeTruthy();
    expect(screen.getByText(/same email and password you use there/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /College TPO/ }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("total clarity"));
    expect(screen.getByText("Already on Mellow Vault?")).toBeTruthy();
  });

  it("starts on Student, and the left side says what is for students", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("placement-ready");
    expect(screen.getByText("Candidate Arena")).toBeTruthy();
    expect(screen.getByText("AI mock interviews")).toBeTruthy();
    // the platform's own live numbers, not invented ones
    expect(screen.getByText("2,005")).toBeTruthy();
    expect(screen.getByText("19")).toBeTruthy();
  });

  it("swaps the left side to the placement cell's message when College TPO is chosen, in place", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /College TPO/ }));

    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("total clarity"));
    expect(screen.getByText("Placement Console")).toBeTruthy();
    expect(screen.getByText("Bulk roster onboarding")).toBeTruthy();
    expect(screen.queryByText("AI mock interviews")).toBeNull();

    // and back again
    fireEvent.click(screen.getByRole("button", { name: /Student/ }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("placement-ready"));
  });

  it("still signs in through the chosen tab", async () => {
    post.mockResolvedValue({ token: "t", user: { id: 1, role: "admin_tpo" } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /College TPO/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enter Placement Console/ }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe("/login");
    expect((post.mock.calls[0][1] as { portal: string }).portal).toBe("admin_tpo");
    await waitFor(() => expect(login).toHaveBeenCalled());
  });

  it("does not send a hiring partner looking for a tab that is not there", async () => {
    post.mockRejectedValue(new ApiError("This is a Hiring Partner account. Choose the Hiring Partner tab to sign in.", 403));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /Launch Candidate Arena/ }));

    expect(await screen.findByText(/Hiring Partner sign-in isn't available on this page right now/)).toBeTruthy();
    expect(screen.queryByText(/Choose the Hiring Partner tab/)).toBeNull();
  });

  it("keeps an ordinary wrong-tab message about a tab that IS offered", async () => {
    post.mockRejectedValue(new ApiError("This is a College TPO account. Choose the College TPO tab to sign in.", 403));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /Launch Candidate Arena/ }));
    expect(await screen.findByText(/Choose the College TPO tab to sign in/)).toBeTruthy();
  });
});
