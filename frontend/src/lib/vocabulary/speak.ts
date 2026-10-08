import { rankVoices, type VoiceLike } from "@/lib/listening/voices";

/**
 * Says a word or short phrase aloud with the browser's own speech synthesis,
 * reusing the Listening Lab's voice ranking (Indian English first, then
 * British, then American — the accents a student here will actually hear).
 *
 * Everything degrades quietly: a browser with no speech support, or a headless
 * one with an empty voice list, simply plays nothing.
 */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Speaks `text` once. `onEnd` is called when it finishes or fails, and always within a few seconds even if the browser never reports it. */
export function speak(text: string, onEnd?: () => void): void {
  if (!canSpeak() || !text.trim()) {
    onEnd?.();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new window.SpeechSynthesisUtterance(text);
  const voice = rankVoices(synth.getVoices() as VoiceLike[], "auto")[0] as SpeechSynthesisVoice | undefined;
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-IN";
  }
  // A slightly slower pace than conversation: the point is to hear the sounds.
  utterance.rate = 0.9;

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(watchdog);
    onEnd?.();
  };
  // Chrome sometimes never fires onend; a short word never needs more than a few seconds.
  const watchdog = window.setTimeout(done, 4000 + text.length * 120);

  utterance.onend = done;
  utterance.onerror = done;
  synth.speak(utterance);
}
