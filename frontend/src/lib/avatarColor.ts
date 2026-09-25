/**
 * Deterministic avatar palette — the same person always gets the same
 * color across renders/reloads (hashed from their name), without storing a
 * color anywhere. Pairs of [background, text] classes, tuned to work in
 * both light and dark theme since they're plain Tailwind utility colors
 * rather than the app's theme-aware design tokens.
 */
const PALETTE = [
  "bg-indigo-500/15 text-indigo-400",
  "bg-rose-500/15 text-rose-400",
  "bg-emerald-500/15 text-emerald-400",
  "bg-amber-500/15 text-amber-500",
  "bg-cyan-500/15 text-cyan-400",
  "bg-fuchsia-500/15 text-fuchsia-400",
  "bg-orange-500/15 text-orange-400",
  "bg-sky-500/15 text-sky-400",
];

export function avatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
