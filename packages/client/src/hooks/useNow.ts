import { useEffect, useState } from 'preact/hooks';
import { app } from '../state/session';
import { useStore } from '../state/store';

/** Host-clock "now", re-rendering every `intervalMs` while `active`. */
export function useNow(active = true, intervalMs = 250): number {
  const offset = useStore(app, (s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    if (!active) return;
    const t = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, offset]);
  return now;
}
