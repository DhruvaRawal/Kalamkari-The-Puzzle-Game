import { ERROR_MESSAGES, playerName, type AvailableActions, type PlayerView } from '@kalamkari/shared';
import { formatClock } from '../utils/format';
import { Coin } from './Coin';

export interface TurnBannerProps {
  view: PlayerView;
  now: number;
  actions: AvailableActions | null;
  sellMode: boolean;
  onBuy: () => void;
  onSell: () => void;
  onEndTurn: () => void;
}

const why = (code: string | null) => (code ? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] : undefined);

/** Whose turn it is, the turn clock, and the Buy / Sell / End turn buttons. */
export function TurnBanner({ view, now, actions, sellMode, onBuy, onSell, onEndTurn }: TurnBannerProps) {
  const mine = view.turn.playerId === view.viewerId;
  const name = playerName(view, view.turn.playerId);
  const deadline = view.turn.deadline;
  const paused = deadline === null && view.auction !== null;
  // Paused for the auction: show the time the clock will resume from.
  const remaining = deadline !== null ? Math.max(0, deadline - now) : paused ? (view.turn.pausedLeft ?? null) : null;
  const { bought, sold } = view.turn;

  let status: string;
  if (view.phase === 'ended') status = 'Game over';
  else if (view.auction) status = 'Auction in progress';
  else if (mine) status = 'Your turn';
  else status = `${name}'s turn`;

  return (
    <header class={`turn-banner${mine && view.phase === 'playing' ? ' is-mine' : ''}`}>
      <div class="turn-status" aria-live="polite">
        <strong>{status}</strong>
        {remaining !== null && view.phase === 'playing' && (
          <span
            class={`turn-clock${paused ? ' is-paused' : remaining < 10_000 ? ' is-urgent' : ''}`}
            role="timer"
            aria-label={paused ? `Turn clock paused at ${formatClock(remaining)}` : `${formatClock(remaining)} left in turn`}
          >
            {paused ? '⏸' : '⏱'} {formatClock(remaining)}
          </span>
        )}
        {mine && view.phase === 'playing' && (
          <span class="turn-used">
            Buy {bought ? '✔ used' : '○ available'} · Sell {sold ? '✔ used' : '○ available'}
          </span>
        )}
      </div>
      {actions && mine && (
        <div class="turn-actions">
          <button class="btn btn--primary" onClick={onBuy} disabled={!!actions.buy} title={why(actions.buy) ?? `Pay ${view.config.buyPrice} coin for a random piece`}>
            Buy · <Coin amount={view.config.buyPrice} label="coin" />
          </button>
          <button class={`btn${sellMode ? ' is-active' : ''}`} onClick={onSell} disabled={!!actions.sell} aria-pressed={sellMode} title={why(actions.sell) ?? 'Sell one of your pieces'}>
            {sellMode ? 'Cancel sell' : 'Sell'}
          </button>
          <button class="btn btn--ghost" onClick={onEndTurn} disabled={!!actions.endTurn} title={why(actions.endTurn)}>
            {bought || sold ? 'End turn' : 'Pass'}
          </button>
          {(actions.buy || actions.sell) && !view.auction && (
            <p class="action-hint muted">
              {actions.buy && actions.buy !== 'ALREADY_BOUGHT' && <span>Buy: {why(actions.buy)} </span>}
              {actions.sell && actions.sell !== 'ALREADY_SOLD' && <span>Sell: {why(actions.sell)}</span>}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
