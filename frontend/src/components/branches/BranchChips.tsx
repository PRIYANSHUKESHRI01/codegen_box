"use client";

import { canonicalizeBranchTokens, FAMILY_PREFIX, useBranchCatalog } from "@/lib/branches";

/**
 * A drive's eligible branches as chips: "Mechanical Engineering", "All ECE" — never the raw stored
 * token ("mech", "family:ece") and never an older drive's "MECH" next to a student's "Mechanical".
 * Empty / null means the drive is open to every branch.
 */
export function BranchChips({ tokens, chipClassName, emptyLabel = "All branches" }: { tokens: readonly string[] | null | undefined; chipClassName: string; emptyLabel?: string }) {
  const catalog = useBranchCatalog();

  if (!tokens || tokens.length === 0) return <span className="font-mono font-bold text-primary">{emptyLabel}</span>;

  const resolved = catalog ? canonicalizeBranchTokens(tokens, catalog) : [...tokens];

  return (
    <span className="flex flex-wrap gap-1.5">
      {resolved.map((token) => {
        let label = token;
        if (token.startsWith(FAMILY_PREFIX)) {
          const family = catalog?.disciplines.find((d) => d.code === token.slice(FAMILY_PREFIX.length));
          label = family ? `All ${family.short}` : token;
        } else {
          label = catalog?.branches.find((b) => b.code === token)?.short ?? token;
        }
        return (
          <span key={token} className={chipClassName}>
            {label}
          </span>
        );
      })}
    </span>
  );
}
