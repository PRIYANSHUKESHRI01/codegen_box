import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SuperAdminDrivesPanel } from "@/components/admin/superadmin/SuperAdminDrivesPanel";
import { DriveApplicantsModal } from "@/components/admin/superadmin/DriveApplicantsModal";
import { ScheduleCollegeDriveModal } from "@/components/admin/superadmin/ScheduleCollegeDriveModal";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public message: string, public status: number = 400) {
      super(message);
    }
  },
}));

vi.mock("@/lib/toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("@/lib/dialogs", () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/components/branches/BranchPicker", () => ({
  BranchPicker: ({ value, onChange }: any) => (
    <div data-testid="mock-branch-picker">
      <button type="button" onClick={() => onChange(["CSE", "IT"])}>
        Select Branches
      </button>
    </div>
  ),
}));

const mockDrives = [
  {
    id: 101,
    company_id: 1,
    title: "Google Campus Drive 2026",
    role_title: "Associate Software Engineer",
    ctc_range: "₹18 - ₹24 LPA",
    drive_date: "2026-12-01T10:00:00Z",
    interview_date: "2026-12-05T10:00:00Z",
    duration_minutes: 90,
    min_cgpa: "7.5",
    max_backlogs: 0,
    eligible_branches: ["CSE", "IT"],
    status: "published",
    applications_count: 24,
    owning_college: { id: 1, name: "Apex Institute of Tech", short_code: "AITR" },
    company: { id: 1, name: "Google", slug: "google", logo: null },
    college_mappings: [{ id: 1, college_id: 1, status: "approved", is_active: true, college: { id: 1, name: "Apex Institute of Tech", short_code: "AITR" } }],
  },
  {
    id: 102,
    company_id: 2,
    title: "Amazon Placement Drive",
    role_title: "Cloud Support Associate",
    ctc_range: "₹12 - ₹15 LPA",
    drive_date: "2026-12-10T10:00:00Z",
    interview_date: null,
    duration_minutes: 60,
    min_cgpa: "6.5",
    max_backlogs: 1,
    eligible_branches: null,
    status: "published",
    applications_count: 42,
    owning_college: null,
    company: { id: 2, name: "Amazon", slug: "amazon", logo: null },
    college_mappings: [{ id: 2, college_id: 2, status: "approved", is_active: true, college: { id: 2, name: "Beacon Engineering College", short_code: "BEC" } }],
  },
];

const mockColleges = [
  { id: 1, name: "Apex Institute of Tech", short_code: "AITR", city: "Indore", state: "MP" },
  { id: 2, name: "Beacon Engineering College", short_code: "BEC", city: "Pune", state: "MH" },
];

const mockCompanies = [
  { id: 1, name: "Google", slug: "google", logo: null, industry: "Technology", is_active: true, account_type: "catalog_only" },
  { id: 2, name: "Amazon", slug: "amazon", logo: null, industry: "Cloud", is_active: true, account_type: "catalog_only" },
];

describe("SuperAdmin Placement Drives Central Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/admin/placement-drives") {
        return Promise.resolve({ drives: mockDrives });
      }
      if (url === "/admin/partner-colleges") {
        return Promise.resolve({ colleges: mockColleges });
      }
      if (url === "/admin/companies") {
        return Promise.resolve({ companies: mockCompanies });
      }
      if (url.includes("/applications")) {
        return Promise.resolve({
          drive: { id: 101, title: "Google Campus Drive 2026" },
          applications: [
            {
              id: 1,
              user: { id: 11, name: "Priyanshu Sharma", email: "priyanshu@example.com", roll_number: "CS2026-01", branch: "CSE", cgpa: 8.9 },
              college: { id: 1, name: "Apex Institute of Tech", short_code: "AITR" },
              stage: "registered",
              stage_label: "Registered",
              registered_at: "2026-11-20T10:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve({});
    });
  });

  it("renders SuperAdmin drives table, KPIs, and college target scopes", async () => {
    render(<SuperAdminDrivesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Placement Drives Central Management")).toBeDefined();
    });

    expect(screen.getByText("Google Campus Drive 2026")).toBeDefined();
    expect(screen.getByText("Amazon Placement Drive")).toBeDefined();

    // Check KPIs: total drives 2, registered applicants 66 (24 + 42)
    expect(screen.getByText("66")).toBeDefined();
    expect(screen.getByText("Total Drives")).toBeDefined();

    // College badge: AITR
    expect(screen.getByText("AITR")).toBeDefined();
  });

  it("filters drives by text search", async () => {
    render(<SuperAdminDrivesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Google Campus Drive 2026")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Search drives by company/);
    fireEvent.change(searchInput, { target: { value: "Amazon" } });

    expect(screen.queryByText("Google Campus Drive 2026")).toBeNull();
    expect(screen.getByText("Amazon Placement Drive")).toBeDefined();
  });

  it("opens applicants modal and displays registered candidate details", async () => {
    render(<SuperAdminDrivesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Google Campus Drive 2026")).toBeDefined();
    });

    // Click on registered count "24"
    const viewButtons = screen.getAllByRole("button", { name: /View/i });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Registered Candidates — Google")).toBeDefined();
      expect(screen.getByText("Priyanshu Sharma")).toBeDefined();
      expect(screen.getByText("priyanshu@example.com")).toBeDefined();
    });
  });

  it("ScheduleCollegeDriveModal allows college-wise drive creation", async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <ScheduleCollegeDriveModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        colleges={mockColleges as any}
        companies={mockCompanies as any}
      />
    );

    expect(screen.getByText("Schedule Placement Drive (College-Wise)")).toBeDefined();
    expect(screen.getByText("Target Campus / College Scope")).toBeDefined();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/Campus Recruitment 2026/), {
      target: { value: "Microsoft Exclusive Drive" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Software Development Engineer/), {
      target: { value: "Software Engineer" },
    });

    (api.post as any).mockResolvedValue({ drive: { id: 200 } });

    const submitBtn = screen.getByRole("button", { name: /Schedule Drive/i });
    expect(submitBtn).toBeDefined();
  });
});
