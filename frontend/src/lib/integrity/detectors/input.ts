import { installEditorClipboardGuard } from "@/lib/proctoring/editorClipboardGuard";
import type { WebEventType } from "../types";

type Emit = (type: WebEventType, data?: Record<string, unknown>) => void;

interface KeyboardLockApi {
  lock?: (codes?: string[]) => Promise<void>;
  unlock?: () => void;
}

export type ShortcutVerdict = { block: boolean; combo: string; type: "shortcut_blocked" | "print_attempt" | "screenshot_key" } | null;

/**
 * Keys that open the tools or take pictures the proctor cannot see. Pure so it is unit-tested; the listener only wires it up.
 * (A browser cannot see the Win key or Alt-Tab at all — that is what the Guardian is for.)
 */
export function classifyShortcut(e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">): ShortcutVerdict {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const mod = e.ctrlKey || e.metaKey;

  if (e.key === "F12") return { block: true, combo: "F12", type: "shortcut_blocked" };
  if (key === "PrintScreen" || e.code === "PrintScreen") return { block: false, combo: "PrintScreen", type: "screenshot_key" };
  if (e.metaKey && e.shiftKey && key === "s") return { block: false, combo: "Meta+Shift+S", type: "screenshot_key" };
  if (mod && key === "p") return { block: true, combo: "Ctrl+P", type: "print_attempt" };
  if (mod && e.shiftKey && ["i", "j", "c", "k"].includes(key)) return { block: true, combo: `Ctrl+Shift+${key.toUpperCase()}`, type: "shortcut_blocked" };
  if (mod && e.altKey && ["i", "j", "c"].includes(key)) return { block: true, combo: `Cmd+Alt+${key.toUpperCase()}`, type: "shortcut_blocked" };
  if (mod && ["u", "s"].includes(key)) return { block: true, combo: `Ctrl+${key.toUpperCase()}`, type: "shortcut_blocked" };
  if (mod && e.shiftKey && key === "delete") return { block: true, combo: "Ctrl+Shift+Delete", type: "shortcut_blocked" };

  return null;
}

export interface InputOptions {
  clipboard: "editor_only" | "block_all" | "off";
}

/**
 * The keyboard, the mouse menu, printing and the clipboard:
 *   - developer-tool / view-source / save / print shortcuts are cancelled and reported;
 *   - PrintScreen and Win+Shift+S are reported (a browser cannot stop them);
 *   - the right-click menu is cancelled and reported;
 *   - keystrokes that are not from a real keyboard (`isTrusted === false`: dispatched by a script — an auto-typer, a
 *     browser extension filling the editor) are counted and reported in bulk;
 *   - the clipboard follows the policy: `editor_only` (code may be pasted only if it was copied from the editor — see
 *     editorClipboardGuard), `block_all` (nothing may be pasted), `off`;
 *   - in fullscreen the browser is asked to hand Esc and F11 to the page (Chromium Keyboard Lock), so leaving fullscreen
 *     takes a deliberate long press instead of a tap.
 */
export function installInputDetector(emit: Emit, o: InputOptions): () => void {
  let syntheticKeys = 0;
  let syntheticReported = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.isTrusted) {
      syntheticKeys += 1;

      return;
    }
    const verdict = classifyShortcut(e);
    if (!verdict) return;
    if (verdict.block) {
      e.preventDefault();
      e.stopPropagation();
    }
    emit(verdict.type, { combo: verdict.combo });
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.isTrusted && (e.key === "PrintScreen" || e.code === "PrintScreen")) emit("screenshot_key", { combo: "PrintScreen" });
  };

  // Untrusted keystrokes are reported in batches of a few, so one flaky extension is one line and an auto-typer is many.
  const syntheticTimer = window.setInterval(() => {
    if (syntheticKeys - syntheticReported >= 5) {
      emit("synthetic_input", { count: syntheticKeys - syntheticReported });
      syntheticReported = syntheticKeys;
    }
  }, 2000);

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    emit("context_menu_blocked");
  };

  const onBeforePrint = () => emit("print_attempt", { via: "beforeprint" });

  let removeClipboard: () => void = () => undefined;
  if (o.clipboard === "editor_only") {
    removeClipboard = installEditorClipboardGuard(({ via, length }) => emit("paste_attempt", { via, length }));
  } else if (o.clipboard === "block_all") {
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      emit("paste_attempt", { via: "paste", length: e.clipboardData?.getData("text/plain").length ?? 0 });
    };
    document.addEventListener("paste", onPaste, true);
    removeClipboard = () => document.removeEventListener("paste", onPaste, true);
  }

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("beforeprint", onBeforePrint);

  const kb = (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;
  void kb?.lock?.(["Escape", "F11"]).catch(() => undefined);

  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", onKeyUp, true);
    document.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("beforeprint", onBeforePrint);
    window.clearInterval(syntheticTimer);
    removeClipboard();
    kb?.unlock?.();
  };
}
