import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CorePilotColleges } from "@/components/admin/core/CorePilotColleges";
import type { CoverageCollege, CoverageDiscipline } from "@/types/core";

const put = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { put: (path: string, body?: unknown) => put(path, body) } };
});

const discipline = (over: Partial<CoverageDiscipline> = {}): CoverageDiscipline =>
  ({
    discipline: "ece",
    name: "Electronics & Communication",
    is_live: false,
    live_at: null,
    stage: "pilot",
    pilots: [{ college_id: 1, name: "Apex Institute", students: 14 }],
    subjects: [],
    totals: { published: 0, test: 0, practice: 0, draft: 0, in_review: 0 },
    go_live: { ready: false, reasons: [], rules: { min_published: 150, min_subjects: 4, min_per_subject: 15 }, strong_subjects: 0 },
    ...over,
  }) as CoverageDiscipline;

const COLLEGES: CoverageCollege[] = [
  { id: 1, name: "Apex Institute", students: { ece: 14 } },
  { id: 2, name: "Beacon College", students: { ece: 3 } },
  { id: 3, name: "Beta Polytechnic", students: {} },
];

const mount = (d: CoverageDiscipline, editable = true) => {
  const onSaved = vi.fn();
  const onToast = vi.fn();
  render(<CorePilotColleges discipline={d} colleges={editable ? COLLEGES : null} editable={editable} onSaved={onSaved} onToast={onToast} />);
  return { onSaved, onToast };
};

beforeEach(() => {
  put.mockReset();
});
afterEach(() => {
  cleanup();
});

describe("CorePilotColleges", () => {
  it("lists the pilot colleges with how many students each reaches", () => {
    mount(discipline());

    expect(screen.getByText("Apex Institute")).toBeTruthy();
    expect(screen.getByText(/14 students/)).toBeTruthy();
  });

  it("adds a college by saving the whole list including the new one", async () => {
    put.mockResolvedValue({});
    const { onSaved } = mount(discipline());

    fireEvent.change(screen.getByLabelText("Add a pilot college"), { target: { value: "beac" } });
    fireEvent.click(await screen.findByRole("button", { name: /Beacon College/ }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/core/disciplines/ece/pilots", { college_ids: [1, 2] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("does not offer a college that is already piloting", () => {
    mount(discipline());

    fireEvent.change(screen.getByLabelText("Add a pilot college"), { target: { value: "apex" } });

    expect(screen.getByText(/No other college matches/)).toBeTruthy();
  });

  it("removes a college by saving the list without it", async () => {
    put.mockResolvedValue({});
    mount(discipline());

    fireEvent.click(screen.getByRole("button", { name: /Remove Apex Institute from the Electronics/ }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/core/disciplines/ece/pilots", { college_ids: [] }));
  });

  it("tells the superadmin when the save fails and keeps the list as it was", async () => {
    put.mockImplementation(() => Promise.reject(new Error("boom")));
    const { onSaved, onToast } = mount(discipline());

    fireEvent.click(screen.getByRole("button", { name: /Remove Apex Institute/ }));

    await waitFor(() => expect(onToast).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("is read-only for staff who cannot change rollout", () => {
    mount(discipline(), false);

    expect(screen.getByText("Apex Institute")).toBeTruthy();
    expect(screen.queryByLabelText("Add a pilot college")).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("says so when there is no pilot, and hides entirely for a live branch that never had one", () => {
    const { onSaved } = mount(discipline({ stage: "off", pilots: [] }));
    expect(screen.getByText(/hidden from every student/i)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();

    cleanup();
    const { container } = render(<CorePilotColleges discipline={discipline({ is_live: true, stage: "live", pilots: [] })} colleges={COLLEGES} editable onSaved={vi.fn()} onToast={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
