import { ERROR_MESSAGES, sellPayout, sellPieceBlockReason, type HandPieceView, type PlayerView } from '@kalamkari/shared';
import { useEffect, useRef } from 'preact/hooks';
import { Coin } from '../../components/Coin';
import { PieceShape } from '../../components/PieceShape';
import { classLabel, designName } from '../../utils/format';

/** Shows the payout before a sale is confirmed. */
export function SellConfirm(props: { view: PlayerView; piece: HandPieceView; onConfirm: () => void; onCancel: () => void }) {
  const { view, piece } = props;
  const payout = sellPayout(view, piece);
  const blocked = sellPieceBlockReason(view, piece);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => confirmRef.current?.focus(), []);
  const { rows, cols, cells } = view.layout;

  return (
    <div class="modal-backdrop" onClick={props.onCancel}>
      <div
        class="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sell-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && props.onCancel()}
      >
        <h2 id="sell-title">Sell this piece?</h2>
        <div class="sell-preview">
          <PieceShape
            size={84}
            edges={cells[piece.ref.row][piece.ref.col]}
            designId={piece.ref.designId}
            row={piece.ref.row}
            col={piece.ref.col}
            rows={rows}
            cols={cols}
            rotation={piece.rotation}
          />
          <dl class="sell-facts">
            <dt>Piece</dt>
            <dd>
              {classLabel(piece.pieceClass)} · {designName(piece.ref.designId)}
            </dd>
            <dt>You receive</dt>
            <dd>
              <Coin amount={payout} large />
            </dd>
            <dt>Then</dt>
            <dd>It goes face-down to auction. Other players bid for it, and the winner pays the Auction House.</dd>
          </dl>
        </div>
        {blocked && (
          <p class="error-text" role="alert">
            {ERROR_MESSAGES[blocked]}
          </p>
        )}
        <div class="modal-actions">
          <button class="btn btn--ghost" onClick={props.onCancel}>
            Keep it
          </button>
          <button ref={confirmRef} class="btn btn--primary" disabled={!!blocked} onClick={props.onConfirm}>
            Sell for {payout} {payout === 1 ? 'coin' : 'coins'}
          </button>
        </div>
      </div>
    </div>
  );
}
