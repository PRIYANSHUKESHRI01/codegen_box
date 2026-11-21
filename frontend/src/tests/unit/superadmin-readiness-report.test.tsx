import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadinessReportModal } from "@/components/admin/superadmin/ReadinessReportModal";
import { StudentsPanel } from "@/components/admin/superadmin/StudentsPanel";
import { downloadApiFile } from "@/lib/download";

const get = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

vi.mock("@/lib/download", () => ({
  downloadApiFile: vi.fn().mockResolvedValue(undefined),
}));

const toast = vi.fn();

const mockSummary = {
  total: 150,
  above_50_count: 95,
  placement_ready_count: 40,
  in_progress_count: 55,
  needs_training_count: 55,
  average_score: 58.2,
};

describe("ReadinessReportModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockImplementation((path: string) => {
      if (path.includes("/superadmin/students/readiness-summary")) {
        return Promise.resolve(mockSummary);
      }
      return Promise.resolve({});
    });
  });

  afterEach(cleanup);

  it("loads and displays cohort summary counts, defaulting to above 50% preset", async () => {
    render(<ReadinessReportModal onClose={onClose} triggerToast={toast} />);

    // Live summary counts appear
    const matches = await screen.findAllByText("95");
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/Above 50% Readiness/)).toBeDefined();

    // Default download button downloads above-50 report
    const downloadBtn = screen.getByRole("button", { name: /Download Report/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadApiFile).toHaveBeenCalledWith(
        expect.stringContaining("/superadmin/students/readiness-export?min_score=50"),
        "aptrun-students-readiness-above-50-percent.csv"
      );
      expect(toast).toHaveBeenCalledWith(expect.stringContaining("downloaded successfully"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("allows switching to Placement Ready (≥ 75%) preset", async () => {
    render(<ReadinessReportModal onClose={onClose} triggerToast={toast} />);

    await screen.findAllByText("95");
    const placementPresetBtn = screen.getByRole("button", { name: /Placement Ready \(≥ 75%\)/i });
    fireEvent.click(placementPresetBtn);

    const downloadBtn = screen.getByRole("button", { name: /Download Report/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadApiFile).toHaveBeenCalledWith(
        expect.stringContaining("min_score=75"),
        "aptrun-placement-ready-students-report.csv"
      );
    });
  });

  it("allows setting a custom score threshold", async () => {
    render(<ReadinessReportModal onClose={onClose} triggerToast={toast} />);

    await screen.findAllByText("95");
    const customBtn = screen.getByRole("button", { name: /Custom Range/i });
    fireEvent.click(customBtn);

    const minInput = screen.getByLabelText(/Minimum Score/i);
    fireEvent.change(minInput, { target: { value: "60" } });

    const downloadBtn = screen.getByRole("button", { name: /Download Report/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(downloadApiFile).toHaveBeenCalledWith(
        expect.stringContaining("min_score=60"),
        "aptrun-students-readiness-min-60-percent.csv"
      );
    });
  });
});
