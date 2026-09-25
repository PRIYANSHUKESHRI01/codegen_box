/**
 * Converts a <input type="datetime-local"> value (a timezone-less wall-clock
 * string the browser reports in the viewer's own local time) into a real UTC
 * instant safe to send to the API. Without this conversion, the raw string
 * gets posted as-is and a UTC-timezoned Laravel app stores the local
 * wall-clock numbers as if they were already UTC — silently shifting every
 * contest/drive time by the creator's UTC offset (e.g. 5:30 hours for IST),
 * which is exactly the "contest set for 11:13 shows up at 4:41 am" bug.
 */
export function localDatetimeInputToUtcIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/**
 * The inverse of localDatetimeInputToUtcIso — formats a UTC ISO timestamp
 * from the API into the local wall-clock string a datetime-local input
 * expects for its value/prefill, so editing an existing contest/drive shows
 * the time its creator actually meant instead of a raw UTC slice.
 */
export function utcIsoToLocalDatetimeInput(utcIso: string | null | undefined): string {
  if (!utcIso) return "";
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
