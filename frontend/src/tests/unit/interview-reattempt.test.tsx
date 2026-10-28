import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import InterviewDetailPage from "@/app/dashboard/interviews/view/page";
import { api } from "@/lib/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === "slug" ? "test-interview-slug" : null)),
  }),
  usePathname: () => "/dashboard/interviews/view",
}));

vi.mock("@/lib/useAuthGuard", () => ({
  useAuthGuard: () => ({ status: "ready", user: { id: 1, role: "user" } }),
}));

vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
}));

describe("Interview Re-attempt Flow when Score < 60%", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows re-attempt warning banner when score is less than 60%", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/interviews/test-interview-slug") {
        return Promise.resolve({
          id: 10,
          title: "Go Fundamentals",
          slug: "test-interview-slug",
          my_session_status: "completed",
          question_count: 5,
        });
      }
      if (url === "/interviews/test-interview-slug/result") {
        return Promise.resolve({
          status: "scored",
          composite_score_percent: 54,
          passed: null,
          responses: [
            {
              response_id: 1,
              question_text: "What is a Goroutine?",
              category: "technical",
              transcript_text: "A goroutine is a thread.",
              score: 54,
              feedback: "Too brief, explain M:N scheduling and 2KB stack allocation.",
              has_audio: false,
            },
          ],
        });
      }
      return Promise.reject(new Error("not found"));
    });

    render(<InterviewDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Score below 60% — Re-attempt Recommended")).toBeTruthy();
    });

    // Verify warning messaging
    expect(screen.getByText(/below the 60% technical readiness benchmark/i)).toBeTruthy();
    expect(screen.getAllByText(/54%/i).length).toBeGreaterThan(0);

    // Verify re-attempt button
    const reattemptBtn = screen.getByRole("button", { name: /Re-attempt Interview/i });
    expect(reattemptBtn).toBeTruthy();

    // Clicking re-attempt calls backend API and redirects to voice room
    vi.mocked(api.post).mockResolvedValueOnce({ message: "Interview session reset." });
    fireEvent.click(reattemptBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/interviews/test-interview-slug/reattempt", {});
      expect(mockPush).toHaveBeenCalledWith("/dashboard/interviews/session?slug=test-interview-slug");
    });
  });

  it("does not show the low score banner when score is 60% or higher", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/interviews/test-interview-slug") {
        return Promise.resolve({
          id: 10,
          title: "Go Fundamentals",
          slug: "test-interview-slug",
          my_session_status: "completed",
          question_count: 5,
        });
      }
      if (url === "/interviews/test-interview-slug/result") {
        return Promise.resolve({
          status: "scored",
          composite_score_percent: 82,
          passed: null,
          responses: [
            {
              response_id: 1,
              question_text: "What is a Goroutine?",
              category: "technical",
              transcript_text: "A goroutine is a lightweight thread managed by the Go runtime.",
              score: 82,
              feedback: "Strong technical answer with clear understanding of stack size.",
              has_audio: false,
            },
          ],
        });
      }
      return Promise.reject(new Error("not found"));
    });

    render(<InterviewDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("82%")).toBeTruthy();
    });

    expect(screen.queryByText("Score below 60% — Re-attempt Recommended")).toBeNull();
  });

  it("offers no re-attempt for a scored Vault qualification set and points back to the circuit", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/interviews/test-interview-slug") {
        return Promise.resolve({ id: 10, title: "Laravel Set 1", slug: "test-interview-slug", my_session_status: "completed", question_count: 5 });
      }
      if (url === "/interviews/test-interview-slug/result") {
        return Promise.resolve({
          status: "scored",
          composite_score_percent: 41,
          passed: null,
          is_qualification: true,
          reattemptable: false,
          responses: [],
        });
      }
      return Promise.reject(new Error("not found"));
    });

    render(<InterviewDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/counts toward your Mellow Vault qualification series/i)).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: /Re-attempt Interview/i })).toBeNull();
    expect(screen.queryByText("Score below 60% — Re-attempt Recommended")).toBeNull();
    expect(screen.getByRole("link", { name: /Qualification Circuit/i }).getAttribute("href")).toBe("/dashboard/vault-interviews");
  });

  it("lets a student sit a qualification set again only when its scoring failed", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === "/interviews/test-interview-slug") {
        return Promise.resolve({ id: 10, title: "Laravel Set 1", slug: "test-interview-slug", my_session_status: "completed", question_count: 5 });
      }
      if (url === "/interviews/test-interview-slug/result") {
        return Promise.resolve({
          status: "needs_human_review",
          composite_score_percent: null,
          passed: null,
          is_qualification: true,
          reattemptable: true,
          responses: [],
        });
      }
      return Promise.reject(new Error("not found"));
    });

    render(<InterviewDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Scoring didn't complete for this set/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Re-attempt Interview/i })).toBeTruthy();
  });
});
