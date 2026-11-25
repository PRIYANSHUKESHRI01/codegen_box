import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/dashboard/vault-interviews";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Candidate", role: "user" }, status: "ready" }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ categories: [] })),
    post: vi.fn(() => Promise.resolve({})),
  },
}));

import { AptBotWidget } from "@/components/chat/AptBotWidget";

afterEach(cleanup);

describe("AptBotWidget hook stability across navigation", () => {
  it("keeps hook order identical when navigating from vault-interviews to a /session route", () => {
    mockPathname = "/dashboard/vault-interviews";
    const { rerender, container } = render(<AptBotWidget />);
    expect(container.firstChild).not.toBeNull();

    mockPathname = "/dashboard/vault-interviews/session";
    expect(() => rerender(<AptBotWidget />)).not.toThrow();
    expect(container.firstChild).toBeNull();

    mockPathname = "/dashboard/vault-interviews";
    expect(() => rerender(<AptBotWidget />)).not.toThrow();
    expect(container.firstChild).not.toBeNull();
  });
});
