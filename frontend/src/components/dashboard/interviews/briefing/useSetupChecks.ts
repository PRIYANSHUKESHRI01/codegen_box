"use client";

import { useEffect, useState } from "react";
import { hasMediaRecorder, hasSpeechRecognition, hasSpeechSynthesis } from "@/lib/voice/VoiceEngine";

export interface SetupCheck {
  id: "voice" | "speech" | "devices" | "fullscreen" | "network";
  label: string;
  detail: string;
  /** ok = fine; info = nothing wrong, just good to know; warn = something the candidate may want to fix first. */
  state: "ok" | "info" | "warn";
}

type Permission = "granted" | "denied" | "prompt" | "unknown";

async function permission(name: string): Promise<Permission> {
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state;
  } catch {
    return "unknown"; // Firefox and Safari don't expose camera / microphone here
  }
}

/**
 * What this browser can do for an interview, read off the page itself — nothing is guessed or faked: the voice and speech-recognition rows
 * are the very feature checks the interview runs on, the camera row is the browser's own permission state, and so on. It lets the briefing
 * page say "you will type your answers" or "your camera is blocked" while there is time to do something about it, instead of the candidate
 * finding out in fullscreen. Null until the first reading (it can only be taken in the browser).
 */
export function useSetupChecks(): SetupCheck[] | null {
  const [checks, setChecks] = useState<SetupCheck[] | null>(null);

  useEffect(() => {
    let alive = true;

    const read = async () => {
      const [camera, microphone] = await Promise.all([permission("camera"), permission("microphone")]);
      if (!alive) return;

      const denied = camera === "denied" || microphone === "denied";
      const granted = camera === "granted" && microphone === "granted";
      const speech = hasSpeechRecognition() && hasMediaRecorder();

      setChecks([
        hasSpeechSynthesis()
          ? { id: "voice", label: "Interviewer's voice", detail: "Questions are read aloud to you", state: "ok" }
          : { id: "voice", label: "Interviewer's voice", detail: "This browser can't speak, so questions will be shown as text", state: "warn" },
        speech
          ? { id: "speech", label: "Speaking your answers", detail: "Your words are written out live as you speak", state: "ok" }
          : { id: "speech", label: "Speaking your answers", detail: "Not supported here — you'll type your answers. Chrome or Edge lets you speak.", state: "warn" },
        denied
          ? { id: "devices", label: "Camera & microphone", detail: "Blocked for this site — allow them in the address bar, then reload", state: "warn" }
          : granted
            ? { id: "devices", label: "Camera & microphone", detail: "Allowed", state: "ok" }
            : { id: "devices", label: "Camera & microphone", detail: "You'll be asked to allow them when you start", state: "info" },
        document.fullscreenEnabled
          ? { id: "fullscreen", label: "Fullscreen", detail: "Supported — the interview runs full screen", state: "ok" }
          : { id: "fullscreen", label: "Fullscreen", detail: "This browser can't go fullscreen, which the interview needs", state: "warn" },
        navigator.onLine
          ? { id: "network", label: "Connection", detail: "You're online", state: "ok" }
          : { id: "network", label: "Connection", detail: "You're offline — reconnect before you start", state: "warn" },
      ]);
    };

    void read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      alive = false;
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  return checks;
}
