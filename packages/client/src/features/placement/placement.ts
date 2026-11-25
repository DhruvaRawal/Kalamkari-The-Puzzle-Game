import { ERROR_MESSAGES, placementBlockReason, type PieceId, type PlayerView, type Slot } from '@kalamkari/shared';
import { dispatch, showToast } from '../../state/session';

/**
 * Tries to fix a piece into a slot. The same shared check the engine runs decides the snap, so the
 * UI and host can't disagree. Used by drag-and-drop and by keyboard placement.
 */
export function attemptPlace(view: PlayerView, pieceId: PieceId, slot: Slot): boolean {
  const reason = placementBlockReason(view, pieceId, slot);
  if (reason) {
    // Right piece, right slot, wrong way round: a nudge (orange), not an error (red).
    showToast(ERROR_MESSAGES[reason], reason === 'WRONG_ROTATION' ? 'warning' : 'error');
    return false;
  }
  dispatch({ type: 'PLACE', pieceId, row: slot.row, col: slot.col });
  showToast('Locked in place!', 'success');
  return true;
}

export function rotatePiece(view: PlayerView, pieceId: PieceId, dir: 1 | -1) {
  const piece = view.me?.hand.find((h) => h.id === pieceId);
  if (!piece) return;
  dispatch({ type: 'ROTATE', pieceId, rotation: (((piece.rotation + dir) % 4) + 4) % 4 as 0 | 1 | 2 | 3 });
}
