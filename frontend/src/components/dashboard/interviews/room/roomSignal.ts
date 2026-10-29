import { useRef } from "react";

/**
 * Two numbers the interview room's visuals follow, shared by plain reference instead of React state: the microphone level changes ~60 times
 * a second and the orb and mic meter redraw on their own animation frames, so putting it in state would re-render the whole interview for
 * nothing. Writers (the voice engine's callbacks) assign; readers (the orb, the meter) sample inside their own frame loop.
 */
export interface RoomSignal {
  /** Latest microphone level, 0-1. Only meaningful while the candidate is being listened to. */
  level: number;
  /** A beat of speech energy, 0-1, set to 1 each time the interviewer's voice reaches a new word and left for the orb to let fall away. */
  pulse: number;
}

export function useRoomSignal(): RoomSignal {
  const ref = useRef<RoomSignal>({ level: 0, pulse: 0 });
  return ref.current;
}
