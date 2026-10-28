import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  postFormData: vi.fn(),
  getFile: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { post: calls.post, get: calls.get, postFormData: calls.postFormData, getFile: calls.getFile } };
});
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, role: "admin_tpo" } }) }));
vi.mock("@/lib/branches", async () => {
  const actual = await vi.importActual<typeof import("@/lib/branches")>("@/lib/branches");
  return { ...actual, useBranchCatalog: () => null };
});
vi.mock("@/lib/departments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/departments")>("@/lib/departments");
  return { ...actual, useDepartmentScope: () => ({ scope: "ALL", multiple: false }) };
});
vi.mock("@/components/branches/DepartmentPicker", () => ({
  useCollegeDepartments: () => ({ departments: [], loading: false }),
  DepartmentPicker: () => null,
}));
vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock("@/components/portal/cohortKit", () => ({ HpOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { AddStudentModal } from "@/components/dashboard/tpo/AddStudentModal";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";

afterEach(cleanup);
beforeEach(() => {
  calls.post.mockReset();
  calls.get.mockReset();
  calls.postFormData.mockReset();
  calls.get.mockResolvedValue({ imports: [] });
});

describe("Add Student asks for the year", () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: "Ananya Iyer" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "ananya@college.edu" } });
  };

  it("cannot be submitted until a year is chosen", () => {
    render(<AddStudentModal open onClose={() => undefined} onAdded={() => undefined} />);
    fill();

    const submit = screen.getByRole("button", { name: /Add & Send Credentials/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole("radio", { name: "3rd year" }));
    expect(submit.disabled).toBe(false);
  });

  it("offers 1st to 4th year", () => {
    render(<AddStudentModal open onClose={() => undefined} onAdded={() => undefined} />);

    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["1st year", "2nd year", "3rd year", "4th year"]);
  });

  it("sends the year with the student", async () => {
    calls.post.mockResolvedValue({ student: { id: 9, name: "Ananya Iyer", email: "ananya@college.edu", study_year: 3 } });
    const onAdded = vi.fn();
    render(<AddStudentModal open onClose={() => undefined} onAdded={onAdded} />);
    fill();
    fireEvent.click(screen.getByRole("radio", { name: "3rd year" }));

    fireEvent.click(screen.getByRole("button", { name: /Add & Send Credentials/ }));

    await waitFor(() => expect(calls.post).toHaveBeenCalledTimes(1));
    expect(calls.post.mock.calls[0][0]).toBe("/tpo/students");
    expect(calls.post.mock.calls[0][1]).toMatchObject({ name: "Ananya Iyer", email: "ananya@college.edu", year: 3 });
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });

  it("explains what the year is for", () => {
    render(<AddStudentModal open onClose={() => undefined} onAdded={() => undefined} />);

    expect(screen.getByText(/4th year after 45 days on AptRun, 3rd year after 90/)).toBeTruthy();
  });
});

describe("Bulk import files a whole roster under a year", () => {
  const upload = async (year?: string) => {
    calls.postFormData.mockResolvedValue({ import: { id: 5, original_filename: "roster.csv", status: "pending", total_rows: 0, processed_rows: 0, successful_rows: 0, failed_rows: 0, errors: null, created_at: new Date().toISOString() } });
    render(<BulkImportStudentsPanel collegeName="Test College" variant="premium" />);
    await waitFor(() => expect(calls.get).toHaveBeenCalled());

    if (year) fireEvent.click(screen.getByRole("radio", { name: year }));
    const file = new File(["name,email\nA,a@c.test\n"], "roster.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Choose a student Excel or CSV file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Upload & Import/ }));

    await waitFor(() => expect(calls.postFormData).toHaveBeenCalledTimes(1));
    return calls.postFormData.mock.calls[0][1] as FormData;
  };

  it("sends the chosen year with the file", async () => {
    const form = await upload("4th year");

    expect(form.get("year")).toBe("4");
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("sends no year when the file carries its own year column", async () => {
    const form = await upload();

    expect(form.has("year")).toBe(false);
  });

  it("starts on 'my file has a year column' rather than guessing a year", async () => {
    render(<BulkImportStudentsPanel collegeName="Test College" variant="premium" />);
    await waitFor(() => expect(calls.get).toHaveBeenCalled());

    expect(screen.getByRole("radio", { name: "My file has a year column" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/put a year \(1st, 2nd, 3rd, 4th\) in each row/)).toBeTruthy();
  });

  it("warns that a contradicting row will be skipped once a year is chosen", async () => {
    render(<BulkImportStudentsPanel collegeName="Test College" variant="premium" />);
    await waitFor(() => expect(calls.get).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("radio", { name: "3rd year" }));

    expect(screen.getByText(/Everyone in this file is filed under 3rd year/)).toBeTruthy();
  });

  it("names the year on each past import", async () => {
    calls.get.mockResolvedValue({
      imports: [{ id: 1, original_filename: "third-years.xlsx", study_year: 3, status: "completed", total_rows: 10, processed_rows: 10, successful_rows: 10, failed_rows: 0, errors: null, created_at: "2026-10-20T10:00:00Z" }],
    });
    render(<BulkImportStudentsPanel collegeName="Test College" variant="premium" />);

    await waitFor(() => expect(screen.getByText("third-years.xlsx")).toBeTruthy());
    expect(screen.getByText(/3rd year/, { selector: "p" })).toBeTruthy();
  });
});
