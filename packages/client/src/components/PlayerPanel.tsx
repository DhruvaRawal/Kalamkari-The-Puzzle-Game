import type { PlayerView } from '@kalamkari/shared';
import { formatClock, plural } from '../utils/format';
import { Avatar, avatarName } from './Avatar';
import { Coin } from './Coin';

/** Everyone at the table: avatar + turn ring, coins, pieces, fixed count (if shown) and whose turn it is. */
export function PlayerPanel({ view, now }: { view: PlayerView; now: number }) {
  const fixedTotal = view.layout.rows * view.layout.cols;
  return (
    <section class="card players" aria-label="Players">
      <h2 class="card-title">Players</h2>
      <ul class="player-list">
        {view.players.map((p) => {
          const isTurn = view.phase === 'playing' && view.turn.playerId === p.id;
          const isMe = p.id === view.viewerId;
          const leading = view.auction?.highBid?.playerId === p.id;
          const deadline = isTurn ? view.turn.deadline : null;
          const paused = isTurn && deadline === null;
          // While paused for the auction, the ring holds the time that was left when the piece was sold.
          const remaining = deadline !== null ? Math.max(0, deadline - now) : paused ? (view.turn.pausedLeft ?? null) : null;
          const clock = paused
            ? `turn clock paused for the auction${remaining !== null ? ` at ${formatClock(remaining)}` : ''}`
            : remaining !== null
              ? `${formatClock(remaining)} left in turn`
              : '';
          return (
            <li class={`player${isTurn ? ' is-turn' : ''}${isMe ? ' is-me' : ''}`} aria-current={isTurn ? 'step' : undefined}>
              <span class="player-avatar" title={isTurn ? `${avatarName(p.avatar)} · ${clock}` : avatarName(p.avatar)}>
                <Avatar
                  index={p.avatar}
                  timeLeft={isTurn ? (remaining !== null ? remaining / view.config.turnTimeoutMs : 1) : null}
                  paused={paused}
                  urgent={!paused && remaining !== null && remaining < 10_000}
                />
              </span>
              <div class="player-body">
                <div class="player-name">
                  <strong>{p.name}</strong>
                  {isMe && <span class="tag">you</span>}
                  {isTurn && (
                    <span class="tag tag--turn">
                      <span aria-hidden="true">▶ </span>turn
                    </span>
                  )}
                  {leading && <span class="tag tag--bid">top bid</span>}
                  {!p.connected && <span class="tag tag--off">offline</span>}
                  {isTurn && clock && <span class="sr-only">, {clock}</span>}
                </div>
                <div class="player-stats">
                  <Coin amount={p.coins} />
                  {p.handCount === null ? (
                    <span title="Pieces owned (held and fixed)">
                      <span aria-hidden="true">🧩 </span>
                      {plural(p.pieceCount, 'piece')}
                    </span>
                  ) : (
                    <span title="Unfixed pieces in hand">
                      <span aria-hidden="true">✋ </span>
                      {p.handCount} in hand
                    </span>
                  )}
                  <span title="Pieces fixed on their board">
                    <span aria-hidden="true">✔ </span>
                    {p.fixedCount === null ? <span class="muted">fixed hidden</span> : `${p.fixedCount}/${fixedTotal} fixed`}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
