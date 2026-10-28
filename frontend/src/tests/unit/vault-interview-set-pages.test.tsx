import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentInterviewSummary } from "@/types/interview";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), slug: "laravel-set-2" }));
const net = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getFile: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => new URLSearchParams({ slug: nav.slug }),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: net.get, post: net.post, getFile: net.getFile } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1, name: "Alex" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/voice/VoiceEngine", () => ({ hasSpeechRecognition: () => true, hasSpeechSynthesis: () => true }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <main>
      <h1 data-testid="shell-title">{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));

import VaultInterviewSetPage from "@/app/dashboard/vault-interviews/view/page";

afterEach(cleanup);

const summary = (over: Partial<StudentInterviewSummary> = {}): StudentInterviewSummary => ({
  id: 5,
  slug: "laravel-set-2",
  title: "Backend Developer (Laravel (PHP)) — Set 2: Problem Solving",
  description: "Data structures, query tuning and caching.",
  interview_type: "practice",
  is_mock: true,
  company: null,
  question_count: 5,
  estimated_total_seconds: 960,
  my_session_status: null,
  is_qualification: true,
  qualification: { stack_key: "laravel", role_key: "backend", series_number: 1, set_number: 2 },
  ...over,
});

const scored = (percent: number) => ({
  status: "scored",
  composite_score_percent: percent,
  passed: null,
  is_qualification: true,
  reattemptable: false,
  responses: [{ response_id: 11, question_text: "Explain the request lifecycle.", category: "technical", transcript_text: "It starts at the front controller.", has_audio: false, score: 80, feedback: "Clear and complete." }],
});

function serve(interview: StudentInterviewSummary | Error, result?: unknown) {
  net.get.mockImplementation((url: string) => {
    if (url.endsWith("/result")) return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    return interview instanceof Error ? Promise.reject(interview) : Promise.resolve(interview);
  });
}

beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
  net.get.mockReset();
  net.post.mockReset();
});

describe("a Vault AI Interview set, before it is sat", () => {
  it("is branded as the Vault AI Interview and says where it sits in the series", async () => {
    serve(summary());
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText("Vault qualification")).toBeTruthy();
    expect(screen.getByTestId("shell-title").textContent).toBe("Vault AI Interview");
    expect(screen.getByText("Series 1 · Set 2 of 3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Set 2: Problem Solving/ })).toBeTruthy();
  });

  it("never calls itself a practice round, or says it is outside the hiring decision", async () => {
    serve(summary());
    render(<VaultInterviewSetPage />);

    await screen.findByText("Vault qualification");
    expect(screen.queryByText(/practice round/i)).toBeNull();
    expect(screen.queryByText(/never part of the actual hiring decision/i)).toBeNull();
    expect(screen.getByText(/counts toward your Mellow Vault series/)).toBeTruthy();
  });

  it("starts the set in the Vault AI Interview's own session page", async () => {
    serve(summary());
    render(<VaultInterviewSetPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Start Set 2/ }));

    expect(nav.push).toHaveBeenCalledWith("/dashboard/vault-interviews/session?slug=laravel-set-2");
  });

  it("offers to continue a set that was started", async () => {
    serve(summary({ my_session_status: "in_progress" }));
    render(<VaultInterviewSetPage />);

    expect(await screen.findByRole("button", { name: /Continue Set 2/ })).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  it("says what to expect, in the set's own words", async () => {
    serve(summary());
    render(<VaultInterviewSetPage />);

    await screen.findByText("Before you start");
    expect(screen.getByText(/After 3 strikes the set is locked/)).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
    expect(screen.getByText("~16 min")).toBeTruthy();
  });

  it("links back to the qualification circuit", async () => {
    serve(summary());
    render(<VaultInterviewSetPage />);

    expect((await screen.findByRole("link", { name: /Back to the qualification circuit/ })).getAttribute("href")).toBe("/dashboard/vault-interviews");
  });

  it("hands an ordinary interview over to the Mock AI Interview's page", async () => {
    serve(summary({ is_qualification: false, qualification: null }));
    render(<VaultInterviewSetPage />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard/interviews/view?slug=laravel-set-2"));
  });

  it("says plainly when the set is not available", async () => {
    serve(new Error("nope"));
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText("This set isn't available.")).toBeTruthy();
  });
});

describe("a Vault AI Interview set, after it is sat", () => {
  it("says it is scoring, and does not show a result yet", async () => {
    serve(summary({ my_session_status: "completed" }), { status: "scoring", responses: [] });
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText(/Scoring your answers with AI/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start Set/ })).toBeNull();
  });

  it("shows a score above the line, with the feedback on every answer", async () => {
    serve(summary({ my_session_status: "completed" }), scored(72));
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText("Above the 60% line")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Your score for this set: 72 out of 100" })).toBeTruthy();
    expect(screen.getByText("Clear and complete.")).toBeTruthy();
    expect(screen.getByText("80/100")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to the circuit/ }).getAttribute("href")).toBe("/dashboard/vault-interviews");
  });

  it("reassures a student whose set is below the line that the average is what counts", async () => {
    serve(summary({ my_session_status: "completed" }), scored(45));
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText("Below the 60% line")).toBeTruthy();
    expect(screen.getByText(/it's your average across all three sets that counts/)).toBeTruthy();
    // And no practice-round re-attempt nudge: a qualification set is scored once.
    expect(screen.queryByText(/Re-attempt/i)).toBeNull();
  });

  it("lets a student sit a set again only when scoring itself failed", async () => {
    net.post.mockResolvedValue({});
    serve(summary({ my_session_status: "completed" }), { status: "needs_human_review", reattemptable: true, is_qualification: true, responses: [] });
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText(/Scoring didn.t complete for this set, so it hasn.t counted/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sit this set again/ }));

    await waitFor(() => expect(net.post).toHaveBeenCalledWith("/interviews/laravel-set-2/reattempt", {}));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/dashboard/vault-interviews/session?slug=laravel-set-2"));
  });

  it("offers no re-sit when it is not allowed", async () => {
    serve(summary({ my_session_status: "completed" }), { status: "needs_human_review", reattemptable: false, is_qualification: true, responses: [] });
    render(<VaultInterviewSetPage />);

    expect(await screen.findByText(/A reviewer has been notified/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sit this set again/ })).toBeNull();
  });
});
