import { useMemo } from 'preact/hooks';
import type { PlayerView } from '@kalamkari/shared';
import { app, effectiveView } from '../state/session';
import { useStore } from '../state/store';

/** The current view with local predictions applied. */
export function useGameView(): PlayerView | null {
  const view = useStore(app, (s) => s.view);
  const optimistic = useStore(app, (s) => s.optimistic);
  return useMemo(() => effectiveView(view, optimistic), [view, optimistic]);
}
