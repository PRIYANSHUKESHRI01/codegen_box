import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { pageWindow } from "@/components/admin/mellow/ListPagination";
import { compareColleges, mapCollegeFromApi, type ApiCollege } from "@/components/admin/mellow/partnerColleges";

const get = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const toast = vi.fn();

/** n colleges named "College 001" … with spread-out students, plans and tiers, so every sort and filter has something to do. */
function makeColleges(n: number): ApiCollege[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `College ${String(i + 1).padStart(3, "0")}`,
    short_code: `C${i + 1}`,
    city: i % 2 === 0 ? "Dehradun" : "Pune",
    state: null,
    tier: (i % 3 === 0 ? "Pro Campus" : "Standard") as ApiCollege["tier"],
    placement_rate: String(i % 100),
    is_active: true,
    active_students_count: i * 3,
    created_at: new Date(2026, 0, 1 + i).toISOString(),
    users: [{ id: 1000 + i, name: `TPO ${i + 1}`, email: `tpo${i + 1}@x.test`, is_blocked: false }],
    subscription_days_remaining: i === 4 ? null : 400 - i,
    subscription_status: "active",
    subscription_is_trial: false,
    plan_max_students: 500,
    departments: i % 4 === 0 ? ["engineering", "management"] : ["engineering"],
  }));
}

const names = () => screen.getAllByTestId("college-row").map((r) => within(r).getAllByText(/^College \d{3}$/)[0].textContent);

beforeEach(() => {
  get.mockReset();
  toast.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe("a hundred colleges", () => {
  beforeEach(() => get.mockResolvedValue({ colleges: makeColleges(100) }));

  it("shows one page of the list, newest onboarded first, and says how many there are", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    expect(screen.getAllByTestId("college-row")).toHaveLength(24);
    expect(names()[0]).toBe("College 100");
    expect(screen.getByText(/1–24 of 100/)).toBeTruthy();
  });

  it("pages forward and back, and changes the page size (remembered for next time)", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText(/25–48 of 100/)).toBeTruthy();
    expect(names()[0]).toBe("College 076");

    fireEvent.change(screen.getByLabelText("Per page"), { target: { value: "48" } });
    expect(screen.getAllByTestId("college-row")).toHaveLength(48);
    expect(screen.getByText(/1–48 of 100/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("aptrun:partner-colleges-view") ?? "{}").pageSize).toBe(48);
  });

  it("sorts by a column header, and flips direction on the second click", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    fireEvent.click(screen.getByRole("button", { name: /^college$/i }));
    expect(names()[0]).toBe("College 001");

    fireEvent.click(screen.getByRole("button", { name: /^college$/i }));
    expect(names()[0]).toBe("College 100");

    fireEvent.click(screen.getByRole("button", { name: /^students$/i }));
    expect(names()[0]).toBe("College 100");
  });

  it("puts a college with no running plan first when sorting by plan expiry (the most urgent row)", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    fireEvent.click(screen.getByRole("button", { name: /^plan$/i }));
    expect(names()[0]).toBe("College 005");
  });

  it("filters by plan state, plan tier and search together, and clears them", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    fireEvent.click(screen.getByRole("button", { name: /no plan/i }));
    expect(screen.getAllByTestId("college-row")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /^all/i }));
    fireEvent.change(screen.getByLabelText("Filter by plan"), { target: { value: "Pro Campus" } });
    expect(screen.getByText(/1–24 of 34/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search universities"), { target: { value: "pune" } });
    // Pro Campus is every third college (0,3,6…) and Pune is every odd one: 3, 9, 15 … 99.
    expect(screen.getByText(/1–17 of 17/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByText(/1–24 of 100/)).toBeTruthy();
  });

  it("switches to compact cards, pages them the same way, and remembers the choice", async () => {
    const { unmount } = render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findAllByTestId("college-row");

    fireEvent.click(screen.getByRole("button", { name: /cards/i }));
    expect(screen.queryByTestId("college-table")).toBeNull();
    expect(screen.getAllByTestId("college-card")).toHaveLength(24);
    unmount();

    render(<PartnerCollegesPanel triggerToast={toast} />);
    expect((await screen.findAllByTestId("college-card")).length).toBe(24);
  });
});

describe("the Manage menu", () => {
  it("opens with the keyboard, moves with the arrows, selects with Enter and closes on Escape", () => {
    const onA = vi.fn();
    const onB = vi.fn();
    render(
      <ActionMenu
        label="Manage"
        groups={[
          [{ key: "a", label: "First", onSelect: onA }],
          [{ key: "b", label: "Second", onSelect: onB }, false, null],
        ]}
      />
    );

    const trigger = screen.getByRole("button", { name: /manage/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getAllByRole("menuitem")[1]);
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onA).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on an outside click", () => {
    render(<ActionMenu label="Manage" groups={[[{ key: "a", label: "First", onSelect: vi.fn() }]]} />);
    fireEvent.click(screen.getByRole("button", { name: /manage/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders nothing when it has no items to offer", () => {
    const { container } = render(<ActionMenu label="Manage" groups={[[false, null]]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("helpers", () => {
  it("pageWindow keeps the first, last and neighbours, and marks the gaps", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, "gap", 10]);
  });

  it("compareColleges breaks ties by name so the order never shuffles", () => {
    const [a, b] = makeColleges(2).map((c) => ({ ...mapCollegeFromApi(c), placementRate: 50 }));
    expect(compareColleges(a, b, "placement", "desc")).toBeLessThan(0);
    expect(compareColleges(b, a, "placement", "desc")).toBeGreaterThan(0);
  });
});
