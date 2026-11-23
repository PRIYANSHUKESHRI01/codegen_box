import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AptBotWidget } from "@/components/chat/AptBotWidget";
import { api } from "@/lib/api";

let mockPathname = "/dashboard";
let mockUser: { id: number; name: string; email: string; role: string } | null = {
  id: 101,
  name: "Alex Chen",
  email: "alex@example.com",
  role: "student",
};

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    status: mockUser ? "ready" : "signed_out",
  }),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("<AptBotWidget />", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockUser = {
      id: 101,
      name: "Alex Chen",
      email: "alex@example.com",
      role: "student",
    };
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the floating launcher button on standard routes", () => {
    render(<AptBotWidget />);
    expect(screen.getByLabelText(/Open AptBot Instant Assistant/i)).toBeTruthy();
    expect(screen.getByText(/Ask/i)).toBeTruthy();
  });

  it("does not render when user is on a proctored assessment route (/session)", () => {
    mockPathname = "/dashboard/soft-skills/session";
    const { container } = render(<AptBotWidget />);
    expect(container.firstChild).toBeNull();
  });

  it("opens the chat panel when clicking the launcher button", async () => {
    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    expect(screen.getAllByText(/AptBot/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Instant AI/i)).toBeTruthy();
    expect(screen.getByText(/About AptRun/i)).toBeTruthy();
    expect(screen.getByText(/Vault AI Interview/i)).toBeTruthy();
    expect(screen.getByText(/Placement Drives & Mellow Vault/i)).toBeTruthy();
  });

  it("allows selecting a category and viewing questions", async () => {
    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    const vaultAiCatBtn = screen.getByRole("button", { name: /Vault AI Interview/i });
    fireEvent.click(vaultAiCatBtn);

    expect(screen.getByText(/Why is 60%\+ the qualification score in Vault AI Interview\?/i)).toBeTruthy();
  });

  it("displays the answer and deep-link action when clicking a question", async () => {
    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    const vaultAiCatBtn = screen.getByRole("button", { name: /Vault AI Interview/i });
    fireEvent.click(vaultAiCatBtn);

    const questionBtn = screen.getByText(/Why is 60%\+ the qualification score in Vault AI Interview\?/i);
    fireEvent.click(questionBtn);

    // Question appears in chat
    expect(screen.getAllByText(/Why is 60%\+ the qualification score in Vault AI Interview\?/i).length).toBeGreaterThan(0);
    // Answer text appears
    expect(screen.getByText(/Verified for Hiring Badge/i)).toBeTruthy();
    // Action link appears
    expect(screen.getByText("Start Vault AI Interview")).toBeTruthy();
  });

  it("allows submitting a direct query to support with just a message", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValueOnce({
      success: true,
      ticket_number: "APT-2026-X9999",
      message: "Your query has been submitted.",
    });

    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    const supportBtn = screen.getByRole("button", { name: /Write your query/i });
    fireEvent.click(supportBtn);

    const messageInput = screen.getByPlaceholderText(/Write your message here/i) as HTMLTextAreaElement;
    fireEvent.change(messageInput, {
      target: { value: "I need help with my Vault AI Interview microphone device setup." },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Query/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        "/aptbot/support-ticket",
        expect.objectContaining({
          message: "I need help with my Vault AI Interview microphone device setup.",
        })
      );
    });

    // Confirmation message displayed in chat
    await waitFor(() => {
      expect(screen.getByText(/Your query has been submitted!/i)).toBeTruthy();
      expect(screen.getByText(/One of our specialists will review your message/i)).toBeTruthy();
    });
  });

  it("triggers smooth scroll down to questions when a topic is selected", async () => {
    const scrollSpy = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    const aboutAptRunBtn = screen.getByRole("button", { name: /About AptRun/i });
    fireEvent.click(aboutAptRunBtn);

    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: "smooth",
          block: "end",
        })
      );
    });
  });

  it("redirects unauthenticated users to /login when attempting to write a query", async () => {
    mockUser = null;
    render(<AptBotWidget />);
    const trigger = screen.getByLabelText(/Open AptBot Instant Assistant/i);
    fireEvent.click(trigger);

    const writeQueryBtn = screen.getByRole("button", { name: /Write your query/i });
    fireEvent.click(writeQueryBtn);

    expect(mockPush).toHaveBeenCalledWith("/login?redirect=%2Fdashboard");
  });
});
