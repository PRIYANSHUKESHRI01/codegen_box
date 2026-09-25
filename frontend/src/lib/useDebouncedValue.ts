import { useEffect, useState } from "react";

/**
 * Returns `value`, but only after it's stopped changing for `delayMs`. The
 * same 350ms debounce shape already hand-rolled independently in 7+ places
 * across this app (admin/customers, several superadmin panels, etc.) for
 * server-backed searches — this is the one shared version, so a new search
 * input never needs to re-invent it. Works equally well for the in-memory
 * `.filter()` searches (Student Cohort, Practice Arena) that were missing
 * any debounce at all: even with no network request to save, re-filtering a
 * large array on every single keystroke is real, avoidable render cost.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
