import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/auth";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string) => post(path), put: vi.fn(), delete: vi.fn() } };
});

import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { ImpersonationBanner } from "@/components/auth/ImpersonationBanner";
import { IMPERSONATION_CHANGED_EVENT, beginImpersonation, discardImpersonation, endImpersonation, getImpersonation, restoreOriginalSession } from "@/lib/impersonation";
import { ACCOUNT_BLOCKED_CODE, SESSION_ENDED_EVENT, announceSessionEnded, resetSessionEndedFlag, takeSignedOutNotice } from "@/lib/sessionEvents";

const SUPERADMIN = { id: 1, name: "Aryan Varma", email: "root@mellow.test", role: "superadmin" } as unknown as AuthUser;
const STUDENT = { id: 5, name: "Anika Rao", email: "anika@example.com", role: "user" } as unknown as AuthUser;

const stored = () => ({ token: window.localStorage.getItem("aptrun_token"), user: JSON.parse(window.localStorage.getItem("aptrun_user") ?? "null") as AuthUser | null });
const signInAsSuperadmin = () => {
  window.localStorage.setItem("aptrun_token", "root-token");
  window.localStorage.setItem("aptrun_user", JSON.stringify(SUPERADMIN));
};
const viewing = (over: Partial<{ token: string; user: AuthUser; expires_at: string }> = {}) => ({ token: "viewing-token", user: STUDENT, expires_at: new Date(Date.now() + 60 * 60_000).toISOString(), ...over });

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSessionEndedFlag();
});

afterEach(cleanup);

describe("view as — the browser half", () => {
  it("parks the superadmin's own session, signs in as the viewed account and says where to go", () => {
    signInAsSuperadmin();

    const destination = beginImpersonation(viewing());

    expect(destination).toBe("/dashboard");
    expect(stored()).toEqual({ token: "viewing-token", user: STUDENT });
    expect(getImpersonation()).toMatchObject({ original: { token: "root-token", user: SUPERADMIN }, target: { id: 5, name: "Anika Rao", role: "user" } });
  });

  it("will not start without a signed-in session to come back to", () => {
    expect(() => beginImpersonation(viewing())).toThrow(/no signed-in session/i);
    expect(getImpersonation()).toBeNull();
  });

  it("never loses the real superadmin session by viewing a second account on top of the first", () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());
    beginImpersonation(viewing({ token: "second-token", user: { ...STUDENT, id: 6, name: "Second Student" } }));

    expect(getImpersonation()?.original).toEqual({ token: "root-token", user: SUPERADMIN });
    expect(getImpersonation()?.target.name).toBe("Second Student");
  });

  it("puts the superadmin back exactly as they were", () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());

    expect(restoreOriginalSession()).toEqual(SUPERADMIN);
    expect(stored()).toEqual({ token: "root-token", user: SUPERADMIN });
    expect(getImpersonation()).toBeNull();
    expect(restoreOriginalSession()).toBeNull();
  });

  it("leaving ends the viewing token on the server and restores the superadmin — even when the server can't be reached", async () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());
    post.mockRejectedValue(new TypeError("Failed to fetch"));

    const restored = await endImpersonation();

    expect(post).toHaveBeenCalledWith("/logout");
    expect(restored).toEqual(SUPERADMIN);
    expect(stored().token).toBe("root-token");
  });

  it("does nothing when there is no view to leave", async () => {
    signInAsSuperadmin();

    expect(await endImpersonation()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("a full sign-out while viewing also revokes the parked superadmin token, so it is not left valid", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    signInAsSuperadmin();
    beginImpersonation(viewing());

    discardImpersonation();

    expect(getImpersonation()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/logout$/);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer root-token" });
    vi.unstubAllGlobals();
  });

  it("treats a damaged stored state as no view at all", () => {
    window.localStorage.setItem("aptrun_impersonation", "{not json");
    expect(getImpersonation()).toBeNull();
    window.localStorage.setItem("aptrun_impersonation", JSON.stringify({ target: {} }));
    expect(getImpersonation()).toBeNull();
  });
});

describe("the 'viewing as' banner", () => {
  const mountBanner = () =>
    render(
      <AuthProvider>
        <ImpersonationBanner />
      </AuthProvider>
    );

  it("is absent for a normal session", async () => {
    signInAsSuperadmin();
    get.mockResolvedValue({ user: SUPERADMIN });
    mountBanner();

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: /viewing as another account/i })).toBeNull();
  });

  it("names who is being viewed, says it is read-only, counts down, and is there on every page", async () => {
    signInAsSuperadmin();
    beginImpersonation(viewing({ expires_at: new Date(Date.now() + 59 * 60_000 + 30_000).toISOString() }));
    get.mockResolvedValue({ user: STUDENT });
    mountBanner();

    const banner = await screen.findByRole("region", { name: /viewing as another account/i });
    expect(banner.textContent).toContain("Viewing as Anika Rao");
    expect(banner.textContent).toContain("Student");
    expect(banner.textContent).toContain("read-only");
    expect(banner.textContent).toMatch(/59:\d\d|60:00/);
  });

  it("leaves the view on 'Exit view' and returns to the superadmin console", async () => {
    Object.defineProperty(window, "location", { value: { ...window.location, assign: vi.fn() }, writable: true });
    signInAsSuperadmin();
    beginImpersonation(viewing());
    get.mockResolvedValue({ user: STUDENT });
    post.mockResolvedValue({});
    mountBanner();

    fireEvent.click(await screen.findByRole("button", { name: /exit view/i }));

    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith("/superadmin?tab=accounts"));
    expect(stored().token).toBe("root-token");
    expect(getImpersonation()).toBeNull();
  });

  it("disappears when another tab ends the view", async () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());
    get.mockResolvedValue({ user: STUDENT });
    mountBanner();
    await screen.findByRole("region", { name: /viewing as another account/i });

    act(() => {
      window.localStorage.removeItem("aptrun_impersonation");
      window.dispatchEvent(new Event(IMPERSONATION_CHANGED_EVENT));
    });

    await waitFor(() => expect(screen.queryByRole("region", { name: /viewing as another account/i })).toBeNull());
  });
});

describe("the server ending a session behind the page's back", () => {
  function Probe() {
    const { status, user } = useAuth();
    return (
      <p data-testid="state">
        {status}:{user?.name ?? "nobody"}
      </p>
    );
  }
  const state = () => screen.getByTestId("state").textContent;
  const mount = () =>
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

  it("signs the person out and leaves a note for the login page", async () => {
    window.localStorage.setItem("aptrun_token", "t");
    window.localStorage.setItem("aptrun_user", JSON.stringify(STUDENT));
    get.mockResolvedValue({ user: STUDENT });
    mount();
    await waitFor(() => expect(state()).toBe("ready:Anika Rao"));

    act(() => announceSessionEnded({ reason: "blocked", message: "This account has been blocked. Contact an administrator." }));

    await waitFor(() => expect(state()).toBe("signed_out:nobody"));
    expect(window.localStorage.getItem("aptrun_token")).toBeNull();
    expect(takeSignedOutNotice()).toBe("This account has been blocked. Contact an administrator.");
    expect(takeSignedOutNotice()).toBeNull(); // shown once
  });

  it("announces only once however many requests fail at the same time", () => {
    const heard = vi.fn();
    window.addEventListener(SESSION_ENDED_EVENT, heard);

    announceSessionEnded({ reason: "signed_out", message: "a" });
    announceSessionEnded({ reason: "signed_out", message: "b" });
    announceSessionEnded({ reason: "blocked", message: "c" });

    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_ENDED_EVENT, heard);
  });

  it("returns a superadmin who was viewing someone to their own console instead of a login page", async () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());
    get.mockResolvedValue({ user: STUDENT });
    mount();
    await waitFor(() => expect(state()).toBe("ready:Anika Rao"));

    // The viewing token ran out: the next request is refused.
    act(() => announceSessionEnded({ reason: "signed_out", message: "You were signed out. Please sign in again." }));

    await waitFor(() => expect(state()).toBe("ready:Aryan Varma"));
    expect(stored().token).toBe("root-token");
    expect(takeSignedOutNotice()).toBeNull();
  });

  it("does the same when the check on tab focus finds the viewing token expired", async () => {
    signInAsSuperadmin();
    beginImpersonation(viewing());
    get.mockRejectedValue(new ApiError("Unauthenticated.", 401));
    mount();

    await waitFor(() => expect(state()).toBe("ready:Aryan Varma"));
  });

  it("uses the code the API puts on a blocked refusal", () => {
    expect(ACCOUNT_BLOCKED_CODE).toBe("account_blocked");
  });
});
