export interface DsaSheet {
  id: string;
  name: string;
  creator: string;
  creatorPlatform: string;
  description: string;
  problemCount: string;
  externalUrl: string;
  /** Swap in a real poster image URL later — falls back to a styled gradient + initial until then. */
  posterUrl?: string;
  accent: "indigo" | "cyan" | "amber";
}

/**
 * Three DSA sheets the placement-prep community already trusts — not
 * authored by CodeGen Box. Every card credits the real creator and links
 * out to their original sheet; "Practice on CodeGen Box" stays a disabled
 * "Coming Soon" badge until the question bank behind it actually exists —
 * see DsaSheets.tsx. Problem counts are the sheets' own well-known, public
 * counts, not a CodeGen Box claim.
 */
export const DSA_SHEETS: DsaSheet[] = [
  {
    id: "striver-a2z",
    name: "Striver's A2Z DSA Course",
    creator: "Raj Vikramaditya (Striver)",
    creatorPlatform: "takeUforward",
    description: "The most-followed structured DSA roadmap in the community — from basics to advanced graphs and DP, step by step.",
    problemCount: "450+ Problems",
    externalUrl: "https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2",
    accent: "indigo",
  },
  {
    id: "love-babbar-450",
    name: "Love Babbar's DSA Sheet",
    creator: "Love Babbar",
    creatorPlatform: "450DSA",
    description: "The sheet that popularized structured DSA prep for Indian placements — arrays through advanced trees and graphs.",
    problemCount: "450 Problems",
    externalUrl: "https://450dsa.com/",
    accent: "cyan",
  },
  {
    id: "neetcode-150",
    name: "NeetCode 150",
    creator: "Navdeep Singh (NeetCode)",
    creatorPlatform: "neetcode.io",
    description: "A tightly curated, globally recognized set of the highest-yield interview patterns — built for maximum coverage per problem.",
    problemCount: "150 Problems",
    externalUrl: "https://neetcode.io/practice",
    accent: "amber",
  },
];
