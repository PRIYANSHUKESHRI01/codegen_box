/**
 * Clipboard policy for a proctored coding contest: the only text that may be pasted is text the
 * student copied or cut out of the code editor itself — their own code, moved around. Anything that
 * came from outside (another window, the problem statement, an AI chat) is refused.
 *
 * This can't be a plain `e.preventDefault()` on `paste`: Monaco reads `clipboardData` in its own
 * handler and never looks at `defaultPrevented`, so the text goes in regardless (reproduced in
 * Chromium against Monaco 0.55.1, the build the app loads from the CDN). The event has to be
 * stopped before it reaches the editor's input element — a capture-phase listener on `document`
 * that also calls `stopImmediatePropagation()`.
 *
 * Provenance is decided by content: a paste is allowed when its text equals what the last
 * copy/cut inside the editor put on the clipboard. Copy something else anywhere (or in another
 * window) and the clipboard no longer matches, so the paste is refused until they copy from the
 * editor again. A browser can't tell where clipboard text originally came from, so this is the
 * only check that can't be fooled by copying from outside.
 */

/** Marks the DOM subtree whose copies count as "from the editor". Spread onto the editor's wrapper. */
export const EDITOR_CLIPBOARD_SOURCE_PROPS = { "data-clipboard-source": "code-editor" } as const;
const EDITOR_SELECTOR = '[data-clipboard-source="code-editor"]';

export type BlockedClipboardVia = "paste" | "drop";

export interface BlockedClipboardEvent {
  via: BlockedClipboardVia;
  /** Characters the student tried to bring in (0 for a dropped file, which has no text). */
  length: number;
}

/**
 * What the last copy/cut inside the editor left on the clipboard (line endings normalised).
 * Module-level so every listener shares it; cleared by `forgetEditorClipboard` when the contest
 * page goes away, so nothing carries over to whoever uses this tab next.
 */
let lastEditorClip: string | null = null;

const normalise = (text: string) => text.replace(/\r\n?/g, "\n");

export function rememberEditorClipboard(text: string): void {
  lastEditorClip = text === "" ? null : normalise(text);
}

export function forgetEditorClipboard(): void {
  lastEditorClip = null;
}

/** True only when `text` is exactly what was last copied or cut out of the editor. */
export function isEditorClipboard(text: string): boolean {
  return lastEditorClip !== null && text !== "" && normalise(text) === lastEditorClip;
}

function isInsideEditor(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return el?.closest(EDITOR_SELECTOR) != null;
}

/**
 * Starts enforcing the policy on the whole document. Returns the function that stops it; the
 * remembered clip is deliberately left alone (see `forgetEditorClipboard`) so a fullscreen
 * exit/resume doesn't make the student re-copy their code.
 */
export function installEditorClipboardGuard(onBlocked: (event: BlockedClipboardEvent) => void): () => void {
  // Bubble phase, so Monaco's own handler has already put the selection on `clipboardData`.
  const onCopyOrCut = (e: ClipboardEvent) => {
    if (!isInsideEditor(e.target)) return;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (text !== "") rememberEditorClipboard(text);
  };

  const onPaste = (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (isEditorClipboard(text)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    onBlocked({ via: "paste", length: text.length });
  };

  // Nothing on this page is a legitimate drop target, and Monaco moves text inside itself with
  // mouse events rather than HTML5 drag-and-drop — so every drop is something coming from outside.
  // dragover is cancelled (not given dropEffect "none") on purpose: a drop the browser has already
  // refused never fires, and then the attempt couldn't be reported.
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    onBlocked({ via: "drop", length: e.dataTransfer?.getData("text/plain").length ?? 0 });
  };

  document.addEventListener("copy", onCopyOrCut);
  document.addEventListener("cut", onCopyOrCut);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("dragover", onDragOver, true);
  document.addEventListener("drop", onDrop, true);

  return () => {
    document.removeEventListener("copy", onCopyOrCut);
    document.removeEventListener("cut", onCopyOrCut);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("dragover", onDragOver, true);
    document.removeEventListener("drop", onDrop, true);
  };
}
