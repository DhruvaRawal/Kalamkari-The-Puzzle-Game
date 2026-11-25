import { playerName, type PlayerView } from '@kalamkari/shared';
import { useEffect, useRef } from 'preact/hooks';
import { Coin } from '../../components/Coin';

export function GameOver({ view, onLeave }: { view: PlayerView; onLeave: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const result = view.result;
  if (!result) return null;
  const total = view.layout.rows * view.layout.cols;
  const names = result.winners.map((id) => playerName(view, id));
  const iWon = view.viewerId !== null && result.winners.includes(view.viewerId);
  const standings = [...result.standings].sort((a, b) => b.fixedCount - a.fixedCount || b.coins - a.coins);

  return (
    <div class="modal-backdrop">
      <div class="modal card game-over" role="dialog" aria-modal="true" aria-labelledby="go-title">
        <div class="motif-ring" aria-hidden="true" />
        <h2 id="go-title">{iWon ? (names.length > 1 ? 'You share the win!' : 'You win!') : `${names.join(' & ')} ${names.length > 1 ? 'share the win' : 'wins'}`}</h2>
        <p>{result.reason === 'completed' ? 'A design was completed.' : 'Stalemate: the pool ran dry and everyone passed. Most fixed pieces wins.'}</p>
        <table class="standings">
          <caption class="sr-only">Final standings</caption>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Fixed</th>
              <th scope="col">Coins</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr class={result.winners.includes(s.playerId) ? 'is-winner' : ''}>
                <th scope="row">
                  {result.winners.includes(s.playerId) && <span aria-label="winner">🏆 </span>}
                  {playerName(view, s.playerId)}
                </th>
                <td>
                  {s.fixedCount}/{total}
                </td>
                <td>
                  <Coin amount={s.coins} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button ref={ref} class="btn btn--primary" onClick={onLeave}>
          Back to lobby
        </button>
      </div>
    </div>
  );
}
