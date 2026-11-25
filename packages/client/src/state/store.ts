import { useEffect, useRef, useState } from 'preact/hooks';

export interface Store<T> {
  get(): T;
  set(patch: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(fn: (s: T) => void): () => void;
}

/** Minimal external store. Components read slices with useStore(store, selector). */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(s: T) => void>();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Subscribes to a slice; re-renders only when the selected value changes (Object.is). */
export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  const [value, setValue] = useState(() => selector(store.get()));
  const sel = useRef(selector);
  sel.current = selector;
  useEffect(() => {
    const check = (s: T) => {
      const next = sel.current(s);
      setValue((prev) => (Object.is(prev, next) ? prev : next));
    };
    check(store.get());
    return store.subscribe(check);
  }, [store]);
  return value;
}
