import { playerName, type LogEntry, type PlayerView } from '@kalamkari/shared';
import { classLabel } from '../../utils/format';

function describe(view: PlayerView, e: LogEntry): string {
  const who = 'playerId' in e ? playerName(view, e.playerId) : '';
  switch (e.kind) {
    case 'start':
      return `Game started. ${who} goes first.`;
    case 'turn':
      return `${who}'s turn.`;
    case 'buy':
      return `${who} bought a piece.`;
    case 'sell':
      return `${who} sold a ${classLabel(e.pieceClass).toLowerCase()} piece for ${e.payout}.`;
    case 'bid':
      return `${who} bid ${e.amount}.`;
    case 'auctionWon':
      return `${who} won the auction for ${e.amount}.`;
    case 'auctionUnsold':
      return 'No bids. The piece went to the pool.';
    case 'pass':
      return e.timedOut ? `${who} ran out of time.` : `${who} passed.`;
    case 'fixed':
      return `${who} fixed a piece.`;
    case 'connection':
      return `${who} ${e.connected ? 'reconnected' : 'disconnected'}.`;
    case 'end':
      return e.reason === 'stalemate' ? 'Stalemate! The game is over.' : 'A design is complete! The game is over.';
  }
}

/** Recent public events (the host already removed anything this viewer may not see). */
export function GameLog({ view }: { view: PlayerView }) {
  const entries = view.log
    .filter((e) => e.kind !== 'turn')
    .slice(-12)
    .reverse();
  return (
    <section class="card log" aria-label="Game log">
      <h2 class="card-title">Recent</h2>
      <ol class="log-list">
        {entries.map((e) => (
          <li>{describe(view, e)}</li>
        ))}
      </ol>
    </section>
  );
}
