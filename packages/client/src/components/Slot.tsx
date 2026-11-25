import { buildPiecePath, type PieceEdges } from '@kalamkari/shared';
import { S } from './PieceShape';

export type SlotState = 'empty' | 'hover' | 'cursor' | 'reject';

/** One empty slot outline on the board, in board units. */
export function Slot(props: { edges: PieceEdges; row: number; col: number; state: SlotState }) {
  return (
    <g transform={`translate(${props.col * S} ${props.row * S})`} class={`slot is-${props.state}`}>
      <path d={buildPiecePath(props.edges, S)} />
      {props.state === 'cursor' && (
        <text x={S / 2} y={S / 2 + 6} text-anchor="middle" font-size={18} aria-hidden="true">
          ✚
        </text>
      )}
    </g>
  );
}
