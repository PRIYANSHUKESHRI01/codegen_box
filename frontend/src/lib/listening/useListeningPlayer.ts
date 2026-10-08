"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createBrowserDeps, ListeningPlayerEngine, type EngineRules, type PlayerSnapshot, type Segment } from "./playerEngine";
import { availableAccents, type AccentPref, type SpeakerSpec } from "./voices";

const SERVER_SNAPSHOT: PlayerSnapshot = {
  status: "idle",
  index: 0,
  total: 0,
  plays: 0,
  rate: 1,
  accent: "auto",
  voiceName: null,
  voiceCount: 0,
  problem: null,
  single: false,
};

interface Options {
  segments: Segment[];
  /** Null/empty for a single-speaker passage or a dictation. */
  speakers: SpeakerSpec[] | null;
  rules?: Partial<EngineRules>;
}

/**
 * React binding for ListeningPlayerEngine. One engine per mounted lesson; it
 * is rebuilt only when the lesson itself changes, never on a re-render, and is
 * always torn down on unmount so audio can never keep playing after the
 * student navigates away.
 */
export function useListeningPlayer({ segments, speakers, rules }: Options) {
  const engineRef = useRef<ListeningPlayerEngine | null>(null);
  if (engineRef.current === null && typeof window !== "undefined") {
    engineRef.current = new ListeningPlayerEngine(createBrowserDeps());
  }
  const engine = engineRef.current;

  const subscribe = useMemo(() => engine?.subscribe ?? (() => () => {}), [engine]);
  const snapshot = useSyncExternalStore(
    subscribe,
    () => engine?.getSnapshot() ?? SERVER_SNAPSHOT,
    () => SERVER_SNAPSHOT
  );

  // A new lesson (or a different speaker cast) resets the player.
  const lessonKey = useMemo(() => `${segments.length}:${segments[0]?.text ?? ""}:${(speakers ?? []).map((s) => s.key).join(",")}`, [segments, speakers]);
  useEffect(() => {
    engine?.load(segments, speakers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, lessonKey]);

  const maxPlays = rules?.maxPlays ?? null;
  const locked = rules?.locked ?? false;
  useEffect(() => {
    engine?.configure({ maxPlays, locked });
  }, [engine, maxPlays, locked]);

  useEffect(() => {
    engine?.connect();
    return () => engine?.dispose();
  }, [engine]);

  const accents = useMemo<AccentPref[]>(
    () => ["auto", ...(engine ? availableAccents(engine.voiceList) : [])],
    // snapshot.voiceCount changes when the browser finishes loading its voices
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, snapshot.voiceCount]
  );

  return {
    snapshot,
    supported: engine?.supported ?? false,
    accents,
    /** Back to the first sentence with zero plays used — call at the start of every attempt so an exam retry gets its plays back. */
    reset: () => engine?.load(segments, speakers),
    play: () => engine?.play(),
    pause: () => engine?.pause(),
    toggle: () => engine?.toggle(),
    seek: (index: number) => engine?.seek(index),
    replayCurrent: () => engine?.replayCurrent(),
    playOne: (index: number) => engine?.playOne(index),
    setRate: (rate: number) => engine?.setRate(rate),
    setAccent: (accent: AccentPref) => engine?.setAccent(accent),
    stop: () => engine?.pause(),
  };
}
