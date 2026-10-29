// Microphone level maths, shared by the voice engine (which meters an answer as it is recorded) and the interview room (which meters the
// microphone in the lobby and watches for a silent one). Kept apart from the engine so neither has to pull in the speech APIs to use them.

/** Normalized level above which a frame counts as someone speaking. Deliberately low (room hiss is ~0.02-0.04): a quiet speaker must still register, because the server rejects silence anyway. */
export const VOICED_LEVEL = 0.05;

/** RMS of a time-domain byte buffer (128 = silence), normalized to roughly 0-1 for typical speech levels. */
export function computeRmsLevel(data: Uint8Array): number {
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const centered = (data[i] - 128) / 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  return Math.min(1, rms * 4); // typical speech RMS is small; scale up so the meter isn't perpetually near-empty
}
