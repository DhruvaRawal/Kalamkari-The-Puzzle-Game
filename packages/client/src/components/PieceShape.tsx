import { buildPiecePath, getDesign, KNOB_REACH, type PieceEdges, type Rotation } from '@kalamkari/shared';
import { useId } from 'preact/hooks';
import { useImageStatus } from '../hooks/useImageStatus';

/** Board units: one cell is S wide; knobs reach M beyond it. */
export const S = 100;
export const M = Math.ceil(KNOB_REACH * S) + 2;
export const PADDED = S + 2 * M;

const FLAT: PieceEdges = ['flat', 'flat', 'flat', 'flat'];

/**
 * The full design picture in board units, positioned so cell (row, col) sits at the origin.
 * Falls back to a generated pattern when the image is missing or fails to load.
 */
export function DesignArt(props: { designId: string; rows: number; cols: number; row: number; col: number; opacity?: number }) {
  const design = getDesign(props.designId);
  const status = useImageStatus(design?.image ?? null);
  const gid = useId();
  const x = -props.col * S;
  const y = -props.row * S;
  const w = props.cols * S;
  const h = props.rows * S;
  if (design?.image && status !== 'error') {
    return <image href={design.image} x={x} y={y} width={w} height={h} opacity={props.opacity} preserveAspectRatio="none" />;
  }
  // Placeholder: a per-design gradient with rings, so every cell of the picture looks different.
  const [a, b, c] = design?.palette ?? ['#555', '#999', '#ddd'];
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g opacity={props.opacity}>
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={a} />
          <stop offset="0.55" stop-color={b} />
          <stop offset="1" stop-color={c} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#g${gid})`} />
      {[0.12, 0.22, 0.32, 0.42].map((r) => (
        <circle cx={cx} cy={cy} r={r * w} fill="none" stroke={c} stroke-width={6} opacity={0.6} />
      ))}
      <text x={cx} y={cy + 20} text-anchor="middle" font-size={64} font-family="Georgia, serif" fill={c}>
        {design?.name.split(' ')[0] ?? props.designId}
      </text>
    </g>
  );
}

export interface PieceGlyphProps {
  edges: PieceEdges;
  designId?: string;
  row: number;
  col: number;
  rows: number;
  cols: number;
  rotation?: Rotation;
  faceDown?: boolean;
  faceDownLabel?: string;
  locked?: boolean;
  highlight?: 'hover' | 'selected' | 'error' | null;
}

/** The piece drawn in board units at the origin, as an SVG <g>. */
export function PieceGlyph(p: PieceGlyphProps) {
  const clip = useId();
  const edges = p.faceDown ? FLAT : p.edges;
  const d = buildPiecePath(edges, S);
  const rot = (p.rotation ?? 0) * 90;
  return (
    <g transform={rot ? `rotate(${rot} ${S / 2} ${S / 2})` : undefined} class={`piece-glyph${p.locked ? ' is-locked' : ''}`}>
      <clipPath id={`c${clip}`}>
        <path d={d} />
      </clipPath>
      {p.faceDown || !p.designId ? (
        <g clip-path={`url(#c${clip})`}>
          <rect x={0} y={0} width={S} height={S} fill="var(--madder)" />
          <rect x={8} y={8} width={S - 16} height={S - 16} fill="none" stroke="var(--turmeric)" stroke-width={3} />
          <circle cx={S / 2} cy={S / 2} r={22} fill="none" stroke="var(--turmeric)" stroke-width={3} />
          <circle cx={S / 2} cy={S / 2} r={8} fill="var(--turmeric)" />
          {p.faceDownLabel && (
            <text x={S / 2} y={S - 14} text-anchor="middle" font-size={13} fill="var(--cream)" font-weight={700}>
              {p.faceDownLabel}
            </text>
          )}
        </g>
      ) : (
        <g clip-path={`url(#c${clip})`}>
          <DesignArt designId={p.designId} rows={p.rows} cols={p.cols} row={p.row} col={p.col} />
        </g>
      )}
      <path d={d} class={`piece-outline${p.highlight ? ` is-${p.highlight}` : ''}`} />
    </g>
  );
}

export interface PieceShapeProps extends PieceGlyphProps {
  /** Rendered cell size in px (the svg is larger to fit the knobs). */
  size: number;
  class?: string;
  title?: string;
}

/** A standalone piece. The one renderer for tray, drag ghost, auction and previews. */
export function PieceShape({ size, class: cls, title, ...glyph }: PieceShapeProps) {
  const px = (size * PADDED) / S;
  return (
    <svg
      class={`piece-shape ${cls ?? ''}`}
      width={px}
      height={px}
      viewBox={`${-M} ${-M} ${PADDED} ${PADDED}`}
      role="img"
      aria-label={title}
    >
      <PieceGlyph {...glyph} />
    </svg>
  );
}
