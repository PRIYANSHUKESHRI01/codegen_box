/**
 * The Project Lab authorship guard (infra/workspaces/guard/aptrun-guard.js), run against isolated jsdom
 * windows. The file is a plain browser script, so it is loaded with Node's require, not bundled.
 */
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as Record<string, unknown>).__APTRUN_GUARD_NO_AUTOSTART__ = true;

const nodeRequire = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const guardModule: any = nodeRequire("../../../../infra/workspaces/guard/aptrun-guard.js");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { JSDOM }: any = nodeRequire("jsdom");

// ───────────────────────────── helpers ─────────────────────────────

class FakeDataTransfer {
  data: Record<string, string> = {};
  files: unknown[] = [];
  types: string[] = [];
  dropEffect = "";
  setData(type: string, value: string) {
    this.data[type] = value;
    if (!this.types.includes(type)) this.types.push(type);
  }
  getData(type: string) {
    return this.data[type] ?? "";
  }
}

interface Rig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  win: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guard: any;
  textarea: HTMLTextAreaElement;
  timers: Array<() => void>;
  clock: { t: number };
  posted: unknown[];
  parent: { postMessage: (m: unknown) => void } | undefined;
}

const openWindows: Array<{ close: () => void }> = [];

afterEach(() => {
  while (openWindows.length) openWindows.pop()?.close();
});

function rig(options: { trustAllEvents?: boolean; withParent?: boolean; clipboard?: string; pickerName?: string } = {}): Rig {
  const dom = new JSDOM('<!doctype html><body><textarea id="t"></textarea></body>', { url: "http://localhost/" });
  const win = dom.window;
  openWindows.push(win);
  // A class per window: the guard's patches on it are deliberately non-writable.
  win.DataTransfer = class extends FakeDataTransfer {};
  win.Clipboard = class {
    text = options.clipboard ?? "";
    readText() {
      return Promise.resolve(this.text);
    }
    writeText(t: string) {
      this.text = t;
      return Promise.resolve();
    }
  };
  const execCalls: unknown[][] = [];
  win.Document.prototype.execCommand = function (...args: unknown[]) {
    execCalls.push(args);
    return true;
  };
  win.__execCalls = execCalls;
  win.showDirectoryPicker = vi.fn(() => Promise.resolve({}));
  win.showOpenFilePicker = vi.fn(() => Promise.resolve([{ name: options.pickerName ?? "logo.png" }]));
  const opened: unknown[] = [];
  win.open = (...args: unknown[]) => {
    opened.push(args);
    return { closed: false };
  };
  win.__opened = opened;

  const posted: unknown[] = [];
  const parent = options.withParent ? { postMessage: (m: unknown) => posted.push(m) } : undefined;

  const timers: Array<() => void> = [];
  const clock = { t: 1_000_000 };
  const guard = guardModule.createGuard(win, {
    trustAllEvents: options.trustAllEvents ?? true,
    parent,
    now: () => clock.t,
    setTimeout: (fn: () => void) => {
      timers.push(fn);
      return timers.length;
    },
  });
  guard.start();

  return { win, guard, textarea: win.document.getElementById("t"), timers, clock, posted, parent };
}

function clipboardEvent(win: Rig["win"], type: "paste" | "copy" | "cut", dt: FakeDataTransfer) {
  const ev = new win.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", { value: dt });
  return ev;
}

function pasteText(r: Rig, text: string) {
  const dt = new r.win.DataTransfer();
  dt.setData("text/plain", text);
  const ev = clipboardEvent(r.win, "paste", dt);
  r.textarea.dispatchEvent(ev);
  return ev as Event;
}

/** What VS Code does on Ctrl+C: its own handler writes text/plain into the event's clipboardData. */
function copyInside(r: Rig, text: string) {
  const handler = (e: Event) => (e as unknown as { clipboardData: FakeDataTransfer }).clipboardData.setData("text/plain", text);
  r.textarea.addEventListener("copy", handler);
  r.textarea.dispatchEvent(clipboardEvent(r.win, "copy", new r.win.DataTransfer()));
  r.textarea.removeEventListener("copy", handler);
  // A browser runs the guard's setTimeout(0) right after the event; here the timers are collected, so run them.
  r.timers.splice(0).forEach((fn) => fn());
}

function kinds(r: Rig): string[] {
  return r.guard.state().queue.map((e: { kind: string }) => e.kind);
}

// ───────────────────────────── pure helpers ─────────────────────────────

describe("fingerprint and normalize", () => {
  it("treats Windows and Unix line endings as the same text", () => {
    const { fingerprint, normalize } = guardModule.internals;
    expect(normalize("a\r\nb\rc")).toBe("a\nb\nc");
    expect(fingerprint("one\r\ntwo")).toBe(fingerprint("one\ntwo"));
  });

  it("tells different texts apart, and carries the length", () => {
    const { fingerprint } = guardModule.internals;
    expect(fingerprint("echo 1")).not.toBe(fingerprint("echo 2"));
    expect(fingerprint("abcd").endsWith(".4")).toBe(true);
    expect(fingerprint("")).toMatch(/\.0$/);
  });
});

describe("classifyFiles", () => {
  const { classifyFiles } = guardModule.internals;
  const file = (name: string, size = 10) => ({ name, size });

  it("accepts binary assets only", () => {
    expect(classifyFiles([file("logo.png"), file("Font.WOFF2"), file("doc.pdf")]).ok).toBe(true);
  });

  it("refuses source, archives, text and folders", () => {
    for (const name of ["Patient.php", "app.js", "x.zip", "notes.txt", "schema.sql", "icon.svg", "tar.gz", "Makefile", "src"]) {
      expect(classifyFiles([file(name)]).ok, name).toBe(false);
    }
  });

  it("refuses the whole drop if even one file is not an asset, and an empty drop", () => {
    expect(classifyFiles([file("a.png"), file("b.php")]).ok).toBe(false);
    expect(classifyFiles([]).ok).toBe(false);
  });
});

describe("the internal clipboard registry", () => {
  const { createRegistry } = guardModule.internals;

  it("remembers what was added and nothing else", () => {
    const r = createRegistry(null);
    r.add("class A {}");
    expect(r.has("class A {}")).toBe(true);
    expect(r.has("class B {}")).toBe(false);
    expect(r.has("")).toBe(false);
  });

  it("is shared between tabs through storage and survives corrupt storage", () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) };
    createRegistry(storage).add("from tab one");
    expect(createRegistry(storage).has("from tab one")).toBe(true);

    for (const k of Object.keys(store)) store[k] = "{not json";
    expect(() => createRegistry(storage).has("x")).not.toThrow();
  });

  it("forgets the oldest entries past its limit", () => {
    const r = createRegistry(null);
    for (let i = 0; i < 60; i++) r.add("snippet " + i);
    expect(r.has("snippet 0")).toBe(false);
    expect(r.has("snippet 59")).toBe(true);
    expect(r.size()).toBe(40);
  });

  it("never stores the text itself", () => {
    const store: Record<string, string> = {};
    const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) };
    createRegistry(storage).add("SECRET_TOKEN_123 = 'abc'");
    expect(JSON.stringify(store)).not.toContain("SECRET_TOKEN_123");
  });
});

describe("isTrustedSnippet (commands from the SOW's bash blocks)", () => {
  const { isTrustedSnippet } = guardModule.internals;
  const blocks = ["cd ~\ncomposer create-project laravel/laravel hospital-management-system\nphp artisan serve --host=0.0.0.0 --port=8000"];

  it("allows the whole block, one line of it, or a part of a line", () => {
    expect(isTrustedSnippet(blocks[0], blocks)).toBe(true);
    expect(isTrustedSnippet("composer create-project laravel/laravel hospital-management-system\n", blocks)).toBe(true);
    expect(isTrustedSnippet("php artisan serve", blocks)).toBe(true);
  });

  it("refuses anything that is not in a block, and one-character noise", () => {
    expect(isTrustedSnippet("composer require evil/package", blocks)).toBe(false);
    expect(isTrustedSnippet("<?php echo 1;", blocks)).toBe(false);
    expect(isTrustedSnippet("c", blocks)).toBe(false);
    expect(isTrustedSnippet("anything", [])).toBe(false);
  });
});

describe("typing watch", () => {
  const { createTypingWatch } = guardModule.internals;

  it("flags more characters in two seconds than a person can type, once per half minute", () => {
    const seen: string[] = [];
    let t = 0;
    const watch = createTypingWatch((k: string) => seen.push(k), () => t);
    for (let i = 0; i < 80; i++) {
      t += 20; // 50 characters a second
      watch(true);
    }
    expect(seen.filter((k) => k === "fast_typing")).toHaveLength(1);
  });

  it("does not flag ordinary fast typing", () => {
    const seen: string[] = [];
    let t = 0;
    const watch = createTypingWatch((k: string) => seen.push(k), () => t);
    for (let i = 0; i < 200; i++) {
      t += 70 + ((i * 37) % 90); // 6-12 characters a second, irregular
      watch(true);
    }
    expect(seen).toEqual([]);
  });

  it("flags metronome-regular keystrokes", () => {
    const seen: string[] = [];
    let t = 0;
    const watch = createTypingWatch((k: string) => seen.push(k), () => t);
    for (let i = 0; i < 60; i++) {
      t += 60 + (i % 2); // a bot with a fixed delay
      watch(true);
    }
    expect(seen).toContain("robotic_typing");
  });

  it("ignores keys that are not characters", () => {
    const seen: string[] = [];
    let t = 0;
    const watch = createTypingWatch((k: string) => seen.push(k), () => t);
    for (let i = 0; i < 200; i++) {
      t += 5;
      watch(false);
    }
    expect(seen).toEqual([]);
  });
});

// ───────────────────────────── the guard ─────────────────────────────

describe("paste", () => {
  it("refuses text from outside, tells the student, and records only the size", () => {
    const r = rig();
    const pasted = "public function secret() { return 'FROM_CHATGPT'; }";
    const ev = pasteText(r, pasted);

    expect(ev.defaultPrevented).toBe(true);
    expect(kinds(r)).toEqual(["paste_blocked"]);
    expect(JSON.stringify(r.guard.state().queue)).not.toContain("FROM_CHATGPT");
    expect(r.guard.state().queue[0].size).toBe(pasted.length);
    expect(r.win.document.querySelector("[data-aptrun-guard-notice]")).not.toBeNull();
  });

  it("allows text copied inside the workspace, including a whole file into another folder", () => {
    const r = rig();
    const file = "<?php\n\nnamespace App;\n\nclass Patient {}\n";
    copyInside(r, file);

    const ev = pasteText(r, file);
    expect(ev.defaultPrevented).toBe(false);
    expect(kinds(r)).toEqual(["paste_internal"]);
  });

  it("allows it with different line endings (a Windows clipboard)", () => {
    const r = rig();
    copyInside(r, "line one\nline two");
    expect(pasteText(r, "line one\r\nline two").defaultPrevented).toBe(false);
  });

  it("refuses outside text even after something unrelated was copied inside", () => {
    const r = rig();
    copyInside(r, "my own code");
    expect(pasteText(r, "their code").defaultPrevented).toBe(true);
  });

  it("allows a command from a SOW bash block, and nothing else from outside", () => {
    const r = rig();
    r.guard.applyPolicy({ mode: "enforce", trusted: ["composer create-project laravel/laravel app\nphp artisan serve"] });

    expect(pasteText(r, "composer create-project laravel/laravel app").defaultPrevented).toBe(false);
    expect(kinds(r)).toContain("paste_trusted");
    expect(pasteText(r, "composer create-project evil/thing").defaultPrevented).toBe(true);
  });

  it("refuses pasted files that are not assets and allows images", () => {
    const r = rig();
    const dt = new FakeDataTransfer();
    dt.files = [{ name: "Patient.php", size: 5 }];
    const bad = clipboardEvent(r.win, "paste", dt);
    r.textarea.dispatchEvent(bad);
    expect((bad as Event).defaultPrevented).toBe(true);

    const ok = new FakeDataTransfer();
    ok.files = [{ name: "logo.png", size: 5 }];
    const good = clipboardEvent(r.win, "paste", ok);
    r.textarea.dispatchEvent(good);
    expect((good as Event).defaultPrevented).toBe(false);
  });

  it("fails closed: with no policy it enforces", () => {
    const r = rig();
    expect(r.guard.state().policy.mode).toBe("enforce");
    expect(pasteText(r, "outside").defaultPrevented).toBe(true);
  });

  it("report mode lets it through but records what it would have blocked", () => {
    const r = rig();
    r.guard.applyPolicy({ mode: "report", trusted: [] });
    expect(pasteText(r, "outside").defaultPrevented).toBe(false);
    expect(r.guard.state().queue[0]).toMatchObject({ kind: "paste_blocked", meta: { reportOnly: true } });
  });

  it("open mode does nothing at all", () => {
    const r = rig();
    r.guard.applyPolicy({ mode: "open", trusted: [] });
    expect(pasteText(r, "outside").defaultPrevented).toBe(false);
    expect(kinds(r)).toEqual([]);
  });

  it("refuses a script-made paste event (the real guard does not trust untrusted events)", () => {
    const r = rig({ trustAllEvents: false });
    const ev = pasteText(r, "typed by a console script");
    expect(ev.defaultPrevented).toBe(true);
    expect(kinds(r)).toEqual(["synthetic_blocked"]);
  });

  it("ignores an invalid policy", () => {
    const r = rig();
    r.guard.applyPolicy({ mode: "nope", trusted: [] });
    expect(r.guard.state().policy.mode).toBe("enforce");
  });
});

describe("beforeinput", () => {
  function inputEvent(r: Rig, init: { inputType: string; data?: string; isComposing?: boolean }) {
    const ev = new r.win.Event("beforeinput", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "inputType", { value: init.inputType });
    Object.defineProperty(ev, "data", { value: init.data ?? null });
    Object.defineProperty(ev, "isComposing", { value: init.isComposing ?? false });
    r.textarea.dispatchEvent(ev);
    return ev as Event;
  }

  it("refuses a long text inserted in one go (a console execCommand, a text-expander)", () => {
    const r = rig();
    expect(inputEvent(r, { inputType: "insertText", data: "x".repeat(60) }).defaultPrevented).toBe(true);
    expect(kinds(r)).toEqual(["bulk_insert_blocked"]);
  });

  it("only notes a medium insertion, and never touches typing or composition", () => {
    const r = rig();
    expect(inputEvent(r, { inputType: "insertText", data: "a" }).defaultPrevented).toBe(false);
    expect(inputEvent(r, { inputType: "insertText", data: "x".repeat(12) }).defaultPrevented).toBe(false);
    expect(inputEvent(r, { inputType: "insertText", data: "x".repeat(60), isComposing: true }).defaultPrevented).toBe(false);
    expect(kinds(r)).toEqual(["bulk_insert"]);
  });

  it("refuses an unjudged insertFromPaste but not the one that follows an allowed paste", () => {
    const r = rig();
    expect(inputEvent(r, { inputType: "insertFromPaste", data: "outside" }).defaultPrevented).toBe(true);

    copyInside(r, "inside");
    pasteText(r, "inside");
    expect(inputEvent(r, { inputType: "insertFromPaste" }).defaultPrevented).toBe(false);
  });
});

describe("drag and drop", () => {
  function dropEvent(r: Rig, dt: FakeDataTransfer, type = "drop") {
    const ev = new r.win.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "dataTransfer", { value: dt });
    r.textarea.dispatchEvent(ev);
    return ev as Event;
  }

  it("refuses text dragged in from another window, and says so while hovering", () => {
    const r = rig();
    const dt = new FakeDataTransfer();
    dt.setData("text/plain", "dragged from a web page");

    const later = vi.fn();
    r.win.document.addEventListener("dragover", later);
    dropEvent(r, dt, "dragover");
    expect(later).not.toHaveBeenCalled();
    expect(dt.dropEffect).toBe("none");

    expect(dropEvent(r, dt).defaultPrevented).toBe(true);
    expect(kinds(r)).toEqual(["drop_blocked"]);
  });

  it("allows a drag that started inside the workspace", () => {
    const r = rig();
    const start = new r.win.Event("dragstart", { bubbles: true });
    r.textarea.dispatchEvent(start);

    const dt = new FakeDataTransfer();
    dt.setData("text/plain", "moving this text");
    expect(dropEvent(r, dt).defaultPrevented).toBe(false);
    expect(kinds(r)).toEqual([]);
  });

  it("refuses dropped source files and accepts an image", () => {
    const r = rig();
    const code = new FakeDataTransfer();
    code.types = ["Files"];
    code.files = [{ name: "Patient.php", size: 400 }];
    expect(dropEvent(r, code).defaultPrevented).toBe(true);

    const img = new FakeDataTransfer();
    img.types = ["Files"];
    img.files = [{ name: "logo.png", size: 4000 }];
    expect(dropEvent(r, img).defaultPrevented).toBe(false);
    expect(kinds(r)).toEqual(["drop_blocked", "drop_asset"]);
  });

  it("leaves a file drag alone while hovering (it is judged on drop, when the names are readable)", () => {
    const r = rig();
    const dt = new FakeDataTransfer();
    dt.types = ["Files"];
    const later = vi.fn();
    r.win.document.addEventListener("dragover", later);
    dropEvent(r, dt, "dragover");
    expect(later).toHaveBeenCalled();
  });
});

describe("file inputs, pickers and windows", () => {
  it("clears and refuses a non-asset chosen in an Upload… file input", () => {
    const r = rig();
    const input = r.win.document.createElement("input");
    input.type = "file";
    r.win.document.body.appendChild(input);
    Object.defineProperty(input, "files", { value: [{ name: "backup.zip", size: 10 }] });
    const spy = vi.fn();
    input.value = "";
    input.addEventListener("change", spy);

    input.dispatchEvent(new r.win.Event("change", { bubbles: true, cancelable: true }));
    expect(spy).not.toHaveBeenCalled();
    expect(kinds(r)).toEqual(["upload_blocked"]);
  });

  it("refuses the directory picker", async () => {
    const r = rig();
    await expect(r.win.showDirectoryPicker()).rejects.toMatchObject({ name: "AbortError" });
    expect(kinds(r)).toEqual(["upload_blocked"]);
  });

  it("lets a file picker return an image but not source code", async () => {
    expect(await rig({ pickerName: "logo.png" }).win.showOpenFilePicker()).toEqual([{ name: "logo.png" }]);

    const code = rig({ pickerName: "Patient.php" });
    await expect(code.win.showOpenFilePicker()).rejects.toMatchObject({ name: "AbortError" });
    expect(kinds(code)).toEqual(["upload_blocked"]);
  });

  it("refuses to open a blank extra window, but lets a real link through", () => {
    const r = rig();
    expect(r.win.open("about:blank")).toBeNull();
    expect(r.win.open("")).toBeNull();
    expect(kinds(r)).toEqual(["window_blocked", "window_blocked"]);

    expect(r.win.open("https://laravel.com/docs")).toEqual({ closed: false });
    expect(r.win.__opened).toHaveLength(1);
  });
});

describe("the clipboard API (the terminal's and the context menu's Paste)", () => {
  it("answers empty for text from outside and the text for what was copied inside", async () => {
    const outside = rig({ clipboard: "text from another tab" });
    const nav = new outside.win.Clipboard();
    nav.text = "text from another tab";
    expect(await nav.readText()).toBe("");
    expect(kinds(outside)).toEqual(["clipboard_read_blocked"]);

    const inside = rig();
    const clip = new inside.win.Clipboard();
    await clip.writeText("npm run build"); // the terminal copies via writeText
    expect(await clip.readText()).toBe("npm run build");
    expect(kinds(inside)).toEqual(["paste_internal"]);
  });

  it("still reads it in report mode", async () => {
    const r = rig();
    r.guard.applyPolicy({ mode: "report", trusted: [] });
    const clip = new r.win.Clipboard();
    clip.text = "outside";
    expect(await clip.readText()).toBe("outside");
    expect(kinds(r)).toEqual(["clipboard_read_blocked"]);
  });

  it("cannot be switched off by assigning over the patched methods", () => {
    const r = rig();
    const proto = r.win.Clipboard.prototype;
    try {
      proto.readText = () => Promise.resolve("anything");
    } catch {
      /* strict mode throws, sloppy ignores: either way it stays patched */
    }
    expect(Object.getOwnPropertyDescriptor(proto, "readText")?.writable).toBe(false);
  });
});

describe("text put in by a script or a browser extension", () => {
  function editorInput(r: Rig) {
    const wrap = r.win.document.createElement("div");
    wrap.className = "monaco-editor";
    const ta = r.win.document.createElement("textarea");
    wrap.appendChild(ta);
    r.win.document.body.appendChild(wrap);
    ta.focus();
    return ta as HTMLTextAreaElement;
  }

  it("refuses execCommand('insertText') of outside text into the editor (a text-expander extension)", () => {
    const r = rig();
    editorInput(r);

    expect(r.win.document.execCommand("insertText", false, "x".repeat(60))).toBe(false);
    expect(r.win.__execCalls).toHaveLength(0);
    expect(r.guard.state().queue[0]).toMatchObject({ kind: "bulk_insert_blocked", meta: { via: "execCommand" } });
  });

  it("lets execCommand insert a single character, text copied inside, or anything outside the editor and terminal", () => {
    const r = rig();
    const ta = editorInput(r);

    expect(r.win.document.execCommand("insertText", false, "a")).toBe(true);

    copyInside(r, "copied inside the workspace");
    ta.focus();
    expect(r.win.document.execCommand("insertText", false, "copied inside the workspace")).toBe(true);

    const quickInput = r.win.document.createElement("input"); // VS Code's own file-dialog autocomplete lives here
    r.win.document.body.appendChild(quickInput);
    quickInput.focus();
    expect(r.win.document.execCommand("insertText", false, "x".repeat(60))).toBe(true);
    expect(kinds(r)).not.toContain("bulk_insert_blocked");
  });

  it("report mode records it but lets the insertion through", () => {
    const r = rig();
    editorInput(r);
    r.guard.applyPolicy({ mode: "report", trusted: [] });
    expect(r.win.document.execCommand("insertText", false, "x".repeat(60))).toBe(true);
    expect(kinds(r)).toEqual(["bulk_insert_blocked"]);
  });

  it("ignores script-made input and composition events in the editor, but not in other boxes", () => {
    const r = rig({ trustAllEvents: false });
    const ta = editorInput(r);

    const seen = vi.fn();
    ta.addEventListener("input", seen);
    ta.dispatchEvent(new r.win.Event("input", { bubbles: true, cancelable: true }));
    expect(seen).not.toHaveBeenCalled();
    expect(kinds(r)).toEqual(["synthetic_blocked"]);

    const plain = r.win.document.createElement("input");
    r.win.document.body.appendChild(plain);
    const other = vi.fn();
    plain.addEventListener("input", other);
    plain.dispatchEvent(new r.win.Event("input", { bubbles: true }));
    expect(other).toHaveBeenCalled(); // VS Code dispatches input events itself in its find/quick-input boxes
  });
});

describe("the editor's input path", () => {
  it("removes EditContext so VS Code falls back to the observable textarea input", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
    const win = dom.window;
    openWindows.push(win);
    win.EditContext = function EditContext() {};
    expect(typeof win.EditContext).toBe("function");

    guardModule.createGuard(win, { setTimeout: () => 0 }).start();
    expect(typeof win.EditContext).toBe("undefined");
  });

  it("does not mind a browser that has no EditContext", () => {
    const r = rig();
    expect(typeof r.win.EditContext).toBe("undefined");
  });
});

describe("messages with the embedding dashboard", () => {
  it("says hello to its parent, and applies the policy only from that parent", () => {
    const r = rig({ withParent: true });
    expect(r.posted[0]).toMatchObject({ aptrun: "guard", type: "hello" });

    const message = (data: unknown, source: unknown) => {
      const ev = new r.win.Event("message");
      Object.defineProperty(ev, "data", { value: data });
      Object.defineProperty(ev, "source", { value: source });
      r.win.dispatchEvent(ev);
    };

    message({ aptrun: "guard-policy", mode: "open", trusted: [] }, r.win); // not the parent: ignored
    expect(r.guard.state().policy.mode).toBe("enforce");

    message({ aptrun: "guard-policy", mode: "report", trusted: ["ls -la"] }, r.parent);
    expect(r.guard.state().policy.mode).toBe("report");
  });

  it("batches events to the parent without any clipboard text in them", () => {
    const r = rig({ withParent: true });
    pasteText(r, "SECRET_FROM_OUTSIDE");
    r.timers.forEach((fn) => fn());

    const events = r.posted.filter((m) => (m as { type: string }).type === "events");
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("SECRET_FROM_OUTSIDE");
    expect(JSON.stringify(events)).toContain("paste_blocked");
  });
});
