/** Number-system helpers shared by the digital drills. Kept simple and string-based on purpose: they mirror how a student works on paper. */

/** `n` as an unsigned binary string of exactly `width` digits. */
export function toBin(n: number, width: number): string {
  return n.toString(2).padStart(width, "0");
}

/** Groups of four from the right, without adding digits: "10110100" -> "1011 0100", "101010" -> "10 1010". */
export function group4(bits: string): string {
  return bits.replace(/\B(?=(\d{4})+(?!\d))/g, " ");
}

/** "a" or "an" for a number said aloud: an 8-bit, an 11-bit, an 18-bit, but a 6-bit and a 16-bit. */
export function article(n: number): "a" | "an" {
  return /^(8|11|18)(\D|$)/.test(String(n)) ? "an" : "a";
}

export function invert(bits: string): string {
  return bits.split("").map((b) => (b === "0" ? "1" : "0")).join("");
}

/** Adds one to a binary string, keeping its width (wraps around). */
export function addOne(bits: string): string {
  const out = bits.split("");
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] === "0") {
      out[i] = "1";
      return out.join("");
    }
    out[i] = "0";
  }
  return out.join("");
}

/** The n-bit two's-complement pattern of a signed integer (must fit). */
export function twosPattern(value: number, width: number): string {
  const mask = 2 ** width;
  return toBin(((value % mask) + mask) % mask, width);
}

/** The signed value of an n-bit two's-complement pattern. */
export function twosValue(bits: string): number {
  const n = parseInt(bits, 2);
  return bits[0] === "1" ? n - 2 ** bits.length : n;
}

/** The signed value of an n-bit one's-complement pattern (a pattern of all ones is negative zero, value 0). */
export function onesValue(bits: string): number {
  if (bits[0] !== "1") return parseInt(bits, 2);
  const size = parseInt(invert(bits), 2);
  return size === 0 ? 0 : -size; // never -0
}

export function binToGray(bits: string): string {
  let out = bits[0];
  for (let i = 1; i < bits.length; i++) out += bits[i - 1] === bits[i] ? "0" : "1";
  return out;
}

export function grayToBin(gray: string): string {
  let out = gray[0];
  for (let i = 1; i < gray.length; i++) out += out[i - 1] === gray[i] ? "0" : "1";
  return out;
}

export function popcount(bits: string): number {
  return bits.split("").filter((b) => b === "1").length;
}

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export type Base = 2 | 8 | 10 | 16;

const PREFIX: Partial<Record<Base, string>> = { 2: "0b", 8: "0o", 16: "0x" };

/**
 * Strips what a student might type around a number in `base`: spaces, underscores, commas and the base's own prefix (0b / 0o / 0x).
 * Lower-cases. Only the matching prefix is removed, so a hex value such as "0b" is not mistaken for a binary prefix.
 */
export function cleanNumberText(text: string | undefined, base: Base = 2): string {
  const clean = (text ?? "").trim().toLowerCase().replace(/[\s_,]/g, "");
  const prefix = PREFIX[base];
  return prefix && clean.startsWith(prefix) && clean.length > prefix.length ? clean.slice(prefix.length) : clean;
}

const DIGITS: Record<Base, RegExp> = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^[0-9]+$/, 16: /^[0-9a-f]+$/ };

/** The value of a typed number in `base`, or null when it is not a valid number in that base. */
export function parseInBase(text: string | undefined, base: Base): number | null {
  const clean = cleanNumberText(text, base);
  if (!clean || !DIGITS[base].test(clean)) return null;
  return parseInt(clean, base);
}

export function subscriptBase(value: string, base: Base): string {
  return `$(${value.toUpperCase()})_{${base}}$`;
}
