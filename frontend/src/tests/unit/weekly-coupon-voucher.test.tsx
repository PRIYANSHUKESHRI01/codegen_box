import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AwardCouponModal } from "@/components/admin/superadmin/rewards/AwardCouponModal";
import { VoucherRevealModal } from "@/components/leaderboard/VoucherRevealModal";
import type { AdminStanding, MyWin } from "@/types/weeklyRewards";

const post = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    post: (...args: unknown[]) => post(...args),
  },
  ApiError: class ApiError extends Error {},
}));

describe("AwardCouponModal", () => {
  const triggerToast = vi.fn();
  const onSuccess = vi.fn();
  const onClose = vi.fn();

  const mockStudent = {
    id: 101,
    name: "Rahul Verma",
    handle: "rahulv",
    email: "rahul@example.com",
    college: "IIT Bombay",
    rank: 1,
    contest_score: 850,
    initialCard: "dominos",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders student details and awards coupon on submit", async () => {
    post.mockResolvedValueOnce({
      winner: {
        id: 77,
        status: "sent",
        brand: "Domino's",
        voucher_code: "DOM-FREE-999",
      },
    });

    render(
      <AwardCouponModal
        student={mockStudent}
        weekKey="2026-11-16"
        onClose={onClose}
        onSuccess={onSuccess}
        triggerToast={triggerToast}
      />
    );

    // Displays name and email
    expect(screen.getByText("Rahul Verma")).toBeDefined();
    expect(screen.getByText("rahul@example.com")).toBeDefined();
    expect(screen.getAllByText(/Rank #1/).length).toBeGreaterThan(0);

    // Type coupon code
    const couponInput = screen.getByLabelText(/Coupon Code/i);
    fireEvent.change(couponInput, { target: { value: "DOM-FREE-999" } });

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /Give Coupon to Student/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        "/superadmin/weekly-rewards/give-coupon",
        expect.objectContaining({
          user_id: 101,
          week: "2026-11-16",
          rank: 1,
          voucher_code: "DOM-FREE-999",
        })
      );
      expect(triggerToast).toHaveBeenCalledWith(
        expect.stringContaining("Domino's voucher awarded to Rahul Verma")
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});

describe("VoucherRevealModal", () => {
  const onClose = vi.fn();
  const mockWin: MyWin = {
    id: 55,
    week_key: "2026-11-16",
    rank: 1,
    brand: "Domino's",
    amount: 299,
    logo: "/rewards/dominos.svg",
    color: "#006491",
    status: "sent",
    voucher_code: "DOM-WIN-2026",
    sent_at: "2026-11-20T10:00:00Z",
  };

  it("unseals voucher on open click and reveals coupon code", async () => {
    render(<VoucherRevealModal win={mockWin} onClose={onClose} />);

    // Starts unopened with reveal button
    const openBtn = screen.getByRole("button", { name: /Open Voucher & Reveal Code/i });
    expect(openBtn).toBeDefined();

    // Click to open
    fireEvent.click(openBtn);

    // Code is now displayed
    expect(await screen.findByText("DOM-WIN-2026")).toBeDefined();
    expect(screen.getByText(/Voucher Unlocked/i)).toBeDefined();
    expect(screen.getByText(/How to use your Domino's coupon/i)).toBeDefined();
  });
});
