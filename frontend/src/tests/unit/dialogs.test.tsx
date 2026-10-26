import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogHost } from "@/components/ui/DialogHost";
import { Modal } from "@/components/ui/Modal";
import { confirmDialog, promptDialog, resetDialogs } from "@/lib/dialogs";

afterEach(() => {
  cleanup();
  resetDialogs();
  vi.restoreAllMocks();
});

/** Raises a confirmation and returns the pending answer, with the dialog already on screen. */
async function ask(options: Parameters<typeof confirmDialog>[0]) {
  let answer!: Promise<boolean>;
  act(() => {
    answer = confirmDialog(options);
  });
  const dialog = await screen.findByRole("alertdialog");
  return { answer, dialog };
}

describe("confirmDialog with the real dialog mounted", () => {
  it("asks with the app's own dialog — title, message, and a labelled button for each answer", async () => {
    render(<DialogHost />);
    const { dialog } = await ask({ title: "Delete \"Mock round\"?", message: "This can't be undone.", tone: "danger", confirmLabel: "Delete" });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Delete \"Mock round\"?" })).toBeTruthy();
    expect(screen.getByText("This can't be undone.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    // The dialog is described by its message, so a screen reader reads both when it opens.
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("resolves true on the confirm button", async () => {
    render(<DialogHost />);
    const { answer } = await ask({ title: "Retire this question?", confirmLabel: "Retire" });

    fireEvent.click(screen.getByRole("button", { name: "Retire" }));
    await expect(answer).resolves.toBe(true);
  });

  it("resolves false on Cancel, on Escape and on a click outside the card", async () => {
    render(<DialogHost />);

    let { answer } = await ask({ title: "One?" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    ({ answer } = await ask({ title: "Two?" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await expect(answer).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    const second = await ask({ title: "Three?" });
    fireEvent.mouseDown(second.dialog.parentElement as HTMLElement);
    await expect(second.answer).resolves.toBe(false);
  });

  it("does not treat a click inside the card as a click outside it", async () => {
    render(<DialogHost />);
    const { answer, dialog } = await ask({ title: "Stay?" });
    let settled = false;
    void answer.then(() => (settled = true));

    fireEvent.mouseDown(dialog);
    fireEvent.mouseDown(screen.getByRole("heading", { name: "Stay?" }));
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("starts on Cancel when the question is destructive, so a stray Enter cannot be what deletes", async () => {
    render(<DialogHost />);
    await ask({ title: "Delete it?", tone: "danger", confirmLabel: "Delete" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("starts on the confirm button when nothing is at stake", async () => {
    render(<DialogHost />);
    await ask({ title: "Carry on?", confirmLabel: "Yes" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Yes" }));
  });

  it("keeps Tab inside the dialog", async () => {
    render(<DialogHost />);
    await ask({ title: "Delete it?", tone: "danger", confirmLabel: "Delete" });

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Delete" });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it("lists the reasons it is asking, when it has them", async () => {
    render(<DialogHost />);
    await ask({ title: "Switch it on anyway?", message: "Students would see a thin bank.", items: ["ECE has 12 questions", "No published tests"], tone: "warning" });

    expect(screen.getByText("ECE has 12 questions")).toBeTruthy();
    expect(screen.getByText("No published tests")).toBeTruthy();
  });

  it("asks one question at a time, in the order they were raised", async () => {
    render(<DialogHost />);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirmDialog({ title: "First?" });
      second = confirmDialog({ title: "Second?" });
    });

    await screen.findByRole("heading", { name: "First?" });
    expect(screen.queryByRole("heading", { name: "Second?" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await expect(first).resolves.toBe(true);

    await screen.findByRole("heading", { name: "Second?" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(second).resolves.toBe(false);
  });

  it("answers Escape for itself only — the modal it was opened from stays open", async () => {
    const closeModal = vi.fn();
    render(
      <>
        <Modal title="Edit question" onClose={closeModal}>
          <p>form</p>
        </Modal>
        <DialogHost />
      </>
    );

    const { answer } = await ask({ title: "Discard your unsaved changes?", tone: "warning", confirmLabel: "Discard" });
    fireEvent.keyDown(document.body, { key: "Escape" });

    await expect(answer).resolves.toBe(false);
    expect(closeModal).not.toHaveBeenCalled();

    // …and with no dialog up, Escape closes the modal as it always did.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("gives the cancelled opener its focus back", async () => {
    render(
      <>
        <button>Delete row</button>
        <DialogHost />
      </>
    );
    const opener = screen.getByRole("button", { name: "Delete row" });
    opener.focus();

    const { answer } = await ask({ title: "Delete row?", tone: "danger" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await answer;

    // (once the dialog has finished fading out)
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("answers 'no' to anything still open when the host goes away, rather than hanging the caller", async () => {
    const { unmount } = render(<DialogHost />);
    const { answer } = await ask({ title: "Hanging?" });

    unmount();
    await expect(answer).resolves.toBe(false);
  });
});

describe("promptDialog", () => {
  const open = async (options: Parameters<typeof promptDialog>[0]) => {
    let answer!: Promise<string | null>;
    act(() => {
      answer = promptDialog(options);
    });
    const input = (await screen.findByRole("textbox")) as HTMLInputElement;
    return { answer, input };
  };

  it("starts with the current value selected, and resolves with what was typed", async () => {
    render(<DialogHost />);
    const { answer, input } = await open({ title: "Rename subject", label: "New name", defaultValue: "Circuits", confirmLabel: "Rename" });

    expect(input.value).toBe("Circuits");
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "Network theory" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await expect(answer).resolves.toBe("Network theory");
  });

  it("submits on Enter", async () => {
    render(<DialogHost />);
    const { answer, input } = await open({ title: "Rename", defaultValue: "A" });

    fireEvent.change(input, { target: { value: "B" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await expect(answer).resolves.toBe("B");
  });

  it("refuses an invalid value with a message under the field, and stays open until it is fixed", async () => {
    render(<DialogHost />);
    const { answer, input } = await open({ title: "Rename", defaultValue: "A", confirmLabel: "Rename", validate: (v) => (v.trim() ? null : "Enter a name.") });

    fireEvent.change(input, { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Enter a name.");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.change(input, { target: { value: "Fixed" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await expect(answer).resolves.toBe("Fixed");
  });

  it("resolves null when cancelled", async () => {
    render(<DialogHost />);
    const { answer } = await open({ title: "Rename" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await expect(answer).resolves.toBeNull();
  });
});

describe("with no dialog mounted (a test, or a render that failed)", () => {
  it("falls back to the browser's own confirm instead of silently answering — a destructive action is never skipped", async () => {
    const native = vi.spyOn(window, "confirm").mockReturnValue(true);

    await expect(confirmDialog({ title: "Delete it?", message: "This can't be undone.", items: ["one"] })).resolves.toBe(true);
    expect(native).toHaveBeenCalledTimes(1);
    expect(native.mock.calls[0][0]).toContain("Delete it?");
    expect(native.mock.calls[0][0]).toContain("This can't be undone.");
    expect(native.mock.calls[0][0]).toContain("one");

    native.mockReturnValue(false);
    await expect(confirmDialog({ title: "Delete it?" })).resolves.toBe(false);
  });

  it("falls back to the browser's prompt, too", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Typed");
    await expect(promptDialog({ title: "Rename", defaultValue: "Old" })).resolves.toBe("Typed");
  });
});
