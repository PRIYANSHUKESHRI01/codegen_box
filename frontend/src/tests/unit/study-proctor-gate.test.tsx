import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProctoringPhase } from "@/lib/proctoring/types";

const post = vi.fn();
const push = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: vi.fn(), post: (...a: unknown[]) => post(...a) } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: { name: "Esha", roll_number: "R1" } }) }));

// The real hook drives the camera and fullscreen; here the test steers the phases it reports.
const hook = {
  phase: "consent" as ProctoringPhase,
  session: null as null | { status: string; violation_count: number; max_violations: number; locked_at: null },
  lastViolation: null,
  consentError: null as string | null,
  previewVideoRef: { current: null },
  devicePreviewReady: false,
  cameraStream: null,
  enableDevicePreview: vi.fn(),
  grantConsentAndStart: vi.fn(),
  resumeFullscreen: vi.fn(),
  endSession: vi.fn(),
};
let hookBasePath = "";
vi.mock("@/lib/proctoring/useInterviewProctoring", () => ({
  useInterviewProctoring: (o: { basePath: string }) => {
    hookBasePath = o.basePath;
    return hook;
  },
}));

import { ApiError } from "@/lib/api";
import { StudyProctorGate, type StudySittingContext } from "@/components/proctoring/StudyProctorGate";

let ctx: StudySittingContext | null = null;
const renderGate = (onActiveChange = vi.fn()) =>
  render(
    <StudyProctorGate kind="drill" subject="gray_code" backHref="/dashboard/drills" onActiveChange={onActiveChange}>
      {(c) => {
        ctx = c;
        return <div>the practice page (sitting {String(c.sittingId)})</div>;
      }}
    </StudyProctorGate>
  );

beforeEach(() => {
  post.mockReset();
  push.mockReset();
  Object.assign(hook, { phase: "consent", session: null, consentError: null, devicePreviewReady: false });
  Object.values(hook).forEach((v) => typeof v === "function" && "mockReset" in v && (v as ReturnType<typeof vi.fn>).mockReset());
  ctx = null;
  post.mockImplementation((path: string) => (path === "/me/sittings" ? Promise.resolve({ proctored: true, sitting: { id: 41 } }) : Promise.resolve({})));
});
afterEach(async () => {
  cleanup();
  // unmounting schedules the sitting's close a beat later; let it fire (into this test's mock) before the next test resets it
  await new Promise((r) => setTimeout(r, 150));
});

describe("<StudyProctorGate>", () => {
  it("opens a sitting for the kind and subject and shows the consent screen — never the practice page — until the student starts", async () => {
    renderGate();

    expect(await screen.findByText("This is a proctored practice sitting")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/me/sittings", { kind: "drill", subject: "gray_code" });
    expect(hookBasePath).toBe("/me/sittings/41");
    expect(screen.queryByText(/the practice page/)).toBeNull();
    expect(screen.getByText(/Nothing you do here changes your readiness score/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Enable Camera/ }));
    expect(hook.enableDevicePreview).toHaveBeenCalled();
  });

  it("shows the practice page, with the sitting's id, once proctoring is active — and tells the page it is live", async () => {
    hook.phase = "active";
    hook.session = { status: "active", violation_count: 1, max_violations: 3, locked_at: null };
    const onActive = vi.fn();
    renderGate(onActive);

    expect(await screen.findByText("the practice page (sitting 41)")).toBeTruthy();
    expect(screen.getByText("1/3 strikes")).toBeTruthy(); // the overlay's strike counter
    await waitFor(() => expect(onActive).toHaveBeenLastCalledWith(true));
  });

  it("replaces everything with the closed-sitting screen when the sitting is locked", async () => {
    hook.phase = "locked";
    hook.session = { status: "locked", violation_count: 3, max_violations: 3, locked_at: null };
    renderGate();

    expect(await screen.findByText("This sitting was closed")).toBeTruthy();
    expect(screen.queryByText(/the practice page/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(push).toHaveBeenCalledWith("/dashboard/drills");
  });

  it("lets the student open a fresh sitting from the closed-sitting screen", async () => {
    hook.phase = "locked";
    hook.session = { status: "locked", violation_count: 3, max_violations: 3, locked_at: null };
    renderGate();
    await screen.findByText("This sitting was closed");
    expect(screen.getByText(/start a new sitting straight away/)).toBeTruthy();

    post.mockImplementation((path: string) => (path === "/me/sittings" ? Promise.resolve({ proctored: true, sitting: { id: 77 } }) : Promise.resolve({})));
    hook.phase = "consent";
    hook.session = null;
    fireEvent.click(screen.getByRole("button", { name: "Start a new sitting" }));

    await waitFor(() => expect(hookBasePath).toBe("/me/sittings/77"));
    expect(await screen.findByText("This is a proctored practice sitting")).toBeTruthy();
  });

  it("blocks a browser that cannot do camera or fullscreen, with the reason", async () => {
    hook.phase = "blocked";
    hook.consentError = "Camera and microphone access is required to take a proctored practice sitting.";
    renderGate();

    expect(await screen.findByText(/Camera and microphone access is required/)).toBeTruthy();
    expect(screen.queryByText(/the practice page/)).toBeNull();
  });

  it("ends the sitting on the server when the page says it is done, once", async () => {
    hook.phase = "active";
    renderGate();
    await screen.findByText(/the practice page/);

    ctx!.end();
    ctx!.end();

    expect(hook.endSession).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/me/sittings/41/complete", undefined, { keepalive: true });
    expect(post.mock.calls.filter((c) => c[0] === "/me/sittings/41/complete")).toHaveLength(1);
  });

  it("closes the sitting when the student leaves the page without finishing", async () => {
    hook.phase = "active";
    const { unmount } = renderGate();
    await screen.findByText(/the practice page/);
    unmount();

    await waitFor(() => expect(post).toHaveBeenCalledWith("/me/sittings/41/complete", undefined, { keepalive: true }));
  });

  it("opens exactly one sitting and never closes it under React's development double-mount", async () => {
    hook.phase = "active";
    render(
      <StrictMode>
        <StudyProctorGate kind="drill" subject="gray_code" backHref="/dashboard/drills">
          {(c) => <div>the practice page (sitting {String(c.sittingId)})</div>}
        </StudyProctorGate>
      </StrictMode>
    );

    expect(await screen.findByText("the practice page (sitting 41)")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 250));
    expect(post.mock.calls.filter((c) => c[0] === "/me/sittings")).toHaveLength(1);
    expect(post.mock.calls.filter((c) => String(c[0]).endsWith("/complete")), JSON.stringify(post.mock.calls)).toHaveLength(0);
  });

  it("opens a new sitting on restart and shows the consent screen again", async () => {
    hook.phase = "active";
    renderGate();
    await screen.findByText(/the practice page \(sitting 41\)/);

    post.mockImplementation((path: string) => (path === "/me/sittings" ? Promise.resolve({ proctored: true, sitting: { id: 42 } }) : Promise.resolve({})));
    hook.phase = "consent";
    ctx!.restart();

    await waitFor(() => expect(hookBasePath).toBe("/me/sittings/42"));
    expect(await screen.findByText("This is a proctored practice sitting")).toBeTruthy();
  });

  it("recognises the server saying the sitting is over or locked, and nothing else", async () => {
    hook.phase = "active";
    renderGate();
    await screen.findByText(/the practice page/);

    const refused = (code: string) => ctx!.sittingRefused(new ApiError("x", 428, undefined, code));
    expect(["sitting_ended", "sitting_required", "sitting_not_started", "sitting_locked"].every(refused)).toBe(true);
    expect(refused("something_else")).toBe(false);
    expect(ctx!.sittingRefused(new Error("offline"))).toBe(false);
  });

  it("runs the page straight away, with no sitting id, when the campus has study proctoring off", async () => {
    post.mockImplementation(() => Promise.resolve({ proctored: false, sitting: null }));
    renderGate();

    expect(await screen.findByText("the practice page (sitting null)")).toBeTruthy();
    expect(screen.queryByText("This is a proctored practice sitting")).toBeNull();
  });

  it("explains a refusal (the cool-down after a lock) and lets the student retry or go back", async () => {
    post.mockRejectedValueOnce(new ApiError("You can start a new one in about 8 minutes.", 423, undefined, "sitting_cooldown"));
    renderGate();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/about 8 minutes/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go back" }).getAttribute("href")).toBe("/dashboard/drills");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("This is a proctored practice sitting")).toBeTruthy();
  });
});
