import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrityPolicy, PreflightCheck } from "@/lib/integrity/types";

const get = vi.fn();
const put = vi.fn();
const getFile = vi.fn();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), getFile: (...a: unknown[]) => getFile(...a), post: vi.fn() } };
});

import { ApiError } from "@/lib/api";
import { ExamNetworkCard } from "@/components/proctoring/ExamNetworkCard";
import { IntegrityChecklist } from "@/components/proctoring/IntegrityChecklist";
import { IntegrityDisclosure } from "@/components/proctoring/IntegrityDisclosure";
import { IntegrityHoldLayer } from "@/components/proctoring/IntegrityHoldLayer";
import { IntegrityReview, summariseData } from "@/components/proctoring/IntegrityReview";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { resetIntegrityUi, setCheck, setIntegrityUi } from "@/lib/integrity/store";

const POLICY: IntegrityPolicy = {
  profile: "strict", beat_interval: 10, stale_after: 40, webcam_snapshot: 30, screen_snapshot: 60, screen_share: "required", camera: "required", guardian: "optional",
  chromium_only: true, block_multi_monitor: true, focus_loss_strike: 3, ai: true, clipboard: "editor_only", stun_servers: [], retention_days: 45, flagged_retention_days: 365,
};
const check = (id: PreflightCheck["id"], status: PreflightCheck["status"], over: Partial<PreflightCheck> = {}): PreflightCheck => ({ id, label: id, status, required: true, ...over });

const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const useDevice = (ua: string) => vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);

beforeEach(() => {
  resetIntegrityUi();
  get.mockReset();
  put.mockReset();
  getFile.mockReset();
  useDevice(WINDOWS_UA); // the Guardian is for Windows; the card only walks a student through installing it there
});
afterEach(cleanup);

describe("system check", () => {
  it("offers the right button on each row and calls the engine's action", () => {
    const shareScreen = vi.fn();
    const onEnableDevices = vi.fn();
    setIntegrityUi({ policy: POLICY, actions: { shareScreen, connectGuardian: vi.fn(), resolveHold: vi.fn() } });
    setCheck(check("browser", "ok"));
    setCheck(check("camera", "pending"));
    setCheck(check("screen", "pending"));

    render(<IntegrityChecklist onEnableDevices={onEnableDevices} />);
    expect(screen.getByText("1/3 ready")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    fireEvent.click(screen.getByRole("button", { name: "Share screen" }));
    expect(onEnableDevices).toHaveBeenCalled();
    expect(shareScreen).toHaveBeenCalled();
  });

  it("says what is wrong and how to fix it — and offers no button for what the student cannot click away", () => {
    setIntegrityUi({ policy: POLICY });
    setCheck(check("display", "fail", { detail: "More than one screen is connected.", fix: "Unplug extra monitors." }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText("More than one screen is connected.")).toBeTruthy();
    expect(screen.getByText("Unplug extra monitors.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the pairing code, the way to open the Guardian, and the blockers it found", () => {
    setIntegrityUi({
      policy: POLICY,
      actions: { shareScreen: vi.fn(), connectGuardian: vi.fn(), resolveHold: vi.fn() },
      guardian: {
        mode: "optional", busy: false, error: null,
        pairing: { code: "ABCD-2345", deepLink: "aptrun-guardian://pair?code=ABCD2345", downloadUrl: "https://example.com/g.zip", expiresAt: "" },
        summary: { mode: "optional", connected: true, version: "1.0.0", outdated: false, download_url: "", blockers: [{ type: "forbidden_process", title: "A program that is not allowed is running", fix: "Close the program named below.", detail: "anydesk.exe — Remote-control software" }] },
      },
    });
    setCheck(check("guardian", "fail", { required: false }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText("ABCD-2345")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open Guardian/ }).getAttribute("href")).toBe("aptrun-guardian://pair?code=ABCD2345");
    expect(screen.getByRole("link", { name: /Download for Windows/ })).toBeTruthy();
    expect(screen.getByText(/anydesk\.exe/)).toBeTruthy();
  });
});

describe("the Guardian card while it waits", () => {
  const waiting = (expiresInMs: number) => {
    setIntegrityUi({
      policy: POLICY,
      actions: { shareScreen: vi.fn(), connectGuardian: vi.fn(), resolveHold: vi.fn() },
      guardian: {
        mode: "optional", busy: false, error: null,
        pairing: { code: "ABCD-2345", deepLink: "aptrun-guardian://pair?code=ABCD2345", downloadUrl: "", expiresAt: new Date(Date.now() + expiresInMs).toISOString() },
        summary: { mode: "optional", connected: false, version: null, outdated: false, blockers: [], download_url: "" },
      },
    });
    setCheck(check("guardian", "pending", { required: false }));
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts with the code and a countdown, and no lecture", () => {
    waiting(600_000);
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText(/valid for 10:00/)).toBeTruthy();
    expect(screen.getByText(/Waiting for the Guardian to connect/)).toBeTruthy();
    expect(screen.queryByText("Nothing happening?")).toBeNull();
  });

  it("after a few seconds says what the Guardian actually is and what to do, instead of a bare spinner", () => {
    waiting(600_000);
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);
    act(() => void vi.advanceTimersByTime(16_000));

    expect(screen.getByText("Nothing happening?")).toBeTruthy();
    expect(screen.getByText(/separate program for Windows/)).toBeTruthy();
    expect(screen.getByText(/valid for 9:44/)).toBeTruthy();
  });

  it("stops pretending to wait once the code has expired, and offers a new one", () => {
    const connectGuardian = vi.fn();
    waiting(5_000);
    setIntegrityUi({ actions: { shareScreen: vi.fn(), connectGuardian, resolveHold: vi.fn() } });
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);
    act(() => void vi.advanceTimersByTime(6_000));

    expect(screen.getByText("This code has expired.")).toBeTruthy();
    expect(screen.queryByText(/Waiting for the Guardian to connect/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Get a new code" }));
    expect(connectGuardian).toHaveBeenCalled();
  });

  it("offers the download BEFORE any code, with what the file is, so a first-time student is not sent hunting for it", () => {
    setIntegrityUi({
      policy: POLICY,
      actions: { shareScreen: vi.fn(), connectGuardian: vi.fn(), resolveHold: vi.fn() },
      guardian: {
        mode: "optional", busy: false, error: null, pairing: null,
        summary: {
          mode: "optional", connected: false, version: null, outdated: false, blockers: [],
          download_url: "https://api.example.com/api/guardian/download",
          download: { version: "1.2.3", size: 6_606_848, sha256: "ab".repeat(32) },
        },
      },
    });
    setCheck(check("guardian", "pending", { required: false }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    const link = screen.getByRole("link", { name: /Download for Windows/ });
    expect(link.getAttribute("href")).toBe("https://api.example.com/api/guardian/download");
    expect(screen.getByText(/aptrun-guardian\.exe · v1\.2\.3 · 6\.3 MB/)).toBeTruthy();
    expect(screen.getByText("ab".repeat(32))).toBeTruthy(); // so the file can be checked against what the server says it served
    expect(screen.getByText(/Windows protected your PC/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get a pairing code" })).toBeTruthy();
    // no code yet, so nothing to "open"
    expect(screen.queryByRole("link", { name: /Open Guardian/ })).toBeNull();
  });

  it("asks a student with no installer on the server to get it from their college, instead of showing a dead link", () => {
    waiting(600_000);
    setIntegrityUi((s) => ({ guardian: { ...s.guardian, pairing: { ...s.guardian.pairing!, downloadUrl: "" } } }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.queryByRole("link", { name: /Download for Windows/ })).toBeNull();
    expect(screen.getByText(/Ask your college for the AptRun Guardian/)).toBeTruthy();
  });

  it("does not send a Mac or a phone to download a program that cannot run there", () => {
    useDevice(MAC_UA);
    waiting(600_000);
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText(/runs on/)).toBeTruthy();
    expect(screen.getByText(/It is optional for this test/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Download for Windows/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /pairing code/ })).toBeNull();
  });

  it("tells a Mac student that a test which REQUIRES the Guardian needs a Windows computer", () => {
    useDevice(MAC_UA);
    waiting(600_000);
    setIntegrityUi((s) => ({ guardian: { ...s.guardian, mode: "required" } }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText(/please use a Windows computer/)).toBeTruthy();
  });

  it("shows the server's reason when the Guardian cannot connect", () => {
    waiting(600_000);
    setIntegrityUi((s) => ({ guardian: { ...s.guardian, error: "The server cannot accept Guardian connections yet. The Guardian cannot connect until this is fixed." } }));
    render(<IntegrityChecklist onEnableDevices={vi.fn()} />);

    expect(screen.getByText(/The Guardian cannot connect until this is fixed/)).toBeTruthy();
  });
});

describe("consent gate", () => {
  const renderGate = (devicePreviewReady = true) =>
    render(<ProctoringConsentGate phase="consent" consentError={null} devicePreviewReady={devicePreviewReady} previewVideoRef={{ current: null }} onEnableDevices={vi.fn()} onConsent={vi.fn()} />);

  it("keeps Start disabled until every REQUIRED check is green", () => {
    setIntegrityUi({ policy: POLICY });
    setCheck(check("camera", "ok"));
    setCheck(check("screen", "pending"));
    setCheck(check("guardian", "pending", { required: false }));
    renderGate();

    const button = screen.getByRole("button", { name: /Finish the system check to start/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    act(() => setCheck(check("screen", "ok")));
    cleanup();
    renderGate();
    expect((screen.getByRole("button", { name: /Start Proctored Session/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("states what is recorded using the server's own numbers", () => {
    setIntegrityUi({ policy: POLICY });
    setCheck(check("camera", "ok"));
    renderGate();

    expect(screen.getByText(/about every 30 seconds/)).toBeTruthy();
    expect(screen.getByText(/entire screen/)).toBeTruthy();
    expect(screen.getByText(/every 1 minute|about every 1 minute/)).toBeTruthy();
    expect(screen.getByText(/deleted after 45 days/)).toBeTruthy();
    expect(screen.getByText(/never uploaded/)).toBeTruthy();
    // and no longer claims the old thing
    expect(screen.queryByText(/video stays in your browser and is never uploaded or stored/)).toBeNull();
  });

  it("is the original screen, unchanged, when the server runs no integrity layer", () => {
    renderGate();
    expect(screen.getByText(/video stays in your browser and is never/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Start Proctored Session/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("an interview does not say its microphone is unused", () => {
    setIntegrityUi({ policy: { ...POLICY, screen_share: "off", guardian: "off" } });
    render(<IntegrityDisclosure interview />);
    expect(screen.getByText(/microphone records your answers/)).toBeTruthy();
  });
});

describe("hold layer", () => {
  it("covers the exam with the reason and a way back, and the button calls the engine", () => {
    const resolveHold = vi.fn();
    setIntegrityUi({
      actions: { shareScreen: vi.fn(), connectGuardian: vi.fn(), resolveHold },
      hold: { kind: "screen_share", title: "Screen sharing stopped", message: "Share your entire screen again to continue.", action: "Share entire screen" },
    });
    render(<IntegrityHoldLayer />);

    expect(screen.getByRole("alertdialog", { name: "Screen sharing stopped" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Share entire screen" }));
    expect(resolveHold).toHaveBeenCalled();
  });

  it("offers nothing to click when the attempt is open somewhere else", () => {
    setIntegrityUi({ hold: { kind: "superseded", final: true, title: "This attempt is open somewhere else", message: "Close this window.", action: "x" } });
    render(<IntegrityHoldLayer />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when nothing is wrong", () => {
    const { container } = render(<IntegrityHoldLayer />);
    expect(container.firstChild).toBeNull();
  });
});

describe("reviewer screen", () => {
  const summary = (over = {}) => ({
    uuid: "u-1", surface: "contest", surface_label: "Contest", title: "Weekly 12", profile: "strict", status: "locked", assurance: "guardian", risk_level: "critical", risk_score: 92,
    strikes: 3, max_strikes: 3, locked: true, started_at: "2026-10-23T10:00:00Z", last_beat_at: null, ended_at: null, event_count: 9,
    student: { id: 1, name: "Esha Rao", email: "esha@example.com", roll_number: "R-12", section: "A" }, ...over,
  });
  const detail = (over = {}) => ({
    session: summary(),
    timeline: [
      { seq: 1, source: "server", type: "session_started", label: "Proctoring started", severity: "info", strike: 0, weight: 0, occurred_at: "2026-10-23T10:00:00Z", data: {} },
      { seq: 2, source: "guardian", type: "forbidden_process", label: "Forbidden program running", severity: "critical", strike: 99, weight: 40, occurred_at: "2026-10-23T10:05:00Z", data: { name: "anydesk.exe", category: "remote_control" } },
      { seq: 3, source: "web", type: "focus_lost", label: "Exam window lost focus", severity: "medium", strike: 1, weight: 8, occurred_at: "2026-10-23T10:06:00Z", data: { duration_ms: 9000 } },
    ],
    evidence: [{ id: 5, kind: "webcam", captured_at: "2026-10-23T10:05:30Z", flagged: true, reason: "no_face", meta: null, bytes: 4000 }],
    network: { bound_ip: "203.0.113.4", addresses: [{ ip: "203.0.113.4", beats: 20, class: "public" }, { ip: "198.51.100.9", beats: 3, class: "public" }], gap_seconds: 62, gap_count: 1 },
    guardian: { covered: true, first_at: "2026-10-23T10:00:00Z", last_at: "2026-10-23T10:06:00Z", gap_seconds: 0 },
    integrity: { chain_ok: true, chain_break: null, event_count: 3 },
    flags: [{ type: "forbidden_process", label: "Forbidden program running", count: 1, severity: "critical" }],
    ...over,
  });

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });

  it("lists attempts riskiest first with what watched them, then opens the whole story", async () => {
    get.mockImplementation(async (path: string) => (path.startsWith("/tpo/integrity/u-1") ? detail() : { data: [summary()], meta: { total: 1, page: 1, per_page: 25, last_page: 1 } }));
    getFile.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));

    render(<IntegrityReview apiBase="/tpo/integrity" />);
    const row = await screen.findByRole("button", { name: /Esha Rao/ });
    expect(row.textContent).toContain("Guardian");
    expect(row.textContent).toContain("3/3 strikes");
    expect(get).toHaveBeenCalledWith(expect.stringContaining("only_flagged=1"));

    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: "Attempt details" });
    expect(within(dialog).getByText(/The activity log is intact/)).toBeTruthy();
    expect(within(dialog).getByText("Forbidden program running", { selector: "p" })).toBeTruthy();
    expect(within(dialog).getByText("Ended attempt")).toBeTruthy(); // strike 99 reads as the attempt ending, not "99 strikes"
    expect(within(dialog).getByText(/anydesk\.exe/)).toBeTruthy();

    // routine entries are hidden until asked for
    expect(within(dialog).queryByText("Proctoring started")).toBeNull();
    fireEvent.click(within(dialog).getByLabelText(/Include routine entries/));
    expect(within(dialog).getByText("Proctoring started")).toBeTruthy();
  });

  it("shows the flagged pictures, fetched through the authenticated API", async () => {
    get.mockImplementation(async (path: string) => (path.includes("/u-1") ? detail() : { data: [summary()], meta: { total: 1, page: 1, per_page: 25, last_page: 1 } }));
    getFile.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));

    render(<IntegrityReview apiBase="/tpo/integrity" />);
    fireEvent.click(await screen.findByRole("button", { name: /Esha Rao/ }));
    fireEvent.click(await screen.findByRole("tab", { name: /Pictures \(1\)/ }));

    await waitFor(() => expect(getFile).toHaveBeenCalledWith("/tpo/integrity/u-1/evidence/5"));
    expect(await screen.findByAltText("webcam picture")).toBeTruthy();
    expect(screen.getByText("no face")).toBeTruthy();
  });

  it("warns loudly when the log does not verify", async () => {
    get.mockImplementation(async (path: string) =>
      path.includes("/u-1") ? detail({ integrity: { chain_ok: false, chain_break: { seq: 7, reason: "row content was changed after it was written" }, event_count: 9 } }) : { data: [summary()], meta: { total: 1, page: 1, per_page: 25, last_page: 1 } }
    );
    render(<IntegrityReview apiBase="/coordinator/integrity" />);
    fireEvent.click(await screen.findByRole("button", { name: /Esha Rao/ }));

    expect(await screen.findByText(/does NOT verify — entry #7/)).toBeTruthy();
  });

  it("shows the network tab with the address change called out", async () => {
    get.mockImplementation(async (path: string) => (path.includes("/u-1") ? detail() : { data: [summary()], meta: { total: 1, page: 1, per_page: 25, last_page: 1 } }));
    render(<IntegrityReview apiBase="/tpo/integrity" />);
    fireEvent.click(await screen.findByRole("button", { name: /Esha Rao/ }));
    fireEvent.click(await screen.findByRole("tab", { name: /Network/ }));

    expect(await screen.findByText("198.51.100.9")).toBeTruthy();
    expect(screen.getByText(/address changed during the attempt/)).toBeTruthy();
    expect(screen.getByText(/62s in 1 gap/)).toBeTruthy();
  });

  it("says so when nothing is flagged, and reports a failure instead of hanging", async () => {
    get.mockResolvedValueOnce({ data: [], meta: { total: 0, page: 1, per_page: 25, last_page: 1 } });
    const { unmount } = render(<IntegrityReview apiBase="/tpo/integrity" />);
    expect(await screen.findByText(/Nothing flagged/)).toBeTruthy();
    unmount();

    get.mockRejectedValueOnce(new ApiError("Not found", 404));
    render(<IntegrityReview apiBase="/tpo/integrity" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("turns event data into a sentence, never a JSON dump", () => {
    expect(summariseData({ name: "anydesk.exe", category: "remote_control" })).toBe("anydesk.exe · remote control");
    expect(summariseData({ duration_ms: 9000 })).toBe("9 s away");
    expect(summariseData({ http: "127.0.0.1", webrtc: ["203.0.113.9"] })).toContain("WebRTC 203.0.113.9");
    expect(summariseData({ merged_into_incident: true })).toContain("same incident");
    expect(summariseData({})).toBe("");
  });
});

describe("exam network card", () => {
  it("lets a TPO add the network they are sitting on and saves the list", async () => {
    get.mockResolvedValue({ ranges: ["198.51.100.0/24"], your_address: "203.0.113.50", your_address_class: "public", applies_everywhere: false });
    put.mockResolvedValue({ ranges: ["198.51.100.0/24", "203.0.113.50"], your_address: "203.0.113.50", your_address_class: "public", applies_everywhere: false });

    render(<ExamNetworkCard />);
    expect(await screen.findByDisplayValue("198.51.100.0/24")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add this network/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save exam network" }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/tpo/exam-network", { ranges: ["198.51.100.0/24", "203.0.113.50"] }));
    expect(await screen.findByText(/Students can start proctored attempts only from these networks/)).toBeTruthy();
  });

  it("warns that a private address is not what students will appear as, and shows the server's validation error", async () => {
    get.mockResolvedValue({ ranges: [], your_address: "192.168.1.20", your_address_class: "private", applies_everywhere: true });
    put.mockRejectedValue(new ApiError("The given data was invalid.", 422, { ranges: ["These are not valid addresses or ranges: lab."] }));

    render(<ExamNetworkCard />);
    expect(await screen.findByText(/private or local address/)).toBeTruthy();
    expect(screen.getByText(/also has its own allowed networks/)).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "lab" } });
    fireEvent.click(screen.getByRole("button", { name: "Save exam network" }));
    expect(await screen.findByText(/not valid addresses or ranges: lab/)).toBeTruthy();
  });
});
