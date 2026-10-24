import type { WebEventType } from "../types";

type Emit = (type: WebEventType, data?: Record<string, unknown>) => void;

export interface NetView {
  /** Public addresses a STUN server saw for this browser. */
  srflx: string[];
  /** Local addresses (with camera permission Chrome shows the real ones, otherwise obfuscated mDNS names — those are dropped). */
  host: string[];
}

const CANDIDATE = /candidate:\S+ \d+ (?:udp|tcp) \d+ ([0-9a-fA-F:.]+) \d+ typ (host|srflx|prflx|relay)/i;

/** Pulls the address out of an ICE candidate line. Obfuscated `xxxx.local` hosts do not match and are ignored. */
export function parseCandidate(line: string): { ip: string; kind: string } | null {
  const m = CANDIDATE.exec(line);

  return m ? { ip: m[1], kind: m[2].toLowerCase() } : null;
}

/**
 * Asks WebRTC what this browser's addresses look like from the outside. The server compares the public one with the
 * address the HTTPS request arrived from: when they differ, something is relaying one of the two (a proxy for the page,
 * a VPN that did not capture UDP, a remote machine). It is a signal, not a verdict — corporate NAT with several exits looks
 * the same — so the server only records it for a reviewer.
 *
 * Runs once at start and every few minutes. Blocked UDP, no WebRTC, a policy that forbids it: it just reports nothing.
 */
export function startNetworkProbe(stunServers: string[], onResult: (view: NetView) => void, everyMs = 180_000, timeoutMs = 4000): () => void {
  let stopped = false;

  const probe = () => {
    if (stopped || typeof RTCPeerConnection === "undefined") return;

    const view: NetView = { srflx: [], host: [] };
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: stunServers.length ? [{ urls: stunServers }] : [] });
    } catch {
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      if (!stopped && (view.srflx.length || view.host.length)) onResult({ srflx: Array.from(new Set(view.srflx)), host: Array.from(new Set(view.host)) });
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return finish();
      const c = parseCandidate(e.candidate.candidate);
      if (!c) return;
      if (c.kind === "srflx" || c.kind === "prflx") view.srflx.push(c.ip);
      else if (c.kind === "host") view.host.push(c.ip);
    };

    try {
      pc.createDataChannel("probe");
      void pc
        .createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(finish);
    } catch {
      finish();

      return;
    }
    window.setTimeout(finish, timeoutMs);
  };

  probe();
  const timer = window.setInterval(probe, everyMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}

/** Offline stretches become a single `offline_period` event with their length when the connection returns. */
export function installConnectivityDetector(emit: Emit): () => void {
  let offlineAt: number | null = navigator.onLine ? null : Date.now();

  const onOffline = () => {
    offlineAt ??= Date.now();
  };
  const onOnline = () => {
    if (offlineAt !== null) emit("offline_period", { seconds: Math.round((Date.now() - offlineAt) / 1000) });
    offlineAt = null;
  };

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);

  return () => {
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
  };
}
