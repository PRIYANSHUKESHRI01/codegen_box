import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Rule of the Road cards' pictures are static files in /public/ror-cards, one per card, written by the backend's build_ror_cards.py
 * (which also writes the data that names them). A card whose file is missing shows a broken image in the middle of an exam, so the set of
 * files is pinned here: 102 cards, each a 360 x 180 PNG.
 */
const dir = path.join(process.cwd(), "public", "ror-cards");

describe("the Rule of the Road card pictures", () => {
  const files = readdirSync(dir).sort();

  it("are card-001.png to card-102.png, with nothing missing and nothing else", () => {
    expect(files).toEqual(Array.from({ length: 102 }, (_, i) => `card-${String(i + 1).padStart(3, "0")}.png`));
  });

  it("are PNG drawings of 360 x 180 pixels", () => {
    for (const file of files) {
      const bytes = readFileSync(path.join(dir, file));
      expect(bytes.subarray(0, 8).toString("hex"), file).toBe("89504e470d0a1a0a");
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], file).toEqual([360, 180]);
    }
  });
});
