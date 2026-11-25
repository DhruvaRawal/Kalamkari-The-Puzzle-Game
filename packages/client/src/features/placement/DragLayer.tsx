import type { PlayerView } from '@kalamkari/shared';
import { PieceShape, PADDED, S } from '../../components/PieceShape';
import { useStore } from '../../state/store';
import { dragStore } from './dragDrop';

/** The piece following the pointer while dragging. */
export function DragLayer({ view }: { view: PlayerView }) {
  const drag = useStore(dragStore, (s) => s);
  const piece = drag.pieceId ? view.me?.hand.find((h) => h.id === drag.pieceId) : null;
  if (!piece) return null;
  const { rows, cols, cells } = view.layout;
  return (
    <div class="drag-layer" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
      <PieceShape
        size={(drag.box * S) / PADDED}
        edges={cells[piece.ref.row][piece.ref.col]}
        designId={piece.ref.designId}
        row={piece.ref.row}
        col={piece.ref.col}
        rows={rows}
        cols={cols}
        rotation={piece.rotation}
        highlight="selected"
      />
    </div>
  );
}
