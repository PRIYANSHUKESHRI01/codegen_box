import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePostLoginRoute } from "@/lib/auth";
import { useAuthGuard } from "@/lib/useAuthGuard";

const post = vi.fn();
const push = vi.fn();
const replace = vi.fn();
const loginFn = vi.fn();
let mockAuthStatus: "loading" | "ready" | "signed_out" = "signed_out";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: vi.fn(), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() },
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/login",
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: null, status: mockAuthStatus, login: loginFn }),
}));
vi.mock("@/lib/usePublicPlatformData", () => ({
  usePublicStats: () => ({
    problems_total: 2005,
    languages_total: 19,
    problems_easy: 0,
    problems_medium: 0,
    problems_hard: 0,
    topics_total: 0,
    test_cases_total: 0,
  }),
}));
vi.mock("@/lib/sessionEvents", () => ({ takeSignedOutNotice: () => null }));
vi.mock("@/components/auth/AuthChrome", () => ({
  AuthChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/auth/ForgotPasswordModal", () => ({ ForgotPasswordModal: () => null }));
vi.mock("@/components/auth/ForcePasswordResetModal", () => ({ ForcePasswordResetModal: () => null }));

import LoginPage from "@/app/login/page";

function GuardHarness() {
  useAuthGuard(["user"]);
  return <div>Guarded</div>;
}

beforeEach(() => {
  post.mockReset();
  push.mockReset();
  replace.mockReset();
  loginFn.mockReset();
  mockAuthStatus = "signed_out";
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Email interview deep-link login redirect", () => {
  it("resolvePostLoginRoute allows student interview deep-links and blocks open redirects or admin paths", () => {
    expect(resolvePostLoginRoute("user", "/dashboard/vault-interviews?stack=react_nextjs")).toBe(
      "/dashboard/vault-interviews?stack=react_nextjs"
    );
    expect(resolvePostLoginRoute("user", "https://evil.example/steal")).toBe("/dashboard");
    expect(resolvePostLoginRoute("user", "//evil.example/steal")).toBe("/dashboard");
    expect(resolvePostLoginRoute("user", "/superadmin")).toBe("/dashboard");
    expect(resolvePostLoginRoute("user", null)).toBe("/dashboard");
  });

  it("useAuthGuard preserves /dashboard/vault-interviews?stack=react_nextjs in ?redirect= when signed out", async () => {
    mockAuthStatus = "signed_out";
    window.history.replaceState({}, "", "/dashboard/vault-interviews?stack=react_nextjs");
    render(<GuardHarness />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/login?redirect=%2Fdashboard%2Fvault-interviews%3Fstack%3Dreact_nextjs"
      )
    );
  });

  it("LoginPage launches the requested interview URL after login instead of Student Overview", async () => {
    window.history.replaceState(
      {},
      "",
      "/login?redirect=%2Fdashboard%2Fvault-interviews%3Fstack%3Dreact_nextjs"
    );
    post.mockResolvedValue({
      token: "tok-1",
      user: { id: 9, name: "Priyanshu", email: "priyanshu@mellowvault.com", role: "user" },
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /Launch Candidate Arena/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/dashboard/vault-interviews?stack=react_nextjs")
    );
  });
});
