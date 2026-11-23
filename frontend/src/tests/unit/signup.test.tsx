import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const push = vi.fn();
const login = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: vi.fn(), post: (p: string, b?: unknown) => post(p, b), put: vi.fn(), delete: vi.fn() } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/signup" }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ login }) }));
vi.mock("@/lib/usePublicPlatformData", () => ({ usePublicStats: () => ({ problems_total: 2005, languages_total: 19, problems_easy: 0, problems_medium: 0, problems_hard: 0, topics_total: 0, test_cases_total: 0 }) }));
vi.mock("@/components/auth/AuthChrome", () => ({ AuthChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/marketing-site/TalkToTeamModal", () => ({ TalkToTeamModal: () => null }));

import SignupPage from "@/app/signup/page";

beforeEach(() => {
  post.mockReset();
  push.mockReset();
  login.mockReset();
});
afterEach(cleanup);

describe("SignupPage", () => {
  it("renders graduation year dropdown starting from 2018", () => {
    const { container } = render(<SignupPage />);
    const gradSelect = container.querySelector("select") as HTMLSelectElement;
    expect(gradSelect).toBeTruthy();

    const options = Array.from(gradSelect.options).map((opt) => opt.value);
    expect(options[0]).toBe("2018");
    expect(options).toContain("2018");
    expect(options).toContain("2024");
    expect(options).toContain("2026");
    expect(options).toContain("2030");
  });

  it("toggles password visibility between password and text", () => {
    render(<SignupPage />);
    const passwordInput = screen.getByPlaceholderText("Create a strong password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleButton = screen.getByRole("button", { name: /Show password/i });
    expect(toggleButton).toBeTruthy();

    // Click to show password
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: /Hide password/i })).toBeTruthy();

    // Click to hide password
    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(passwordInput.type).toBe("password");
  });

  it("submits registration with graduation_year and credentials", async () => {
    post.mockResolvedValueOnce({
      user: { id: 10, name: "Apt Student", email: "student@example.com", role: "user" },
      token: "test-token",
    });

    const { container } = render(<SignupPage />);
    fireEvent.change(screen.getByPlaceholderText("e.g. Alex Chen"), { target: { value: "Apt Student" } });
    fireEvent.change(screen.getByPlaceholderText("alex@example.com"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("alex_coder"), { target: { value: "apt_student" } });
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), { target: { value: "SecretPass123!" } });

    const gradSelect = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(gradSelect, { target: { value: "2018" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/register", expect.objectContaining({
        name: "Apt Student",
        email: "student@example.com",
        handle: "apt_student",
        password: "SecretPass123!",
        password_confirmation: "SecretPass123!",
        graduation_year: 2018,
      }));
    });
  });
});
