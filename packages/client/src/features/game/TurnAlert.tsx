import type { PlayerView } from '@kalamkari/shared';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface TurnAlertState {
  /** Changes every time the alert fires, so animations restart. */
  id: number;
  /** The turn came back to you after your sale's auction closed. */
  again: boolean;
}

const SHOW_MS = 2600;

/**
 * Fires when the viewer can act on their turn: when a new turn of theirs starts, when the turn comes back
 * after their auction, and (hotseat) each time a new player takes the device.
 */
export function useTurnAlert(view: PlayerView): [TurnAlertState | null, () => void] {
  const myActive = view.phase === 'playing' && !!view.viewerId && view.turn.playerId === view.viewerId && !view.auction;
  const key = myActive ? `${view.viewerId}#${view.turn.number}` : null;
  const prev = useRef<string | null>(null);
  const [alert, setAlert] = useState<TurnAlertState | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = key;
    if (key === null || key === before) return;
    setAlert({ id: Date.now(), again: view.turn.sold });
  }, [key]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [alert?.id]);

  return [alert, () => setAlert(null)];
}

/** "Your turn!" pop-up. Non-blocking: it fades on its own, and a tap dismisses it early. */
export function TurnAlert({ alert, onDismiss }: { alert: TurnAlertState | null; onDismiss: () => void }) {
  if (!alert) return null;
  return (
    <div class="turn-alert" key={alert.id} role="alert" onClick={onDismiss}>
      <div class="turn-alert-card">
        <span class="turn-alert-icon" aria-hidden="true">
          ✦
        </span>
        <strong>{alert.again ? 'Back to you!' : 'Your turn!'}</strong>
        <span>{alert.again ? 'The auction closed. You can still buy, then end your turn.' : 'Buy and sell once each, or pass.'}</span>
      </div>
    </div>
  );
}
