import { minNextBid, playerName, type PlayerId, type PlayerView } from '@kalamkari/shared';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface OutbidAlertState {
  /** Changes every time the alert fires, so animations restart. */
  id: number;
  auctionId: number;
  /** Who was outbid (several seats share one device in pass & play). */
  loser: string;
  /** The new leader's name and bid. */
  by: string;
  amount: number;
  /** The smallest bid that takes the lead back. */
  nextBid: number;
  /** Only one player on this device: say "you". */
  you: boolean;
}

const SHOW_MS = 3200;

/**
 * Fires when someone playing on this device held the top bid and another player beats it.
 * It goes away by itself, when the auction closes, or on a tap.
 */
export function useOutbidAlert(view: PlayerView, mine: PlayerId[]): [OutbidAlertState | null, () => void] {
  const auction = view.auction;
  const leader = auction?.highBid?.playerId ?? null;
  const prev = useRef<{ auctionId: number | null; leader: PlayerId | null }>({ auctionId: null, leader: null });
  const [alert, setAlert] = useState<OutbidAlertState | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = { auctionId: auction?.id ?? null, leader };
    if (!auction?.highBid || before.auctionId !== auction.id) return;
    if (!before.leader || before.leader === leader || !mine.includes(before.leader)) return;
    setAlert({
      id: Date.now(),
      auctionId: auction.id,
      loser: playerName(view, before.leader),
      by: playerName(view, auction.highBid.playerId),
      amount: auction.highBid.amount,
      nextBid: minNextBid(auction, view.config),
      you: mine.length === 1,
    });
  }, [auction?.id, leader, auction?.highBid?.amount]);

  // Gone when the auction it is about has closed.
  useEffect(() => {
    if (alert && auction?.id !== alert.auctionId) setAlert(null);
  }, [auction?.id]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [alert?.id]);

  return [alert, () => setAlert(null)];
}

/** "Outbid!" pop-up. Non-blocking, so the bid buttons stay usable underneath. */
export function OutbidAlert({ alert, onDismiss }: { alert: OutbidAlertState | null; onDismiss: () => void }) {
  if (!alert) return null;
  return (
    <div class="turn-alert outbid-alert" key={alert.id} role="alert" onClick={onDismiss}>
      <div class="turn-alert-card">
        <span class="turn-alert-icon" aria-hidden="true">
          ⚑
        </span>
        <strong>{alert.you ? "You've been outbid!" : `${alert.loser} was outbid!`}</strong>
        <span>
          {alert.by} bid {alert.amount}. Bid {alert.nextBid} or more to take the lead back.
        </span>
      </div>
    </div>
  );
}
