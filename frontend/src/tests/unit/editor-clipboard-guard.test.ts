/**
 * The proctored-contest clipboard policy (lib/proctoring/editorClipboardGuard.ts): only text copied or cut
 * out of the code editor may be pasted back. These run in jsdom with hand-built events; the real
 * Monaco behaviour (it ignores preventDefault, so propagation must be stopped) was verified separately
 * in Chromium against the CDN build the app loads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDITOR_CLIPBOARD_SOURCE_PROPS,
  forgetEditorClipboard,
  installEditorClipboardGuard,
  isEditorClipboard,
  type BlockedClipboardEvent,
} from "@/lib/proctoring/editorClipboardGuard";

function clipboardEvent(type: "copy" | "cut" | "paste", text: string | null) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "clipboardData", { value: text === null ? null : { getData: (t: string) => (t === "text/plain" ? text : "") } });
  return e;
}

function dragEvent(type: "dragover" | "drop", text = "") {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: { getData: () => text, dropEffect: "" } });
  return e;
}

describe("editor clipboard guard", () => {
  let editor: HTMLElement;
  let editorInput: HTMLElement;
  let outside: HTMLElement;
  let blocked: BlockedClipboardEvent[];
  let uninstall: () => void;
  /** Stands in for Monaco's own paste handler, which sits below the document and ignores defaultPrevented. */
  let reachedEditor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `<div id="problem">statement</div><div id="editor"><textarea id="input"></textarea></div>`;
    editor = document.getElementById("editor")!;
    editor.setAttribute("data-clipboard-source", EDITOR_CLIPBOARD_SOURCE_PROPS["data-clipboard-source"]);
    editorInput = document.getElementById("input")!;
    outside = document.getElementById("problem")!;
    blocked = [];
    reachedEditor = vi.fn();
    editorInput.addEventListener("paste", reachedEditor);
    editorInput.addEventListener("drop", reachedEditor);
    forgetEditorClipboard();
    uninstall = installEditorClipboardGuard((ev) => blocked.push(ev));
  });

  afterEach(() => {
    uninstall();
    forgetEditorClipboard();
  });

  it("lets the student paste code they copied out of the editor", () => {
    editorInput.dispatchEvent(clipboardEvent("copy", "int x = 1;"));
    const paste = clipboardEvent("paste", "int x = 1;");
    editorInput.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(false);
    expect(reachedEditor).toHaveBeenCalledTimes(1);
    expect(blocked).toEqual([]);
  });

  it("counts a cut like a copy", () => {
    editorInput.dispatchEvent(clipboardEvent("cut", "moved();"));
    editorInput.dispatchEvent(clipboardEvent("paste", "moved();"));

    expect(reachedEditor).toHaveBeenCalledTimes(1);
    expect(blocked).toEqual([]);
  });

  it("stops outside text before the editor's own handler can read it, and reports it", () => {
    const paste = clipboardEvent("paste", "solution from the internet");
    editorInput.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    // preventDefault alone is not enough — Monaco ignores it — so the event must never arrive.
    expect(reachedEditor).not.toHaveBeenCalled();
    expect(blocked).toEqual([{ via: "paste", length: "solution from the internet".length }]);
  });

  it("refuses everything until something has been copied from the editor", () => {
    editorInput.dispatchEvent(clipboardEvent("paste", ""));
    editorInput.dispatchEvent(clipboardEvent("paste", "x"));

    expect(reachedEditor).not.toHaveBeenCalled();
    expect(blocked).toHaveLength(2);
  });

  it("refuses an empty clipboard (an image, a file) even though 'empty' matches nothing remembered", () => {
    editorInput.dispatchEvent(clipboardEvent("copy", "code"));
    const paste = clipboardEvent("paste", "");
    editorInput.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(blocked).toEqual([{ via: "paste", length: 0 }]);
  });

  it("refuses a paste whose clipboardData is unavailable", () => {
    const paste = clipboardEvent("paste", null);
    editorInput.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(reachedEditor).not.toHaveBeenCalled();
  });

  it("refuses the paste once something else replaced the clipboard after an editor copy", () => {
    editorInput.dispatchEvent(clipboardEvent("copy", "my code"));
    // copied elsewhere in the meantime — the clipboard now holds different text
    editorInput.dispatchEvent(clipboardEvent("paste", "copied from another window"));

    expect(reachedEditor).not.toHaveBeenCalled();
    expect(blocked).toHaveLength(1);
  });

  it("ignores copies made outside the editor, even of text that was in the problem statement", () => {
    outside.dispatchEvent(clipboardEvent("copy", "Given an array of integers"));
    outside.dispatchEvent(clipboardEvent("paste", "Given an array of integers"));

    expect(blocked).toHaveLength(1);
    expect(isEditorClipboard("Given an array of integers")).toBe(false);
  });

  it("does not care about CRLF vs LF between the copy and the paste", () => {
    editorInput.dispatchEvent(clipboardEvent("copy", "a\r\nb\r\n"));
    editorInput.dispatchEvent(clipboardEvent("paste", "a\nb\n"));

    expect(reachedEditor).toHaveBeenCalledTimes(1);
    expect(blocked).toEqual([]);
  });

  it("revokes the allowance when the attempt ends", () => {
    editorInput.dispatchEvent(clipboardEvent("copy", "code"));
    forgetEditorClipboard();
    editorInput.dispatchEvent(clipboardEvent("paste", "code"));

    expect(reachedEditor).not.toHaveBeenCalled();
    expect(blocked).toHaveLength(1);
  });

  it("swallows a drop from outside and reports it, and cancels dragover so the drop is delivered", () => {
    const over = dragEvent("dragover");
    editorInput.dispatchEvent(over);
    const drop = dragEvent("drop", "dragged in");
    editorInput.dispatchEvent(drop);

    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    expect(reachedEditor).not.toHaveBeenCalled();
    expect(blocked).toEqual([{ via: "drop", length: "dragged in".length }]);
  });

  it("stops enforcing once uninstalled, and leaves no listeners behind", () => {
    uninstall();
    const paste = clipboardEvent("paste", "anything");
    editorInput.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(false);
    expect(blocked).toEqual([]);
    expect(reachedEditor).toHaveBeenCalledTimes(1);
  });
});
