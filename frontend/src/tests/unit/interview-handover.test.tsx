import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const net = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => new URLSearchParams({ slug: "laravel-set-1" }),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: net.get, post: vi.fn(), getFile: vi.fn() } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1 } }) }));
vi.mock("@/lib/voice/VoiceEngine", () => ({ hasSpeechRecognition: () => true, hasSpeechSynthesis: () => true }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));
vi.mock("@/components/dashboard/interviews/InterviewSessionView", () => ({
  InterviewSessionView: ({ variant }: { variant: string }) => <div>SESSION ENGINE ({variant})</div>,
}));

import MockInterviewViewPage from "@/app/dashboard/interviews/view/page";
import MockInterviewSessionPage from "@/app/dashboard/interviews/session/page";
import VaultInterviewSessionPage from "@/app/dashboard/vault-interviews/session/page";

afterEach(cleanup);
beforeEach(() => {
  nav.replace.mockReset();
  nav.push.mockReset();
  net.get.mockReset();
});

const base = { id: 1, slug: "laravel-set-1", title: "T", description: null, interview_type: "practice", is_mock: true, company: null, question_count: 5, estimated_total_seconds: 600, my_session_status: null };

describe("a Vault AI Interview set never opens inside the Mock AI Interview", () => {
  it("the Mock AI Interview's session page hands a qualification set to the Vault session page", async () => {
    net.get.mockResolvedValue({ ...base, is_qualification: true });
    render(<MockInterviewSessionPage />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard/vault-interviews/session?slug=laravel-set-1"));
    expect(screen.queryByText(/SESSION ENGINE/)).toBeNull();
  });

  it("the Mock AI Interview's session page runs an ordinary interview as before", async () => {
    net.get.mockResolvedValue({ ...base, is_qualification: false });
    render(<MockInterviewSessionPage />);

    expect(await screen.findByText("SESSION ENGINE (mock)")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("still runs the session if the check itself fails (the session reports the real problem)", async () => {
    net.get.mockRejectedValue(new Error("offline"));
    render(<MockInterviewSessionPage />);

    expect(await screen.findByText("SESSION ENGINE (mock)")).toBeTruthy();
  });

  it("the Mock AI Interview's briefing page hands a qualification set to the Vault page", async () => {
    net.get.mockResolvedValue({ ...base, is_qualification: true });
    render(<MockInterviewViewPage />);

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dashboard/vault-interviews/view?slug=laravel-set-1"));
    expect(screen.queryByText(/Practice Round/i)).toBeNull();
  });

  it("the Mock AI Interview's briefing page still shows an ordinary practice round", async () => {
    net.get.mockResolvedValue({ ...base, is_qualification: false });
    render(<MockInterviewViewPage />);

    expect(await screen.findByText("Practice Round")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("the Vault session page runs the engine in its Vault variant", () => {
    render(<VaultInterviewSessionPage />);

    expect(screen.getByText("SESSION ENGINE (vault)")).toBeTruthy();
  });
});
