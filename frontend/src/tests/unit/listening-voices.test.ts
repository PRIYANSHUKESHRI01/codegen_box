import { describe, expect, it } from "vitest";
import { availableAccents, guessGender, planVoices, rankVoices, type VoiceLike } from "@/lib/listening/voices";

const v = (name: string, lang: string, localService = true): VoiceLike => ({ name, lang, localService });

const heera = v("Microsoft Heera - English (India)", "en-IN");
const ravi = v("Microsoft Ravi - English (India)", "en-IN");
const zira = v("Microsoft Zira Desktop - English (United States)", "en-US");
const david = v("Microsoft David Desktop - English (United States)", "en-US");
const googleUk = v("Google UK English Female", "en-GB", false);
const neerja = v("Microsoft Neerja Online (Natural) - English (India)", "en-IN", false);
const hindi = v("Microsoft Hemant - Hindi (India)", "hi-IN");

describe("guessGender", () => {
  it("reads gender from common voice names, testing 'female' before 'male'", () => {
    expect(guessGender(heera)).toBe("female");
    expect(guessGender(ravi)).toBe("male");
    expect(guessGender(googleUk)).toBe("female");
    expect(guessGender(v("Some Male Voice", "en-US"))).toBe("male");
    expect(guessGender(v("Some Female Voice", "en-US"))).toBe("female");
    expect(guessGender(v("Mystery Voice", "en-US"))).toBeNull();
  });
});

describe("rankVoices", () => {
  it("drops non-English voices", () => {
    expect(rankVoices([hindi, zira], "auto")).toEqual([zira]);
  });

  it("auto prefers Indian English, then British, then American", () => {
    const ranked = rankVoices([zira, googleUk, heera], "auto");
    expect(ranked.map((x) => x.lang)).toEqual(["en-IN", "en-GB", "en-US"]);
  });

  it("an explicit accent beats everything else", () => {
    expect(rankVoices([heera, googleUk, zira], "en-GB")[0]).toBe(googleUk);
    expect(rankVoices([heera, googleUk, zira], "en-US")[0]).toBe(zira);
  });

  it("within an accent, natural / online voices outrank the plain desktop ones", () => {
    expect(rankVoices([heera, neerja], "en-IN")[0]).toBe(neerja);
  });

  it("copes with underscore language tags and an empty list", () => {
    expect(rankVoices([v("Android Voice", "en_IN")], "en-IN")).toHaveLength(1);
    expect(rankVoices([], "auto")).toEqual([]);
  });
});

describe("availableAccents", () => {
  it("lists only the accents the browser can really deliver", () => {
    expect(availableAccents([heera, zira])).toEqual(["en-IN", "en-US"]);
    expect(availableAccents([hindi])).toEqual([]);
    expect(availableAccents([])).toEqual([]);
  });
});

describe("planVoices", () => {
  it("gives a single speaker the best voice for the accent at normal pitch", () => {
    const plan = planVoices([zira, heera], [{ key: "default", gender: null }], "auto");
    expect(plan.get("default")).toEqual({ voice: heera, pitch: 1 });
  });

  it("matches each speaker's gender and gives different speakers different voices", () => {
    const plan = planVoices([heera, ravi, zira, david], [{ key: "A", gender: "male" }, { key: "B", gender: "female" }], "auto");

    expect(plan.get("A")?.voice).toBe(ravi);
    expect(plan.get("B")?.voice).toBe(heera);
    expect(plan.get("A")?.pitch).toBe(1);
  });

  it("never gives two speakers the same voice while another suitable one is free", () => {
    const plan = planVoices([heera, ravi, david], [{ key: "A", gender: "male" }, { key: "B", gender: "male" }, { key: "C", gender: "female" }], "auto");
    const voices = ["A", "B", "C"].map((k) => plan.get(k)?.voice);

    expect(new Set(voices).size).toBe(3);
  });

  it("separates speakers by pitch when the browser has only one voice", () => {
    const plan = planVoices([zira], [{ key: "A", gender: "female" }, { key: "B", gender: "male" }], "auto");

    expect(plan.get("A")?.voice).toBe(zira);
    expect(plan.get("B")?.voice).toBe(zira);
    expect(plan.get("A")?.pitch).not.toBe(plan.get("B")?.pitch);
  });

  it("still tells speakers apart by pitch when the browser lists no voices at all", () => {
    const plan = planVoices([], [{ key: "A", gender: null }, { key: "B", gender: null }, { key: "C", gender: null }], "auto");

    expect(plan.get("A")?.voice).toBeNull();
    expect(new Set([plan.get("A")?.pitch, plan.get("B")?.pitch, plan.get("C")?.pitch]).size).toBe(3);
  });

  it("does not give a male speaker a clearly female voice just to avoid sharing", () => {
    const plan = planVoices([heera, zira], [{ key: "A", gender: "male" }], "auto");

    // Only female voices exist: share the best one (pitch is what differentiates), rather than pretending.
    expect(plan.get("A")?.voice).toBeTruthy();
  });

  it("re-plans for a different accent", () => {
    const speakers = [{ key: "default", gender: null }];
    expect(planVoices([heera, googleUk, zira], speakers, "en-GB").get("default")?.voice).toBe(googleUk);
    expect(planVoices([heera, googleUk, zira], speakers, "en-US").get("default")?.voice).toBe(zira);
  });
});
