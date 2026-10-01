"use client";

interface ReadinessRingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  /**
   * Hide the caption under the percentage. `label` is still required and
   * still drives the accessible name — callers that turn this off are
   * showing the tier as a badge beside the ring, so printing it inside as
   * well would just say the same word twice.
   */
  showLabel?: boolean;
}

export function ReadinessRing({
  value,
  size = 132,
  stroke = 10,
  label = "Ready",
  showLabel = true,
}: ReadinessRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${clamped}% ${label}`}>
        <defs>
          <linearGradient id="readinessGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="var(--accent-secondary)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#readinessGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-black leading-none text-primary">{clamped}%</span>
        {showLabel && (
          <span className="mt-1 text-3xs font-semibold uppercase tracking-wider text-text-muted">{label}</span>
        )}
      </div>
    </div>
  );
}
