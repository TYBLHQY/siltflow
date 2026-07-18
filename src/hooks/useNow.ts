import { useState, useEffect } from "react";

/**
 * Returns a periodically-updated timestamp (ms since epoch) that can be used
 * as a reactive dependency in useMemo / useEffect to recompute time-dependent
 * values as wall-clock time passes.
 *
 * @param intervalMs  Polling interval in milliseconds (default: 30_000 = 30s)
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
