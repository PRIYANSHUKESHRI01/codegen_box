import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { SESSION_ENDED_EVENT, resetSessionEndedFlag, takeSignedOutNotice, type SessionEndedDetail } from "@/lib/sessionEvents";

/**
 * The real api helper, with only `fetch` faked: when the server ends a session behind the page's back, the
 * helper must say so once, app-wide — and must NOT treat an ordinary refusal (a validation error, a missing
 * permission, someone else's wrong password) as the end of the session.
 */

const respond = (status: number, body: Record<string, unknown>) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

let heard: SessionEndedDetail[];
const listener = (e: Event) => heard.push((e as CustomEvent<SessionEndedDetail>).detail);

beforeEach(() => {
  heard = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSessionEndedFlag();
  window.addEventListener(SESSION_ENDED_EVENT, listener);
});

afterEach(() => {
  window.removeEventListener(SESSION_ENDED_EVENT, listener);
  vi.unstubAllGlobals();
});

describe("api — the session ended on the server", () => {
  it("announces a blocked account (403 account_blocked) and keeps the server's own words for the login page", async () => {
    window.localStorage.setItem("aptrun_token", "t");
    vi.stubGlobal("fetch", respond(403, { message: "This account has been blocked. Contact an administrator.", code: "account_blocked" }));

    await expect(api.get("/me")).rejects.toBeInstanceOf(ApiError);

    expect(heard).toEqual([{ reason: "blocked", message: "This account has been blocked. Contact an administrator." }]);
    expect(takeSignedOutNotice()).toBe("This account has been blocked. Contact an administrator.");
  });

  it("announces a refused token (401) — signed out everywhere, or a viewing token that ran out", async () => {
    window.localStorage.setItem("aptrun_token", "t");
    vi.stubGlobal("fetch", respond(401, { message: "Unauthenticated." }));

    await expect(api.get("/me/subscription")).rejects.toMatchObject({ status: 401 });

    expect(heard).toEqual([{ reason: "signed_out", message: "You were signed out. Please sign in again." }]);
  });

  it("says it once however many requests fail together", async () => {
    window.localStorage.setItem("aptrun_token", "t");
    vi.stubGlobal("fetch", respond(401, { message: "Unauthenticated." }));

    await Promise.allSettled([api.get("/a"), api.get("/b"), api.post("/c", {})]);

    expect(heard).toHaveLength(1);
  });

  it("stays quiet when nobody was signed in to begin with (a wrong password at the login form)", async () => {
    vi.stubGlobal("fetch", respond(401, { message: "Unauthenticated." }));

    await expect(api.post("/login", { email: "a@b.c", password: "x" })).rejects.toBeInstanceOf(ApiError);

    expect(heard).toHaveLength(0);
  });

  it.each([
    [422, { message: "The given data was invalid.", errors: { email: ["taken"] } }],
    [403, { message: "You do not have permission to access this resource." }],
    [403, { message: "Read-only.", code: "impersonation_read_only" }],
    [402, { message: "Upgrade.", code: "plan_required" }],
    [500, { message: "Server Error" }],
  ])("does not end the session for an ordinary refusal (%i)", async (status, body) => {
    window.localStorage.setItem("aptrun_token", "t");
    vi.stubGlobal("fetch", respond(status, body));

    await expect(api.post("/anything", {})).rejects.toBeInstanceOf(ApiError);

    expect(heard).toHaveLength(0);
  });
});
