import { pieceIdOf, type JigsawLayout, type PieceRef, type Slot as SlotPos } from '@kalamkari/shared';
import type { Ref } from 'preact';
import { DesignArt, M, PieceGlyph, S } from './PieceShape';
import { Slot, type SlotState } from './Slot';

export interface BoardProps {
  layout: JigsawLayout;
  designId: string;
  /** live: faint design + slots + fixed pieces. reference: the full design as a thumbnail. */
  mode: 'live' | 'reference';
  fixed?: PieceRef[];
  justFixed?: string[];
  hoverSlot?: SlotPos | null;
  hoverRejected?: boolean;
  cursorSlot?: SlotPos | null;
  svgRef?: Ref<SVGSVGElement>;
  /** Live mode: how strongly the design shows through the empty slots (0..1). */
  designOpacity?: number;
  label: string;
  class?: string;
}

/** One board component for both the live board and the reference picture. */
export function Board(p: BoardProps) {
  const { rows, cols, cells } = p.layout;
  const w = cols * S;
  const h = rows * S;
  const fixed = p.fixed ?? [];
  const isFixed = (r: number, c: number) => fixed.some((f) => f.row === r && f.col === c);
  const slotState = (r: number, c: number): SlotState => {
    if (p.hoverSlot?.row === r && p.hoverSlot?.col === c) return p.hoverRejected ? 'reject' : 'hover';
    if (p.cursorSlot?.row === r && p.cursorSlot?.col === c) return 'cursor';
    return 'empty';
  };

  if (p.mode === 'reference') {
    return (
      <svg class={`board board--reference ${p.class ?? ''}`} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={p.label}>
        <DesignArt designId={p.designId} rows={rows} cols={cols} row={0} col={0} />
      </svg>
    );
  }

  return (
    <svg
      ref={p.svgRef}
      class={`board board--live ${p.class ?? ''}`}
      viewBox={`${-M} ${-M} ${w + 2 * M} ${h + 2 * M}`}
      role="img"
      aria-label={p.label}
    >
      <rect x={-6} y={-6} width={w + 12} height={h + 12} class="board-frame" />
      <DesignArt designId={p.designId} rows={rows} cols={cols} row={0} col={0} opacity={p.designOpacity ?? 0.2} />
      {cells.map((row, r) =>
        row.map((edges, c) => (isFixed(r, c) ? null : <Slot edges={edges} row={r} col={c} state={slotState(r, c)} />)),
      )}
      {fixed.map((f) => {
        const id = pieceIdOf(f);
        return (
          // Position on the outer group, animate the inner one: a CSS transform would otherwise
          // replace the SVG translate and the piece would flash at the board origin.
          <g transform={`translate(${f.col * S} ${f.row * S})`}>
            <g
              class={p.justFixed?.includes(id) ? 'just-locked' : undefined}
              // Pivot on the cell centre (local units). The group's own box spans the whole clipped picture.
              style={{ transformOrigin: `${S / 2}px ${S / 2}px` }}
            >
              <PieceGlyph edges={cells[f.row][f.col]} designId={f.designId} row={f.row} col={f.col} rows={rows} cols={cols} locked />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Which slot (if any) lies under a screen point. Works at any rendered size. */
export function slotFromPoint(svg: SVGSVGElement | null, x: number, y: number, layout: JigsawLayout): SlotPos | null {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const units = layout.cols * S + 2 * M;
  const scale = rect.width / units;
  const bx = (x - rect.left) / scale - M;
  const by = (y - rect.top) / scale - M;
  const col = Math.floor(bx / S);
  const row = Math.floor(by / S);
  if (row < 0 || col < 0 || row >= layout.rows || col >= layout.cols) return null;
  return { row, col };
}
