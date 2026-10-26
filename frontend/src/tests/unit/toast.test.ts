import { afterEach, describe, expect, it } from "vitest";
import { MAX_VISIBLE_TOASTS, clearToasts, dismissToast, getToasts, inferTone, resetToasts, showToast, toast, toastDuration } from "@/lib/toast";

afterEach(resetToasts);

describe("inferTone — the wording fallback for call sites that pass a bare string", () => {
  it.each([
    "Failed to publish.",
    "Couldn't load \"Q3 report\". Please try again.",
    "Could not reach the server.",
    "Unable to send the notification.",
    "Something went wrong. Please try again.",
    "Request timed out.",
    "Payment failed: the bank declined it.",
  ])("calls %j an error", (message) => {
    expect(inferTone(message)).toBe("error");
  });

  it.each([
    "Enter a valid CTC to continue.",
    "Select a college for this TPO account.",
    "No applicants to export yet for this drive.",
    "Nothing to retry.",
    "Already finalized.",
    "That college already has an active mapping for this opening.",
    "Checked with PayU: no completed payment found for that order.",
    "Attached 8 questions — bank ran short on: Aptitude",
    "5 moved; 2 could not — e.g. Q-12: not published",
    "Use a name with letters in it.",
  ])("calls %j a warning — it worked, but not the way the person hoped", (message) => {
    expect(inferTone(message)).toBe("warning");
  });

  it.each(["Two-factor authentication isn't available yet.", "Anika Rao had no open sessions."])("calls %j neutral information", (message) => {
    expect(inferTone(message)).toBe("info");
  });

  it.each([
    "\"Mock round\" is now published.",
    "Profile saved successfully.",
    "Phone number verified!",
    "Moved to Interview.",
    "Exported 12 applicant(s) for Acme.",
    "Imported: 40 new, 2 updated.",
    "Anika Rao was signed out of 2 devices.",
    "Retried 3 failed emails.",
    "Settings saved.",
    "Added 3 drafts — review them before publishing.",
  ])("leaves %j as a success", (message) => {
    expect(inferTone(message)).toBe("success");
  });
});

describe("toastDuration", () => {
  it("keeps an error up longer than a success, and a long message longer than a short one", () => {
    expect(toastDuration("error", "x")).toBeGreaterThan(toastDuration("success", "x"));
    expect(toastDuration("success", "x".repeat(200))).toBeGreaterThan(toastDuration("success", "x"));
  });

  it("never lets a very long message sit up forever", () => {
    expect(toastDuration("error", "x".repeat(5000))).toBeLessThanOrEqual(14_000);
  });
});

describe("showToast", () => {
  it("uses the tone it is given, and works one out from the wording when it is not", () => {
    showToast("Saved.");
    showToast("Saved, but the server said no.", "error");
    expect(getToasts().map((t) => t.tone)).toEqual(["success", "error"]);
  });

  it("lets an explicit tone beat the wording", () => {
    showToast("Failed to open the door — just kidding, it opened.", "success");
    expect(getToasts()[0].tone).toBe("success");
  });

  it("does not stack a twin: the same message raised again counts up and restarts its clock", () => {
    showToast("Exported.");
    const before = getToasts()[0];
    showToast("Exported.");
    showToast("Exported.");

    const all = getToasts();
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(3);
    expect(all[0].revision).toBeGreaterThan(before.revision);
  });

  it("keeps different messages, and the same words in a different tone, as separate toasts", () => {
    showToast("Done.");
    showToast("Done.", "info");
    showToast("Also done.");
    expect(getToasts()).toHaveLength(3);
  });

  it("updates a toast in place when it is raised again under the same id", () => {
    toast.info("Uploading… 10%", { id: "upload", duration: Infinity });
    toast.info("Uploading… 60%", { id: "upload", duration: Infinity });

    const all = getToasts();
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe("Uploading… 60%");
    expect(all[0].count).toBe(1);
  });

  it(`never shows more than ${MAX_VISIBLE_TOASTS} at once — the oldest goes first`, () => {
    for (let i = 1; i <= MAX_VISIBLE_TOASTS + 2; i++) showToast(`Message ${i}`);

    const messages = getToasts().map((t) => t.message);
    expect(messages).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(messages[0]).toBe("Message 3");
    expect(messages[messages.length - 1]).toBe(`Message ${MAX_VISIBLE_TOASTS + 2}`);
  });

  it("ignores an empty message, so a stray empty string never paints a blank card", () => {
    expect(showToast("   ")).toBe("");
    expect(getToasts()).toHaveLength(0);
  });

  it("can be dismissed by id, and cleared", () => {
    const id = toast.success("One");
    toast.success("Two");

    dismissToast(id);
    expect(getToasts().map((t) => t.message)).toEqual(["Two"]);

    clearToasts();
    expect(getToasts()).toHaveLength(0);
  });

  it("offers the same four shortcuts everywhere", () => {
    toast.success("a");
    toast.error("b");
    toast.warning("c");
    toast.info("d");
    expect(getToasts().map((t) => t.tone)).toEqual(["success", "error", "warning", "info"]);
  });
});
