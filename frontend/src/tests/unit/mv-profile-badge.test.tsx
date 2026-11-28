import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MvProfileBadge } from "@/components/admin/superadmin/MvProfileBadge";

afterEach(() => {
  cleanup();
});

describe("MvProfileBadge", () => {
  it("renders null / AptRun Only for AptRun-native users instead of 0%", () => {
    render(
      <MvProfileBadge
        user={{
          role: "user",
          is_mellow_vault_user: false,
          account_origin: "aptrun",
          mv_profile_percentage: null,
          mv_skill: null,
          mellow_vault_profile_percent: null,
        }}
      />
    );

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("AptRun Only")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("renders MV percentage, skill stack, and Invited pill for >=90% Mellow Vault students", () => {
    render(
      <MvProfileBadge
        user={{
          role: "user",
          is_mellow_vault_user: true,
          account_origin: "mellow_vault",
          mv_profile_percentage: 94,
          mv_skill: "ReactJS, TypeScript",
          mellow_vault_stack_name: "React Developer",
          vault_ai_invite_sent_at: "2026-11-28T06:00:00Z",
        }}
      />
    );

    expect(screen.getByText("94%")).toBeTruthy();
    expect(screen.getByText("Mellow Vault")).toBeTruthy();
    expect(screen.getByText("Invited")).toBeTruthy();
    expect(screen.getByText("React Developer")).toBeTruthy();
  });

  it("falls back to raw mv_skill when stack mapping name is absent", () => {
    render(
      <MvProfileBadge
        user={{
          role: "user",
          mv_profile_percentage: 72,
          mv_skill: "Flutter & Dart",
          mellow_vault_stack_name: null,
        }}
      />
    );

    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByText("Mellow Vault")).toBeTruthy();
    expect(screen.getByText("Flutter & Dart")).toBeTruthy();
  });
});
