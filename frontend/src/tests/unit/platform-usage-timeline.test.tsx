import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PlatformUsageTimelineGraph } from "@/components/admin/superadmin/PlatformUsageTimelineGraph";
import { api } from "@/lib/api";
import type { UsageTimelineResponse } from "@/types/activity";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockTodayData: UsageTimelineResponse = {
  period: "today",
  selected_date: "2026-11-23",
  date_formatted: "Monday, 23 Nov 2026",
  timezone: "Asia/Kolkata",
  view_mode: "hourly",
  kpis: {
    unique_users: 14,
    total_visits: 25,
    total_minutes: 180,
    total_hours: 3.0,
    avg_minutes_per_user: 12.9,
    interviews_completed: 4,
    interviews_total: 5,
    submissions_total: 18,
    sign_ins_total: 22,
    peak_metric_label: "Peak: 2 PM (6 active users)",
  },
  graph: [
    {
      time_key: "2026-11-23 00:00",
      label: "12 AM",
      full_label: "12 AM - 1 AM",
      users: 1,
      visits: 1,
      minutes: 10,
      actions: 0,
      interviews: 0,
      submissions: 0,
      sign_ins: 1,
    },
    {
      time_key: "2026-11-23 14:00",
      label: "2 PM",
      full_label: "2 PM - 3 PM",
      users: 6,
      visits: 8,
      minutes: 70,
      actions: 5,
      interviews: 2,
      submissions: 3,
      sign_ins: 4,
    },
  ],
  available_range: {
    min_date: "2026-09-01",
    max_date: "2026-11-23",
  },
};

const mockMonthData: UsageTimelineResponse = {
  period: "this_month",
  selected_date: "2026-11-23",
  date_formatted: "01 Nov – 23 Nov 2026",
  timezone: "Asia/Kolkata",
  view_mode: "daily",
  kpis: {
    unique_users: 42,
    total_visits: 95,
    total_minutes: 1240,
    total_hours: 20.7,
    avg_minutes_per_user: 29.5,
    interviews_completed: 15,
    interviews_total: 18,
    submissions_total: 65,
    sign_ins_total: 110,
    peak_metric_label: "Peak: Fri, 20 Nov (14 active users)",
  },
  graph: [
    {
      time_key: "2026-11-20",
      label: "Fri 20",
      full_label: "Friday, 20 Nov 2026",
      users: 14,
      visits: 25,
      minutes: 320,
      actions: 22,
      interviews: 6,
      submissions: 16,
      sign_ins: 20,
    },
    {
      time_key: "2026-11-21",
      label: "Sat 21",
      full_label: "Saturday, 21 Nov 2026",
      users: 8,
      visits: 12,
      minutes: 150,
      actions: 10,
      interviews: 2,
      submissions: 8,
      sign_ins: 10,
    },
  ],
  available_range: {
    min_date: "2026-09-01",
    max_date: "2026-11-23",
  },
};

describe("PlatformUsageTimelineGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue(mockTodayData);
  });

  it("renders the title, excluding superadmin badge, and KPIs for today", async () => {
    render(<PlatformUsageTimelineGraph defaultPeriod="today" />);

    await waitFor(() => {
      expect(screen.getByText(/Platform Usage & Traffic Graph/i)).toBeTruthy();
      expect(screen.getAllByText(/Excluding Superadmin/i).length).toBeGreaterThan(0);
      expect(screen.getByText("14")).toBeTruthy(); // active users
      expect(screen.getByText(/Peak: 2 PM \(6 active users\)/i)).toBeTruthy();
    });

    expect(api.get).toHaveBeenCalledWith("/superadmin/activity/usage-timeline?period=today");
  });

  it("switches to This Month when clicked", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.includes("period=this_month")) return Promise.resolve(mockMonthData);
      return Promise.resolve(mockTodayData);
    });

    render(<PlatformUsageTimelineGraph defaultPeriod="today" />);

    await waitFor(() => {
      expect(screen.getByText("14")).toBeTruthy();
    });

    const monthBtn = screen.getByRole("button", { name: /This Month/i });
    fireEvent.click(monthBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/superadmin/activity/usage-timeline?period=this_month");
      expect(screen.getByText("42")).toBeTruthy(); // 42 users for month
      expect(screen.getByText(/Fri 20/i)).toBeTruthy();
    });
  });

  it("switches to custom day when date input changes", async () => {
    render(<PlatformUsageTimelineGraph defaultPeriod="today" />);

    await waitFor(() => {
      expect(screen.getByText(/Platform Usage & Traffic Graph/i)).toBeTruthy();
    });

    const datePicker = screen.getByLabelText(/Pick Day:/i);
    fireEvent.change(datePicker, { target: { value: "2026-11-21" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/superadmin/activity/usage-timeline?period=day&date=2026-11-21");
    });
  });

  it("toggles metric mode between Users, Minutes, and Sessions", async () => {
    render(<PlatformUsageTimelineGraph defaultPeriod="today" />);

    await waitFor(() => {
      expect(screen.getByText("14")).toBeTruthy();
    });

    const minsBtn = screen.getByRole("button", { name: /Time Spent \(Mins\)/i });
    fireEvent.click(minsBtn);

    expect(minsBtn.className).toContain("bg-primary");
  });
});
