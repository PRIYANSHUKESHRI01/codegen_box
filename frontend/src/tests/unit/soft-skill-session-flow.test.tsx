import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoftSkillActiveSession, SoftSkillAssessmentSummary } from "@/types/softSkill";

const get = vi.fn();
const post = vi.fn();
const push = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body) } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("slug=soft-skill-assessment-set-1"),
}));

vi.mock("@/lib/useAuthGuard", () => ({
  useAuthGuard: () => ({ user: { id: 1, name: "Rohan Verma", email: "rohan@aptrun.com" }, status: "ready" }),
}));

vi.mock("@/lib/proctoring/useInterviewProctoring", () => ({
  useInterviewProctoring: vi.fn(() => ({
    phase: "consent",
    consentError: null,
    devicePreviewReady: true,
    previewVideoRef: { current: null },
    enableDevicePreview: vi.fn(),
    grantConsentAndStart: vi.fn(),
    cameraStream: null,
    endSession: vi.fn(),
    resumeFullscreen: vi.fn(),
    session: null,
    lastViolation: null,
  })),
}));

vi.mock("@/components/proctoring/ProctoringConsentGate", () => ({
  ProctoringConsentGate: ({ onConsent, startLabel }: { onConsent: () => void; startLabel?: string }) => (
    <div data-testid="consent-gate">
      <span>Proctoring Consent Screen</span>
      <button onClick={onConsent}>{startLabel ?? "Start Proctored Session"}</button>
    </div>
  ),
}));

vi.mock("@/components/proctoring/ProctoringOverlay", () => ({
  ProctoringOverlay: () => <div data-testid="proctoring-overlay" />,
}));

vi.mock("@/components/proctoring/ProctoringLockedScreen", () => ({
  ProctoringLockedScreen: () => <div data-testid="proctoring-locked" />,
}));

vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-shell">{children}</div>,
}));

vi.mock("@/components/ui/SessionLoader", () => ({
  SessionLoader: () => <div>Loading...</div>,
}));

import SoftSkillSessionPage from "@/app/dashboard/soft-skills/session/page";

const mockAssessmentSummary: SoftSkillAssessmentSummary = {
  id: 1,
  slug: "soft-skill-assessment-set-1",
  title: "Soft Skill Assessment - Set 1",
  description: "Standard campus recruitment assessment",
  assessment_type: "general",
  is_question_set: true,
  set_number: 1,
  duration_minutes: 45,
  pass_percentage: 60,
  max_attempts: 3,
  question_count: 2,
  category_composition: { aptitude: 1, reasoning: 1, english: 0, situational: 0 },
  company: null,
  attempts_taken: 0,
  best_score_percent: null,
  in_progress: false,
  can_attempt: true,
};

const mockActiveSession: SoftSkillActiveSession = {
  session: {
    id: 101,
    status: "in_progress",
    attempt_number: 1,
    started_at: new Date().toISOString(),
    deadline_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  },
  assessment: {
    title: mockAssessmentSummary.title,
    pass_percentage: mockAssessmentSummary.pass_percentage,
  },
  questions: [
    {
      response_id: 201,
      category: "aptitude",
      question_text: "What is the speed of a train traveling 120 km in 2 hours?",
      options: ["50 km/h", "60 km/h", "70 km/h", "80 km/h"],
      selected_index: null,
    },
    {
      response_id: 202,
      category: "reasoning",
      question_text: "If all cats are animals and all animals breathe, do all cats breathe?",
      options: ["Yes", "No", "Cannot be determined", "None of these"],
      selected_index: null,
    },
  ],
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  push.mockReset();
});

afterEach(cleanup);

describe("SoftSkillSessionPage - Lobby, Fullscreen & Anti-Copy UX", () => {
  it("renders the comprehensive instruction lobby before starting with 'Begin Assessment' button", async () => {
    get.mockResolvedValueOnce({
      assessment: mockAssessmentSummary,
      in_progress_session_id: null,
      completed_session_ids: [],
      proctoring_required: true,
    });

    render(<SoftSkillSessionPage />);

    // Waits for overview to load and displays instructions
    await waitFor(() => {
      expect(screen.getByText("Soft Skill Assessment - Set 1")).toBeTruthy();
    });

    // Check guideline cards
    expect(screen.getByText("Important Instructions Before You Begin")).toBeTruthy();
    expect(screen.getByText("No Negative Marking")).toBeTruthy();
    expect(screen.getByText("Real-time Autosave")).toBeTruthy();
    expect(screen.getByText("Continuous Fullscreen Required")).toBeTruthy();
    expect(screen.getByText("Strict Anti-Copy Protection")).toBeTruthy();

    // Check stats
    expect(screen.getByText("2")).toBeTruthy(); // question count
    expect(screen.getByText("45")).toBeTruthy(); // duration
    expect(screen.getByText("60%")).toBeTruthy(); // pass percentage

    // Check prominent Begin Assessment button
    const beginButton = screen.getByRole("button", { name: /Begin Assessment/i });
    expect(beginButton).toBeTruthy();
  });

  it("clicking Begin Assessment initiates session and displays the proctoring consent gate with Begin Assessment label", async () => {
    get.mockResolvedValueOnce({
      assessment: mockAssessmentSummary,
      in_progress_session_id: null,
      completed_session_ids: [],
      proctoring_required: true,
    });
    post.mockResolvedValueOnce(mockActiveSession);

    render(<SoftSkillSessionPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Begin Assessment/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Begin Assessment/i }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/soft-skills/soft-skill-assessment-set-1/start", undefined);
      expect(screen.getByTestId("consent-gate")).toBeTruthy();
      expect(screen.getByText("Begin Assessment")).toBeTruthy();
    });
  });

  it("in unproctored mode, clicking Begin Assessment starts the assessment room directly", async () => {
    get.mockResolvedValueOnce({
      assessment: mockAssessmentSummary,
      in_progress_session_id: null,
      completed_session_ids: [],
      proctoring_required: false,
    });
    post.mockResolvedValueOnce(mockActiveSession);

    render(<SoftSkillSessionPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Begin Assessment/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Begin Assessment/i }));

    await waitFor(() => {
      expect(screen.getByText("What is the speed of a train traveling 120 km in 2 hours?")).toBeTruthy();
      expect(screen.getByText("60 km/h")).toBeTruthy();
      expect(screen.getByText("Question Palette")).toBeTruthy();
    });
  });

  it("blocks copy, contextmenu, and key combinations in test taking mode", async () => {
    get.mockResolvedValueOnce({
      assessment: mockAssessmentSummary,
      in_progress_session_id: null,
      completed_session_ids: [],
      proctoring_required: false,
    });
    post.mockResolvedValueOnce(mockActiveSession);

    render(<SoftSkillSessionPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Begin Assessment/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: /Begin Assessment/i }));

    await waitFor(() => {
      expect(screen.getByText("What is the speed of a train traveling 120 km in 2 hours?")).toBeTruthy();
    });

    // Test copy event is prevented
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true });
    const preventedCopy = !document.dispatchEvent(copyEvent);
    expect(preventedCopy).toBe(true);

    // Test contextmenu event is prevented
    const contextMenuEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const preventedContext = !document.dispatchEvent(contextMenuEvent);
    expect(preventedContext).toBe(true);

    // Test Ctrl+C keydown is prevented
    const ctrlCEvent = new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true });
    const preventedKey = !window.dispatchEvent(ctrlCEvent);
    expect(preventedKey).toBe(true);
  });
});
