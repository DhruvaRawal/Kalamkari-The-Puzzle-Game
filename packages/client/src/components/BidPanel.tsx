import { bidBlockReasonFor, bidOptions, ERROR_MESSAGES, playerName, type PlayerId, type PlayerView } from '@kalamkari/shared';
import { useState } from 'preact/hooks';
import { formatClock } from '../utils/format';
import { Coin } from './Coin';

export interface BidPanelProps {
  view: PlayerView;
  now: number;
  /** Seats this device may bid for (all in hotseat, just me online). */
  bidders: PlayerId[];
  onBid: (playerId: PlayerId, amount: number) => void;
}

/** Timer, current high bid and quick-bid buttons for the open auction. */
export function BidPanel({ view, now, bidders, onBid }: BidPanelProps) {
  const auction = view.auction;
  if (!auction) return null;
  const remaining = Math.max(0, auction.endsAt - now);
  const fraction = Math.min(1, remaining / view.config.auctionDurationMs);
  const eligible = bidders.filter((id) => id !== auction.sellerId);

  return (
    <div class="bid-panel">
      <div
        class={`timer${remaining < 5000 ? ' is-urgent' : ''}`}
        role="timer"
        aria-label={`Auction closes in ${formatClock(remaining)}`}
      >
        <div class="timer-bar" style={{ transform: `scaleX(${fraction})` }} />
        <span class="timer-text">⏳ {formatClock(remaining)}</span>
      </div>
      <p class="high-bid" aria-live="polite">
        {auction.highBid ? (
          <>
            Highest bid: <Coin amount={auction.highBid.amount} /> by <strong>{playerName(view, auction.highBid.playerId)}</strong>
          </>
        ) : (
          <>No bids yet. Minimum <Coin amount={view.config.minBid} />.</>
        )}
      </p>
      {eligible.length === 0 && <p class="muted">You're the seller. Waiting for bids…</p>}
      {eligible.map((id) => (
        <BidRow key={id} view={view} now={now} playerId={id} showName={eligible.length > 1 || id !== view.viewerId} onBid={onBid} />
      ))}
    </div>
  );
}

function BidRow(props: { view: PlayerView; now: number; playerId: PlayerId; showName: boolean; onBid: BidPanelProps['onBid'] }) {
  const { view, now, playerId } = props;
  const { blocked, minBid, maxBid } = bidOptions(view, playerId, now);
  const [custom, setCustom] = useState('');
  const quick = [...new Set([minBid, minBid + 1, minBid + 4])].filter((a) => a <= maxBid);
  const customAmount = Number(custom);
  const customReason = custom ? bidBlockReasonFor(view, playerId, customAmount, now) : null;
  const name = playerName(view, playerId);

  return (
    <div class="bid-row" role="group" aria-label={`Bids for ${name}`}>
      {props.showName && (
        <span class="bid-row-name">
          {name} <Coin amount={maxBid} />
        </span>
      )}
      {blocked ? (
        <span class="muted">{ERROR_MESSAGES[blocked as keyof typeof ERROR_MESSAGES] ?? blocked}</span>
      ) : (
        <>
          {quick.map((amount) => (
            <button class="btn btn--bid" onClick={() => props.onBid(playerId, amount)} aria-label={`Bid ${amount} coins${props.showName ? ` as ${name}` : ''}`}>
              Bid {amount}
            </button>
          ))}
          <form
            class="bid-custom"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customReason && custom) {
                props.onBid(playerId, customAmount);
                setCustom('');
              }
            }}
          >
            <label class="sr-only" for={`bid-${playerId}`}>
              Custom bid for {name}
            </label>
            <input
              id={`bid-${playerId}`}
              type="number"
              inputMode="numeric"
              min={minBid}
              max={maxBid}
              placeholder={`${minBid}–${maxBid}`}
              value={custom}
              onInput={(e) => setCustom((e.target as HTMLInputElement).value)}
              aria-invalid={!!customReason}
            />
            <button class="btn" type="submit" disabled={!custom || !!customReason} title={customReason ? ERROR_MESSAGES[customReason] : undefined}>
              Bid
            </button>
          </form>
        </>
      )}
    </div>
  );
}
