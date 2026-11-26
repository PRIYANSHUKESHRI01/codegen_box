import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { isMobilePhoneDevice } from "@/lib/device/largerScreen";
import { DesktopRequiredScreen } from "@/components/dashboard/interviews/room/DesktopRequiredScreen";
import { InterviewSessionView } from "@/components/dashboard/interviews/InterviewSessionView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/interviews/session",
  useSearchParams: () => new URLSearchParams("slug=react-set-1"),
}));

vi.mock("@/lib/useAuthGuard", () => ({
  useAuthGuard: () => ({ status: "ready", user: { id: 1, name: "Alex Chen", role: "user" } }),
}));

describe("Mobile phone block on proctored Mock AI & Vault AI sessions", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("blocks handheld mobile phones while allowing laptops, desktops, iPads, and large tablets", () => {
    // Blocked mobile phones
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", innerWidth: 390, innerHeight: 844 })).toBe(true);
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36", innerWidth: 412, innerHeight: 915 })).toBe(true);
    // Phone using Request Desktop Site or rotated landscape (wide viewport, small screen short edge + touch)
    expect(
      isMobilePhoneDevice({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        innerWidth: 980,
        innerHeight: 420,
        screenWidth: 390,
        screenHeight: 844,
        maxTouchPoints: 5,
        coarsePointer: true,
      })
    ).toBe(true);
    // Narrow responsive mobile viewport
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", innerWidth: 480, innerHeight: 800 })).toBe(true);

    // Allowed larger screens (Laptop / Desktop / iPad / Android Tablet)
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", innerWidth: 1440, innerHeight: 900, screenWidth: 1440, screenHeight: 900 })).toBe(false);
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", innerWidth: 768, innerHeight: 1024, screenWidth: 768, screenHeight: 1024, maxTouchPoints: 5, coarsePointer: true })).toBe(false);
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", innerWidth: 820, innerHeight: 1180, screenWidth: 820, screenHeight: 1180, maxTouchPoints: 5, coarsePointer: true })).toBe(false);
    expect(isMobilePhoneDevice({ userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36", innerWidth: 1024, innerHeight: 768, screenWidth: 1200, screenHeight: 800, maxTouchPoints: 10, coarsePointer: true })).toBe(false);
  });

  it("renders modern Laptop/Larger Screen message page for Vault AI and Mock AI sessions", () => {
    render(<DesktopRequiredScreen variant="vault" backHref="/dashboard/vault-interviews" />);
    expect(screen.getByTestId("mobile-interview-blocked-screen")).toBeInTheDocument();
    expect(screen.getByText(/Attempt this interview on your laptop or bigger screen/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Vault AI Interview/i })).toHaveAttribute("href", "/dashboard/vault-interviews");
    expect(screen.getByRole("button", { name: /Copy Interview Link for Laptop/i })).toBeInTheDocument();
  });

  it("shows DesktopRequiredScreen inside InterviewSessionView on mobile phone without opening the proctoring room", () => {
    const origWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      render(<InterviewSessionView variant="mock" />);
      expect(screen.getByTestId("mobile-interview-blocked-screen")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Back to Mock AI Interview/i })).toHaveAttribute("href", "/dashboard/interviews");
      expect(screen.queryByRole("button", { name: /Start Proctored Interview/i })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: origWidth });
    }
  });
});
