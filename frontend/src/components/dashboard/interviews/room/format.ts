export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Green while there's plenty of time, amber in the last third, red in the last 15%. */
export function urgencyColor(ratio: number): string {
  if (ratio > 0.33) return "#10b981"; // emerald-500
  if (ratio > 0.15) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}
