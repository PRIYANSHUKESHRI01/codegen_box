import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import type { AuthUser } from "@/lib/auth";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path) } };
});

const USER = { id: 7, name: "Alex Chen", email: "alex@example.com", role: "user" } as unknown as AuthUser;

function Probe() {
  const { status, user } = useAuth();
  return (
    <p data-testid="state">
      {status}:{user?.name ?? "nobody"}
    </p>
  );
}

const state = () => screen.getByTestId("state").textContent;

function mount() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

beforeEach(() => {
  get.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("aptrun_token", "token-123");
  window.localStorage.setItem("aptrun_user", JSON.stringify(USER));
});

describe("session verification", () => {
  it("keeps a good session when the server confirms it", async () => {
    get.mockResolvedValue({ user: { ...USER, name: "Alex Chen (fresh)" } });
    mount();

    await waitFor(() => expect(state()).toBe("ready:Alex Chen (fresh)"));
  });

  it.each([401, 403])("signs out when the server rejects the session (%i)", async (status) => {
    get.mockRejectedValue(new ApiError("Unauthenticated.", status));
    mount();

    await waitFor(() => expect(state()).toBe("signed_out:nobody"));
    expect(window.localStorage.getItem("aptrun_token")).toBeNull();
  });

  it.each([
    ["a server error", new ApiError("Server Error", 500)],
    ["a gateway timeout", new ApiError("Timeout", 504)],
    ["a dropped connection", new TypeError("Failed to fetch")],
  ])("does NOT sign out on %s — a slow API must not log anyone out", async (_label, failure) => {
    get.mockRejectedValue(failure);
    mount();

    await waitFor(() => expect(get).toHaveBeenCalled());
    // Give the rejected promise time to settle, then confirm nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(state()).toBe("ready:Alex Chen");
    expect(window.localStorage.getItem("aptrun_token")).toBe("token-123");
  });

  it("has no session to keep when nothing was cached and the check fails", async () => {
    window.localStorage.removeItem("aptrun_user");
    get.mockRejectedValue(new ApiError("Server Error", 500));
    mount();

    await waitFor(() => expect(state()).toBe("signed_out:nobody"));
  });
});
