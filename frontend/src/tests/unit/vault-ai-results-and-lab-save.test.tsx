import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultAiResultsCard } from "@/components/dashboard/vaultAi/VaultAiResultsCard";
import { VaultAiResultsList } from "@/components/admin/vault/VaultAiResultsList";
import { SubmitDialog } from "@/components/dashboard/projectLab/SubmitDialog";
import { SubmissionFilesPanel } from "@/components/admin/projectLab/SubmissionFilesPanel";
import type { EnrollmentData } from "@/types/projectLab";

const get = vi.fn();
const post = vi.fn();
const getFile = vi.fn();
const download = vi.fn();
const saveBlob = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (p: string) => get(p), post: (p: string, b?: unknown) => post(p, b), getFile: (p: string) => getFile(p), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});
vi.mock("@/lib/reportDocuments", () => ({ downloadStoredReport: (p: string, f: string) => download(p, f), saveBlob: (b: Blob, f: string) => saveBlob(b, f) }));
vi.mock("@/components/dashboard/vaultAi/vaultKit", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ScoreRing: ({ children, label }: { children: React.ReactNode; label: string }) => <div aria-label={label}>{children}</div>,
}));
vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div role="dialog" aria-label={title}>
      {children}
      {footer}
    </div>
  ),
}));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  getFile.mockReset();
  download.mockReset();
  saveBlob.mockReset();
});
afterEach(cleanup);

const result = (over: Record<string, unknown> = {}) => ({
  id: 5,
  stack_key: "laravel",
  stack_name: "Laravel (PHP)",
  role_key: "backend",
  status: "qualified",
  qualified: true,
  ever_qualified: true,
  pass_mark: 60,
  best_average: 78.33,
  best_scores: { "1": 70, "2": 80, "3": 85 },
  best_series: 2,
  best_at: "2026-11-02T10:00:00Z",
  last_average: 78.33,
  last_at: "2026-11-02T10:00:00Z",
  attempts: 2,
  history: [
    { series: 1, scores: { "1": 40, "2": 50, "3": 45 }, average: 45, passed: false, at: "2026-10-30T10:00:00Z", source: "interview", reset: false, is_best: false },
    { series: 2, scores: { "1": 70, "2": 80, "3": 85 }, average: 78.33, passed: true, at: "2026-11-02T10:00:00Z", source: "interview", reset: false, is_best: true },
  ],
  report_id: "01HREPORT",
  report_generated_at: "2026-11-02T10:01:00Z",
  ...over,
});

describe("the student's Vault AI results", () => {
  it("shows the final average of the best series, the three set scores and the attempts, and downloads the stored PDF", async () => {
    get.mockResolvedValue({ pass_mark: 60, results: [result()] });
    render(<VaultAiResultsCard />);

    expect(await screen.findByText("Laravel (PHP)")).toBeTruthy();
    expect(screen.getByLabelText("Laravel (PHP) final average").textContent).toBe("78.3%");
    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.getByText(/2 attempts/)).toBeTruthy();
    const sets = within(screen.getByLabelText("Set scores of your best series"));
    expect(sets.getByText(/Set 1/).textContent).toContain("70%");
    expect(sets.getByText(/Set 3/).textContent).toContain("85%");
    expect(screen.getByText(/your best series/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Download report \(PDF\)/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("/me/reports/01HREPORT/download", expect.stringContaining("laravel")));
    expect(post).not.toHaveBeenCalled();
  });

  it("creates the report first when there is none yet", async () => {
    get.mockResolvedValue({ pass_mark: 60, results: [result({ report_id: null, report_generated_at: null })] });
    post.mockResolvedValue({ report: { id: "01HNEW", filename: "AptRun-Vault-AI-laravel.pdf", size_bytes: 1, pages: 2 }, result: result() });
    render(<VaultAiResultsCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Create my report/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/me/vault-ai/results/laravel/report", undefined));
    await waitFor(() => expect(download).toHaveBeenCalledWith("/me/reports/01HNEW/download", "AptRun-Vault-AI-laravel.pdf"));
  });

  it("draws nothing until a series has been completed", async () => {
    get.mockResolvedValue({ pass_mark: 60, results: [] });
    const { container } = render(<VaultAiResultsCard />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/me/vault-ai/results"));
    expect(container.innerHTML).toBe("");
  });
});

const row = () => ({
  ...result(),
  student: { id: 31, name: "Asha Rao", email: "asha@apex.test", roll_number: "A-12", branch: "CSE", section: "A" },
  college: "Apex Institute",
  college_id: 1,
});

const list = (rows: Record<string, unknown>[] = [row()]) => ({
  total: rows.length,
  page: 1,
  per_page: 25,
  pass_mark: 60,
  totals: { results: rows.length, students: rows.length, qualified: 1, average: 78.3 },
  stacks: [{ key: "laravel", name: "Laravel (PHP)", count: rows.length }],
  rows,
});

describe("the college's Vault AI results list", () => {
  it("lists each student's final average and set scores with their PDF, from the college's own endpoint", async () => {
    get.mockResolvedValue(list());
    const toast = vi.fn();
    render(<VaultAiResultsList scope="tpo" triggerToast={toast} />);

    expect(await screen.findByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("A-12 · CSE · Sec A")).toBeTruthy();
    expect(screen.getAllByText("78.3%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("70% · 80% · 85%")).toBeTruthy();
    expect(screen.queryByText("Apex Institute")).toBeNull();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/tpo\/vault-ai\/results\?/));

    fireEvent.click(screen.getByRole("button", { name: /PDF/ }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("/tpo/reports/01HREPORT/download", expect.any(String)));
  });

  it("shows the college column for Mellow's team and filters through the server", async () => {
    get.mockResolvedValue(list());
    render(<VaultAiResultsList scope="platform" triggerToast={vi.fn()} />);

    expect(await screen.findByText("Apex Institute")).toBeTruthy();
    expect(get).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/vault-ai\/results\?/));

    fireEvent.change(screen.getByLabelText("Result"), { target: { value: "qualified" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("status=qualified")));
  });

  it("generates a missing report before downloading it", async () => {
    get.mockResolvedValue(list([{ ...row(), report_id: null, report_generated_at: null }]));
    post.mockResolvedValue({ report: { id: "01HGEN", filename: "r.pdf", size_bytes: 1, pages: 1 } });
    render(<VaultAiResultsList scope="tpo" triggerToast={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Generate/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/tpo/vault-ai/results/5/report", undefined));
    await waitFor(() => expect(download).toHaveBeenCalledWith("/tpo/reports/01HGEN/download", "r.pdf"));
  });
});

// ─────────────────────────────────────────────────────────────────────────── Project Lab

const enrollment = { id: 9, topic: { title: "Library system" }, progress: { done: 2, total: 5 } } as unknown as EnrollmentData;

const save = (id: number, over: Record<string, unknown> = {}) => ({ id, saved_at: "2026-11-04T09:00:00Z", size_bytes: 20480, files: 12, milestones_done: 2, milestones_total: 5, imported_files: 0, archives: 0, ...over });

describe("Project Lab: save and submit from the editor", () => {
  const dialog = (props: Partial<React.ComponentProps<typeof SubmitDialog>> = {}) =>
    render(<SubmitDialog enrollment={enrollment} workspaceRunning onClose={vi.fn()} onSubmitted={vi.fn()} {...props} />);

  beforeEach(() => get.mockResolvedValue({ saves: [] }));

  it("has no repository field and no file input: the code is zipped by AptRun from the open editor", async () => {
    const { container } = dialog();

    expect(await screen.findByText(/AptRun zips your project from the editor/)).toBeTruthy();
    expect(screen.queryByText(/Repository link/i)).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(/there is nothing to upload/)).toBeTruthy();
  });

  it("Save progress asks the server to pack a checkpoint and lists it with a zip download", async () => {
    const onBefore = vi.fn().mockResolvedValue(undefined);
    post.mockResolvedValue({ save: save(1), saves: [save(1)] });
    getFile.mockResolvedValue(new Blob(["zip"]));
    dialog({ beforeSubmit: onBefore });

    fireEvent.click(await screen.findByRole("button", { name: /Save progress/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/project-lab/enrollments/9/saves", undefined));
    expect(onBefore).toHaveBeenCalled();
    expect(await screen.findByText(/12 files, 20 KB, zipped by AptRun/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /\.zip/ }));
    await waitFor(() => expect(getFile).toHaveBeenCalledWith("/project-lab/enrollments/9/saves/1/download"));
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "project-9-save-1.zip");
  });

  it("Submit sends only the links and notes (never a repository or a file) and reports success", async () => {
    const onSubmitted = vi.fn();
    post.mockResolvedValue({ enrollment: { id: 9 } });
    dialog({ onSubmitted });

    fireEvent.change(await screen.findByPlaceholderText(/your-project\.example/), { target: { value: "https://demo.test" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit for review/ }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/project-lab/enrollments/9/submit", { live_url: "https://demo.test", notes: null }));
    expect(onSubmitted).toHaveBeenCalledWith({ id: 9 });
  });

  it("explains a refusal for copied-in files, in the server's words", async () => {
    const { ApiError } = await import("@/lib/api");
    post.mockRejectedValue(new ApiError("Most of this project (12 of 12 files) was copied in from outside AptRun.", 422, undefined, "imported_files"));
    dialog();

    fireEvent.click(await screen.findByRole("button", { name: /Submit for review/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("copied in from outside AptRun");
  });

  it("with the workspace closed, neither button works and it says why", async () => {
    dialog({ workspaceRunning: false });

    expect(await screen.findByText(/Open your workspace to save or submit/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Save progress/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Submit for review/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the reviewer's view of a submission", () => {
  const files = { files: [{ path: "src/app.php", size: 20, mtime: "2026-11-04T09:00:00Z" }, { path: "README.md", size: 12, mtime: "2026-11-04T09:00:00Z" }], total_files: 2, total_bytes: 32, truncated: false };

  it("lists the files, reads one as text, and offers every saved checkpoint as a zip", async () => {
    get.mockImplementation((p: string) => (p.includes("/file?") ? Promise.resolve({ path: "src/app.php", size: 20, binary: false, truncated: false, content: "<?php echo 1;" }) : Promise.resolve(files)));
    getFile.mockResolvedValue(new Blob(["zip"]));
    render(<SubmissionFilesPanel submissionId={4} saves={[save(7, { imported_files: 3 })]} />);

    expect(await screen.findByText("src/app.php")).toBeTruthy();
    expect(screen.getByText(/2 files · 32 B/)).toBeTruthy();
    fireEvent.click(screen.getByText("src/app.php"));
    expect(await screen.findByText("<?php echo 1;")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/admin/project-lab/submissions/4/file?path=src%2Fapp.php");

    expect(screen.getByText(/3 file\(s\) older than the workspace/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /\.zip/ }));
    await waitFor(() => expect(getFile).toHaveBeenCalledWith("/admin/project-lab/saves/7/download"));
  });

  it("does not show a binary file and filters by path", async () => {
    get.mockImplementation((p: string) => (p.includes("/file?") ? Promise.resolve({ path: "README.md", size: 12, binary: true, truncated: false, content: null }) : Promise.resolve(files)));
    render(<SubmissionFilesPanel submissionId={4} saves={[]} />);

    fireEvent.change(await screen.findByPlaceholderText("Filter by path"), { target: { value: "read" } });
    expect(screen.queryByText("src/app.php")).toBeNull();
    fireEvent.click(screen.getByText("README.md"));
    expect(await screen.findByText(/A binary file — not shown/)).toBeTruthy();
    expect(screen.getByText(/never pressed “Save progress”/)).toBeTruthy();
  });
});
