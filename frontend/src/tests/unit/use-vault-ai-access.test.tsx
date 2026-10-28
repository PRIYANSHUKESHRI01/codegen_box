import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultAiAccess } from "@/types/vaultAi";

const state = vi.hoisted(() => ({ userId: 1 as number | null, get: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { get: state.get } }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: state.userId === null ? null : { id: state.userId } }) }));

import { ACADEMIC_CHANGED_EVENT } from "@/lib/planSync";
import { resetVaultAiAccess, useVaultAiAccess } from "@/lib/useVaultAiAccess";

const access = (over: Partial<VaultAiAccess> = {}): VaultAiAccess => ({
  state: "locked",
  audience: "college",
  study_year: 4,
  year_label: "4th year",
  reasons: ["waiting_period"],
  required_days: 45,
  first_login_at: null,
  unlocks_at: null,
  days_remaining: 45,
  waiting_period_met: false,
  readiness: null,
  ...over,
});

afterEach(cleanup);
beforeEach(() => {
  state.userId = 1;
  state.get.mockReset();
  resetVaultAiAccess();
});

describe("useVaultAiAccess", () => {
  it("asks the server where the student stands", async () => {
    state.get.mockResolvedValue({ access: access() });

    const { result } = renderHook(() => useVaultAiAccess());

    expect(result.current.loading).toBe(true);
    expect(result.current.access).toBeNull();
    await waitFor(() => expect(result.current.access?.days_remaining).toBe(45));
    expect(result.current.loading).toBe(false);
    expect(state.get).toHaveBeenCalledWith("/vault-qualification/access");
  });

  it("asks once however many components want to know (the card, the sidebar and the page all do)", async () => {
    state.get.mockResolvedValue({ access: access() });

    const a = renderHook(() => useVaultAiAccess());
    const b = renderHook(() => useVaultAiAccess());
    const c = renderHook(() => useVaultAiAccess());

    await waitFor(() => expect(a.result.current.access).not.toBeNull());
    await waitFor(() => expect(c.result.current.access).not.toBeNull());
    expect(b.result.current.access?.state).toBe("locked");
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it("reuses a fresh answer when another page mounts", async () => {
    state.get.mockResolvedValue({ access: access() });

    const first = renderHook(() => useVaultAiAccess());
    await waitFor(() => expect(first.result.current.access).not.toBeNull());
    first.unmount();

    const second = renderHook(() => useVaultAiAccess());

    expect(second.result.current.access?.days_remaining).toBe(45);
    expect(state.get).toHaveBeenCalledTimes(1);
  });

  it("asks again on demand", async () => {
    state.get.mockResolvedValueOnce({ access: access({ days_remaining: 45 }) }).mockResolvedValueOnce({ access: access({ days_remaining: 44 }) });

    const { result } = renderHook(() => useVaultAiAccess());
    await waitFor(() => expect(result.current.access?.days_remaining).toBe(45));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.access?.days_remaining).toBe(44);
  });

  it("does nothing when the programme has no AI interviews", () => {
    const { result } = renderHook(() => useVaultAiAccess(false));

    expect(state.get).not.toHaveBeenCalled();
    expect(result.current.access).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does not claim anything is locked when the request fails — the server is what refuses", async () => {
    state.get.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useVaultAiAccess());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.access).toBeNull();
  });

  it("never hands one student's countdown to the next account on the same tab", async () => {
    state.get.mockResolvedValueOnce({ access: access({ days_remaining: 10 }) }).mockResolvedValueOnce({ access: access({ state: "open", days_remaining: null, reasons: [] }) });

    const { result, rerender } = renderHook(() => useVaultAiAccess());
    await waitFor(() => expect(result.current.access?.days_remaining).toBe(10));

    state.userId = 2;
    rerender();

    expect(result.current.access).toBeNull();
    await waitFor(() => expect(result.current.access?.state).toBe("open"));
  });

  it("asks again at once when the college changes the student's year (the countdown must not wait out its minute)", async () => {
    state.get
      .mockResolvedValueOnce({ access: access({ study_year: 3, required_days: 90, days_remaining: 90 }) })
      .mockResolvedValueOnce({ access: access({ study_year: 4, required_days: 45, days_remaining: 45 }) });

    const { result } = renderHook(() => useVaultAiAccess());
    await waitFor(() => expect(result.current.access?.required_days).toBe(90));

    act(() => {
      window.dispatchEvent(new Event(ACADEMIC_CHANGED_EVENT));
    });

    await waitFor(() => expect(result.current.access?.required_days).toBe(45));
    expect(state.get).toHaveBeenCalledTimes(2);
  });
});
