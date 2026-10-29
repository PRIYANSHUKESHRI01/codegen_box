"use client";

import { useEffect, useState } from "react";
import { computeRmsLevel, VOICED_LEVEL } from "@/lib/voice/level";
import type { RoomSignal } from "./roomSignal";

/** How much actual speech the lobby wants to hear before it says the microphone works. */
const HEARD_AFTER_MS = 350;

/**
 * A live microphone check for the lobby: reads the level of `stream`'s audio into `signal` on every animation frame, and flips `heard` to
 * true once it has picked up a little real speech. Only listens — nothing is recorded or sent anywhere — and stops the moment `active` is
 * false or the stream goes away.
 *
 * It works from the same camera-and-microphone stream the proctoring engine already opened, so the candidate isn't asked for the mic twice
 * and the check proves the very device the interview will use.
 */
export function useMicLevel(stream: MediaStream | null, active: boolean, signal: RoomSignal): boolean {
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    signal.level = 0;
    const tracks = stream?.getAudioTracks() ?? [];
    if (!active || tracks.length === 0) return;

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    let context: AudioContext;
    try {
      context = new Ctor();
    } catch {
      return;
    }
    const source = context.createMediaStreamSource(new MediaStream(tracks));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    void context.resume?.().catch(() => undefined);

    const buffer = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let voicedMs = 0;
    let last = performance.now();
    let confirmed = false;

    const tick = (now: number) => {
      analyser.getByteTimeDomainData(buffer);
      const level = computeRmsLevel(buffer);
      signal.level = level;
      if (level > VOICED_LEVEL * 2) voicedMs += now - last;
      last = now;
      if (!confirmed && voicedMs >= HEARD_AFTER_MS) {
        confirmed = true;
        setHeard(true);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close().catch(() => undefined);
      signal.level = 0;
    };
  }, [stream, active, signal]);

  return heard;
}
