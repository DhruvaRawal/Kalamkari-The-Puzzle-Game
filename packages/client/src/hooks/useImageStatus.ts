import { useEffect, useState } from 'preact/hooks';

type Status = 'loading' | 'ok' | 'error';
const cache = new Map<string, Status>();
const waiters = new Map<string, Set<(s: Status) => void>>();

function load(url: string) {
  if (cache.has(url)) return;
  cache.set(url, 'loading');
  const img = new Image();
  const done = (s: Status) => {
    cache.set(url, s);
    waiters.get(url)?.forEach((w) => w(s));
    waiters.delete(url);
  };
  img.onload = () => done('ok');
  img.onerror = () => done('error');
  img.src = url;
}

/** Load status of an image URL, shared across every piece that uses it. null url = 'error'. */
export function useImageStatus(url: string | null): Status {
  const [status, setStatus] = useState<Status>(() => (url ? (cache.get(url) ?? 'loading') : 'error'));
  useEffect(() => {
    if (!url) return setStatus('error');
    load(url);
    const current = cache.get(url)!;
    setStatus(current);
    if (current !== 'loading') return;
    const set = waiters.get(url) ?? new Set();
    set.add(setStatus);
    waiters.set(url, set);
    return () => set.delete(setStatus);
  }, [url]);
  return status;
}
