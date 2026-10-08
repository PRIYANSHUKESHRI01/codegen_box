/**
 * Choosing which text-to-speech voices read a Listening Lab lesson.
 *
 * Browsers expose wildly different voice lists (Chrome on Windows has
 * Microsoft and Google voices, macOS has Apple voices, a headless or minimal
 * browser has none), and the default voice is usually the worst one. So the
 * lab picks deliberately: the best available voice for the accent the
 * student asked for, and — for a conversation — a *different* voice for each
 * speaker, matched to the speaker's gender where the browser lets us tell.
 * When the browser offers fewer voices than there are speakers, speakers share
 * a voice and are told apart by pitch instead, so a dialogue never collapses
 * into one monotone.
 */

/** The bits of SpeechSynthesisVoice the lab uses — structural, so tests can pass plain objects. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

export type AccentPref = "auto" | "en-IN" | "en-GB" | "en-US";

export const ACCENT_LABELS: Record<AccentPref, string> = {
  auto: "Auto",
  "en-IN": "Indian",
  "en-GB": "British",
  "en-US": "American",
};

export type Gender = "female" | "male";

export interface VoiceAssignment {
  voice: VoiceLike | null;
  pitch: number;
}

/** Spoken identity of one person in a lesson. `key` is "default" for a single-speaker passage. */
export interface SpeakerSpec {
  key: string;
  gender: Gender | null;
}

const FEMALE_HINTS = [
  "female", "zira", "heera", "neerja", "hazel", "susan", "samantha", "veena", "karen", "moira", "tessa", "fiona",
  "kalpana", "aditi", "swara", "jenny", "aria", "sonia", "libby", "natasha", "priya", "raveena", "kajal",
];
const MALE_HINTS = [
  "male", "david", "mark", "ravi", "prabhat", "george", "james", "daniel", "rishi", "guy", "hemant", "ryan", "thomas",
  "arthur", "liam", "madhur", "prabhat", "rehaan",
];

/** Best-effort gender from a voice's name — browsers expose no gender field. "Female" must be tested first since it contains "male". */
export function guessGender(voice: VoiceLike): Gender | null {
  const name = voice.name.toLowerCase();
  if (FEMALE_HINTS.some((h) => name.includes(h))) return "female";
  if (MALE_HINTS.some((h) => name.includes(h))) return "male";
  return null;
}

function isEnglish(voice: VoiceLike): boolean {
  return voice.lang.toLowerCase().replace("_", "-").startsWith("en");
}

function normaliseLang(lang: string): string {
  return lang.replace("_", "-");
}

/** Higher is better. Accent match dominates; naturalness (neural / "Online" / Google voices) breaks ties. */
function score(voice: VoiceLike, pref: AccentPref): number {
  const lang = normaliseLang(voice.lang);
  const name = voice.name.toLowerCase();

  // `auto` favours Indian English (the student's own context) then British, then American.
  // The chosen accent is applied LAST so it overrides that accent's default weight (a duplicate key earlier in the literal would silently win).
  const accentOrder: Record<string, number> = pref === "auto"
    ? { "en-IN": 300, "en-GB": 200, "en-US": 150 }
    : { "en-IN": 40, "en-GB": 30, "en-US": 20, [pref]: 400 };

  let s = accentOrder[lang] ?? (isEnglish(voice) ? 10 : 0);
  if (/natural|neural|online/.test(name)) s += 60;
  if (name.includes("google")) s += 35;
  if (voice.localService) s += 5;
  return s;
}

/** English voices ranked best-first for the accent preference. */
export function rankVoices(all: VoiceLike[], pref: AccentPref): VoiceLike[] {
  return all
    .filter(isEnglish)
    .map((voice, order) => ({ voice, order, s: score(voice, pref) }))
    .sort((a, b) => b.s - a.s || a.order - b.order)
    .map((x) => x.voice);
}

/** Which of the accent choices this browser can actually deliver — shown so the picker never offers a dead option. */
export function availableAccents(all: VoiceLike[]): AccentPref[] {
  const langs = new Set(all.filter(isEnglish).map((v) => normaliseLang(v.lang)));
  return (["en-IN", "en-GB", "en-US"] as const).filter((a) => langs.has(a));
}

/** Pitch offsets used to tell speakers apart when they have to share a voice. */
const PITCH_BY_SLOT = [1, 0.82, 1.18];

/**
 * One voice (and pitch) per speaker. Gender-matched where possible, distinct
 * wherever the browser has enough voices, pitch-separated where it doesn't.
 */
export function planVoices(all: VoiceLike[], speakers: SpeakerSpec[], pref: AccentPref): Map<string, VoiceAssignment> {
  const ranked = rankVoices(all, pref);
  const plan = new Map<string, VoiceAssignment>();
  const used = new Set<VoiceLike>();

  speakers.forEach((speaker, slot) => {
    const pool = ranked.filter((v) => !used.has(v));
    // Prefer a voice whose guessed gender matches; otherwise any unused voice; otherwise share the best one.
    const wanted = speaker.gender;
    const chosen =
      (wanted ? pool.find((v) => guessGender(v) === wanted) : undefined) ??
      // Never hand a male speaker a clearly female voice (or the reverse) just to avoid sharing.
      pool.find((v) => !wanted || guessGender(v) === null) ??
      null;

    if (chosen) {
      used.add(chosen);
      plan.set(speaker.key, { voice: chosen, pitch: 1 });
    } else {
      // Share the best available voice (which may be none at all), separated by pitch.
      const shared = ranked.find((v) => !wanted || guessGender(v) === wanted || guessGender(v) === null) ?? ranked[0] ?? null;
      plan.set(speaker.key, { voice: shared, pitch: PITCH_BY_SLOT[slot % PITCH_BY_SLOT.length] ?? 1 });
    }
  });

  // A single shared voice for everyone is the case that needs pitch to carry the whole distinction.
  const distinct = new Set(Array.from(plan.values()).map((a) => a.voice));
  if (speakers.length > 1 && distinct.size === 1) {
    speakers.forEach((speaker, slot) => {
      const current = plan.get(speaker.key)!;
      plan.set(speaker.key, { ...current, pitch: PITCH_BY_SLOT[slot % PITCH_BY_SLOT.length] ?? 1 });
    });
  }

  return plan;
}
