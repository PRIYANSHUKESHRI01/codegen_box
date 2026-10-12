/**
 * The dashboard's half of the editor's authorship guard (infra/workspaces/guard/aptrun-guard.js).
 *
 * The guard lives inside the VS Code frame and refuses text pasted from outside the workspace. This module is
 * what the page does for it: answer its hello with the policy the SERVER chose, hand it the commands from the SOW's
 * bash blocks (those may be pasted), and relay what it reports to the API — metadata only, never any text.
 *
 * Messages are accepted only from the editor frame's own window AND its origin, so no other page, tab or script on
 * the dashboard can pose as the guard or change the policy. Kept free of React so it is unit-tested.
 */

export type GuardMode = "enforce" | "report" | "open";

export interface GuardEvent {
  id: string;
  t: number;
  kind: string;
  size: number | null;
  target: string | null;
  meta?: Record<string, unknown>;
}

export type GuardInbound =
  | { type: "hello"; v: string }
  | { type: "alive"; v: string; mode?: string }
  | { type: "events"; v: string; events: GuardEvent[] };

export interface IntegrityPayload {
  v: string;
  active: boolean;
  events: GuardEvent[];
}

/**
 * "outdated": the editor loaded but its guard never said hello. The usual cause is a workspace started before the
 * guard was in the image (a container keeps the editor it was created with), which a restart fixes; a browser
 * extension blocking the script looks the same. "missing": it answered before and has gone quiet.
 */
export type GuardStatus = "off" | "starting" | "active" | "missing" | "outdated";

export interface GuardCounters {
  /** Pastes, drops and uploads from outside that were refused this session. */
  refused: number;
  /** Copy-and-paste that worked because it stayed inside the workspace (or came from a SOW command). */
  inside: number;
}

/** Fence languages whose content is a command to run, not code to write. */
export const COMMAND_FENCES = ["bash", "sh", "shell", "zsh", "console", "terminal"];

const REFUSED_KINDS = new Set(["paste_blocked", "clipboard_read_blocked", "drop_blocked", "upload_blocked", "bulk_insert_blocked", "synthetic_blocked"]);
const INSIDE_KINDS = new Set(["paste_internal", "paste_trusted"]);

const MAX_BLOCK = 4_000;
const MAX_BLOCKS = 40;
const MAX_TOTAL = 60_000;

/** The SOW's `bash`/`sh`/… fenced blocks: the commands a student may paste. Code fences in other languages must be typed. */
export function extractCommandBlocks(markdown: string | null | undefined): string[] {
  if (!markdown) return [];

  const blocks: string[] = [];
  let total = 0;
  let current: string[] | null = null;
  let capture = false;

  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s*```+\s*([A-Za-z0-9_+-]*)/.exec(line);

    if (fence && current === null) {
      current = [];
      capture = COMMAND_FENCES.includes(fence[1].toLowerCase());
    } else if (fence && current !== null) {
      const text = current.join("\n").replace(/^\n+|\n+$/g, "").slice(0, MAX_BLOCK);
      if (capture && text !== "" && blocks.length < MAX_BLOCKS && total + text.length <= MAX_TOTAL) {
        blocks.push(text);
        total += text.length;
      }
      current = null;
      capture = false;
    } else if (current !== null) {
      current.push(line);
    }
  }

  return blocks;
}

/** Narrow whatever arrived in a message event to a guard message, or null. */
export function parseGuardMessage(data: unknown): GuardInbound | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.aptrun !== "guard" || typeof d.v !== "string" || d.v.length > 16) return null;

  if (d.type === "hello") return { type: "hello", v: d.v };
  if (d.type === "alive") return { type: "alive", v: d.v, mode: typeof d.mode === "string" ? d.mode : undefined };

  if (d.type === "events" && Array.isArray(d.events)) {
    const events: GuardEvent[] = [];
    for (const raw of d.events.slice(0, 200)) {
      if (typeof raw !== "object" || raw === null) continue;
      const e = raw as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.kind !== "string" || typeof e.t !== "number") continue;
      events.push({
        id: e.id,
        t: e.t,
        kind: e.kind,
        size: typeof e.size === "number" ? e.size : null,
        target: typeof e.target === "string" ? e.target : null,
        ...(typeof e.meta === "object" && e.meta !== null ? { meta: e.meta as Record<string, unknown> } : {}),
      });
    }
    return { type: "events", v: d.v, events };
  }

  return null;
}

export interface BridgeDeps {
  /** The editor frame's window, or null while there is none. */
  frameWindow: () => { postMessage: (message: unknown, targetOrigin: string) => void } | null;
  /** The editor frame's origin, e.g. "https://ws-abc.example.com". */
  frameOrigin: () => string | null;
  mode: () => GuardMode;
  commands: () => string[];
  send: (payload: IntegrityPayload, options: { keepalive: boolean }) => Promise<unknown>;
  now?: () => number;
}

/** How long without hearing from the guard before it counts as not running. */
export const STALE_AFTER_MS = 45_000;
/** How long after the editor frame has loaded to wait for the guard's first hello before saying it is not there. */
export const FIRST_HELLO_GRACE_MS = 15_000;
const MAX_QUEUE = 500;
const MAX_PER_CALL = 50;

export class GuardBridge {
  private readonly now: () => number;
  private lastHeardAt: number | null = null;
  private frameLoadedAt: number | null = null;
  private version = "";
  private queue: GuardEvent[] = [];
  private seen = new Set<string>();
  private flushing = false;
  private readonly counters: GuardCounters = { refused: 0, inside: 0 };

  constructor(private readonly deps: BridgeDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  /** Feed every `message` event on the page through this; it ignores anything that is not the editor frame's guard. */
  handleMessage(event: { source: unknown; origin: string; data: unknown }): boolean {
    const frame = this.deps.frameWindow();
    const origin = this.deps.frameOrigin();

    if (frame === null || origin === null || event.source !== frame || event.origin !== origin) return false;

    const message = parseGuardMessage(event.data);
    if (message === null) return false;

    this.lastHeardAt = this.now();
    this.version = message.v;

    if (message.type === "hello") {
      this.sendPolicy();
    } else if (message.type === "events") {
      this.accept(message.events);
    }

    return true;
  }

  private sendPolicy(): void {
    const frame = this.deps.frameWindow();
    const origin = this.deps.frameOrigin();
    if (frame === null || origin === null) return;

    // Addressed to the editor's own origin, never "*": the policy is not for any other page.
    frame.postMessage({ aptrun: "guard-policy", mode: this.deps.mode(), trusted: this.deps.commands() }, origin);
  }

  private accept(events: GuardEvent[]): void {
    for (const e of events) {
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      this.queue.push(e);

      if (REFUSED_KINDS.has(e.kind)) this.counters.refused++;
      else if (INSIDE_KINDS.has(e.kind)) this.counters.inside++;
    }

    if (this.queue.length > MAX_QUEUE) this.queue = this.queue.slice(this.queue.length - MAX_QUEUE);
    if (this.seen.size > 5_000) this.seen = new Set(Array.from(this.seen).slice(-1_000));
  }

  /**
   * The editor frame finished loading. The guard is the first script on its page, so by now it has either said hello or
   * it is not there: the wait for a first hello starts here, not when the page asked for the frame (a slow start of the
   * workspace must not look like a missing guard).
   */
  frameLoaded(): void {
    this.frameLoadedAt = this.now();
  }

  status(): GuardStatus {
    if (this.deps.mode() === "open") return "off";

    const t = this.now();
    if (this.lastHeardAt === null) {
      if (this.frameLoadedAt === null) return "starting";

      return t - this.frameLoadedAt < FIRST_HELLO_GRACE_MS ? "starting" : "outdated";
    }

    return t - this.lastHeardAt <= STALE_AFTER_MS ? "active" : "missing";
  }

  snapshot(): { status: GuardStatus; counters: GuardCounters; version: string } {
    return { status: this.status(), counters: { ...this.counters }, version: this.version };
  }

  /**
   * Send what has been collected, and (while the guard is answering) the fact that it is running. Failed sends keep
   * their events for the next try. In an "open" project nothing is sent: there is nothing to evidence.
   */
  async flush(keepalive = false): Promise<void> {
    if (this.flushing || this.deps.mode() === "open") return;

    const active = this.status() === "active";
    if (this.queue.length === 0 && !active) return;

    this.flushing = true;
    const batch = this.queue.splice(0, MAX_PER_CALL);
    let sent = false;

    try {
      await this.deps.send({ v: this.version || "unknown", active, events: batch }, { keepalive });
      sent = true;
    } catch {
      // Keep them and try again on the next flush (order does not matter to the server).
      this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE);
    } finally {
      this.flushing = false;
    }

    // More waiting than one call carries: carry on until the queue is empty (but never spin on a failing server).
    if (sent && this.queue.length > 0) await this.flush(keepalive);
  }
}
