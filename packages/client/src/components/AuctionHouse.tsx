import { playerName, type PlayerView } from '@kalamkari/shared';
import type { ComponentChildren } from 'preact';
import { classLabel } from '../utils/format';
import { Coin } from './Coin';
import { PieceShape } from './PieceShape';

/** The bank: pool size, coins, and the face-down piece currently on auction. */
export function AuctionHouse({ view, children }: { view: PlayerView; children?: ComponentChildren }) {
  const { auction } = view;
  return (
    <section class={`card auction-house${auction ? ' has-auction' : ''}`} aria-label="Auction House">
      <h2 class="card-title">Auction House</h2>
      <div class="bank-stats">
        <span>
          <span aria-hidden="true">🧩 </span>
          {view.bank.poolCount} pieces in pool
        </span>
        <span>
          Bank <Coin amount={view.bank.coins} />
        </span>
      </div>
      {auction ? (
        <div class="auction">
          <div class="auction-piece">
            <PieceShape
              size={64}
              edges={['flat', 'flat', 'flat', 'flat']}
              row={0}
              col={0}
              rows={1}
              cols={1}
              faceDown
              faceDownLabel={classLabel(auction.pieceClass)}
              title={`Face-down ${classLabel(auction.pieceClass).toLowerCase()} piece`}
            />
          </div>
          <div class="auction-info">
            <p>
              <strong>{playerName(view, auction.sellerId)}</strong> sold a <strong>{classLabel(auction.pieceClass).toLowerCase()}</strong>{' '}
              piece for <Coin amount={auction.payout} />.
            </p>
            {children}
          </div>
        </div>
      ) : (
        <p class="muted">No auction running.</p>
      )}
    </section>
  );
}
