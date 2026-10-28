import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";

const calls = vi.hoisted(() => ({ patch: vi.fn() }));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { patch: calls.patch } };
});
vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {children}
      {footer}
    </div>
  ),
}));
vi.mock("@/components/portal/cohortKit", () => ({ HpOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import { EditStudentModal, SetSectionModal, UnfiledStudentsPanel } from "@/components/dashboard/tpo/cohortEdit";

afterEach(cleanup);
beforeEach(() => calls.patch.mockReset());

const student = (over: Partial<CohortStudent> = {}) => ({ id: 7, name: "Alex Chen", study_year: 3, year_label: "3rd year", section: "A", ...over }) as unknown as CohortStudent;

describe("EditStudentModal", () => {
  const open = (s = student(), onSaved = vi.fn(), onClose = vi.fn()) => {
    render(<EditStudentModal student={s} sections={["A", "B", "C"]} onClose={onClose} onSaved={onSaved} />);
    return { onSaved, onClose };
  };

  it("starts on the student's current year and section, with nothing to save yet", () => {
    open();

    expect(screen.getByRole("radio", { name: "3rd year" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Section") as HTMLInputElement).value).toBe("A");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers the sections already in use", () => {
    open();

    expect(Array.from(document.querySelectorAll("datalist option")).map((o) => o.getAttribute("value"))).toEqual(["A", "B", "C"]);
  });

  it("changes only the year when only the year was touched, and hands back the refreshed row", async () => {
    calls.patch.mockResolvedValue({ student: student({ study_year: 4, year_label: "4th year" }) });
    const { onSaved } = open();

    fireEvent.click(screen.getByRole("radio", { name: "4th year" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.patch).toHaveBeenCalledTimes(1));
    expect(calls.patch).toHaveBeenCalledWith("/tpo/students/7", { year: 4 });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ study_year: 4 })));
  });

  it("changes only the section when only the section was touched, trimmed", async () => {
    calls.patch.mockResolvedValue({ student: student({ section: "B" }) });
    open();

    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "  B " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.patch).toHaveBeenCalledWith("/tpo/students/7", { section: "B" }));
  });

  it("can change both at once", async () => {
    calls.patch.mockResolvedValue({ student: student() });
    open();

    fireEvent.click(screen.getByRole("radio", { name: "2nd year" }));
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.patch).toHaveBeenCalledWith("/tpo/students/7", { year: 2, section: "C" }));
  });

  it("takes a student back to 'not set' and out of their section", async () => {
    calls.patch.mockResolvedValue({ student: student({ study_year: null, section: null }) });
    open();

    fireEvent.click(screen.getByRole("radio", { name: "Not set" }));
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.patch).toHaveBeenCalledWith("/tpo/students/7", { year: null, section: null }));
  });

  it("starts a student with no year on 'Not set', so saving a section alone does not invent one", async () => {
    calls.patch.mockResolvedValue({ student: student({ study_year: null }) });
    open(student({ study_year: null, year_label: null }));

    expect(screen.getByRole("radio", { name: "Not set" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.patch).toHaveBeenCalledWith("/tpo/students/7", { section: "B" }));
  });

  it("explains a student who is past their final year", () => {
    open(student({ study_year: 5, year_label: "Passed out" }));

    expect(screen.getByText(/past their final year/i)).toBeTruthy();
  });

  it("shows the server's reason and lets the TPO try again", async () => {
    calls.patch.mockRejectedValueOnce(new ApiError("Your account is not linked to a college.", 422));
    open();

    fireEvent.click(screen.getByRole("radio", { name: "4th year" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Your account is not linked to a college.")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(false));
  });
});

describe("SetSectionModal", () => {
  it("moves the selection to the typed section", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SetSectionModal count={3} sections={["A", "B"]} onClose={() => undefined} onConfirm={onConfirm} />);

    expect(screen.getByText("3 students selected")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Which section?"), { target: { value: " B " } });
    fireEvent.click(screen.getByRole("button", { name: "Move to section B" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("B"));
  });

  it("takes them out of their section when left empty, and says so on the button", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SetSectionModal count={1} sections={[]} onClose={() => undefined} onConfirm={onConfirm} />);

    expect(screen.getByText("1 student selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove from their section" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(null));
  });

  it("shows why it failed", async () => {
    render(<SetSectionModal count={2} sections={[]} onClose={() => undefined} onConfirm={vi.fn().mockRejectedValue(new Error("Nope."))} />);

    fireEvent.change(screen.getByLabelText("Which section?"), { target: { value: "A" } });
    fireEvent.click(screen.getByRole("button", { name: "Move to section A" }));

    await waitFor(() => expect(screen.getByText("Nope.")).toBeTruthy());
  });
});

describe("UnfiledStudentsPanel", () => {
  it("offers to move everyone shown into each year", () => {
    const onAssign = vi.fn();
    render(<UnfiledStudentsPanel count={5} onAssign={onAssign} />);

    expect(screen.getByText("Add these 5 students to a year")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move all 5 to 3rd year" }));

    expect(onAssign).toHaveBeenCalledWith(3);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Move all 5 to 1st year", "Move all 5 to 2nd year", "Move all 5 to 3rd year", "Move all 5 to 4th year"]);
  });

  it("speaks of one student in the singular", () => {
    render(<UnfiledStudentsPanel count={1} onAssign={() => undefined} />);

    expect(screen.getByText("Add this student to a year")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Move to 4th year" })).toBeTruthy();
  });
});
