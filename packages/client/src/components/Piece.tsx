import type { HandPieceView, JigsawLayout } from '@kalamkari/shared';
import type { JSX } from 'preact';
import { usePieceDrag, type DropInfo } from '../features/placement/dragDrop';
import { pieceLabel } from '../utils/format';
import { PieceShape } from './PieceShape';

export interface PieceProps {
  piece: HandPieceView;
  layout: JigsawLayout;
  ownDesignId?: string;
  size: number;
  selected?: boolean;
  /** Being dragged: leave a faint placeholder behind. */
  lifted?: boolean;
  style?: JSX.CSSProperties;
  slotAt: (x: number, y: number) => { row: number; col: number } | null;
  /** Pointer tap. */
  onSelect: () => void;
  /** Keyboard focus (never opens dialogs). */
  onFocus: () => void;
  onActivate: () => void;
  onRotate: (dir: 1 | -1) => void;
  onNudge: (dx: number, dy: number) => void;
  onDrop: (info: DropInfo) => void;
}

/** An interactive held piece: PieceShape + pointer drag + keyboard. */
export function Piece(p: PieceProps) {
  const { onPointerDown } = usePieceDrag({
    pieceId: p.piece.id,
    slotAt: p.slotAt,
    onTap: p.onSelect,
    onDoubleTap: () => p.onRotate(1),
    onDrop: p.onDrop,
  });
  const { ref, rotation } = p.piece;

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 4 : 1;
    switch (e.key) {
      case 'r':
      case 'R':
        p.onRotate(e.shiftKey ? -1 : 1);
        break;
      case 'Enter':
      case ' ':
        p.onActivate();
        break;
      case 'ArrowLeft':
        p.onNudge(-step, 0);
        break;
      case 'ArrowRight':
        p.onNudge(step, 0);
        break;
      case 'ArrowUp':
        p.onNudge(0, -step);
        break;
      case 'ArrowDown':
        p.onNudge(0, step);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div
      class={`piece${p.selected ? ' is-selected' : ''}${p.lifted ? ' is-lifted' : ''}`}
      style={p.style}
      tabIndex={0}
      role="button"
      aria-pressed={p.selected}
      aria-label={pieceLabel(ref, rotation, p.ownDesignId, p.piece.pieceClass)}
      onPointerDown={onPointerDown as unknown as JSX.PointerEventHandler<HTMLDivElement>}
      onKeyDown={onKeyDown}
      onFocus={p.onFocus}
    >
      <PieceShape
        size={p.size}
        edges={p.layout.cells[ref.row][ref.col]}
        designId={ref.designId}
        row={ref.row}
        col={ref.col}
        rows={p.layout.rows}
        cols={p.layout.cols}
        rotation={rotation}
        highlight={p.selected ? 'selected' : null}
      />
      {ref.designId === p.ownDesignId && <span class="piece-mine" aria-hidden="true">★</span>}
    </div>
  );
}
