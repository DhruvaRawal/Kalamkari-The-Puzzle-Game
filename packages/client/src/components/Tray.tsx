import type { HandPieceView, PieceId } from '@kalamkari/shared';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { gridPosition, placeNewPieces, type TrayPos } from '../utils/trayLayout';
import { PADDED, S } from './PieceShape';

export interface TrayProps {
  pieces: HandPieceView[];
  positions: Record<PieceId, TrayPos>;
  /** Cell size in px. */
  size: number;
  trayRef: (el: HTMLElement | null) => void;
  /** Called with positions for newly arrived pieces (so they stay put afterwards). */
  onAssign: (added: Record<PieceId, TrayPos>) => void;
  renderPiece: (piece: HandPieceView, style: { left: string; top: string }, pos: TrayPos) => ComponentChildren;
  header?: ComponentChildren;
}

/** Free-form area holding your unfixed pieces. Positions are fractions of width, so it reflows. */
export function Tray(p: TrayProps) {
  const el = useRef<HTMLElement | null>(null);
  // null until measured: positions are only assigned once the real width is known.
  const [width, setWidth] = useState<number | null>(null);
  const box = (p.size * PADDED) / S;
  const step = box * 0.82;
  const perRow = Math.max(1, Math.floor(((width ?? 320) - box) / step) + 1);

  useEffect(() => {
    if (!el.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el.current);
    return () => ro.disconnect();
  }, []);

  // Only the hand that this tray holds matters for collisions.
  const held = Object.fromEntries(p.pieces.filter((x) => p.positions[x.id]).map((x) => [x.id, p.positions[x.id]]));
  const fresh = placeNewPieces(
    p.pieces.map((x) => x.id),
    held,
    perRow,
    step,
  );
  const freshKey = Object.keys(fresh).join(',');
  useEffect(() => {
    if (freshKey && width !== null) p.onAssign(fresh);
  }, [freshKey, width !== null]);
  const placed = p.pieces.map((piece, i) => ({ piece, pos: p.positions[piece.id] ?? fresh[piece.id] ?? gridPosition(i, perRow, step) }));
  const height = Math.max(box * 2, ...placed.map(({ pos }) => pos.y + box)) + 8;
  const usable = Math.max(0, (width ?? 320) - box);

  return (
    <section class="tray card" aria-label="Your pieces">
      {p.header}
      <div
        class="tray-area"
        ref={(node) => {
          el.current = node;
          p.trayRef(node);
        }}
        style={{ height: `${height}px` }}
      >
        {p.pieces.length === 0 && <p class="muted tray-empty">No unfixed pieces. Buy or win one at auction.</p>}
        {placed.map(({ piece, pos }) =>
          p.renderPiece(piece, { left: `${Math.min(1, Math.max(0, pos.x)) * usable}px`, top: `${Math.max(0, pos.y)}px` }, pos),
        )}
      </div>
    </section>
  );
}

/** Converts a drop (ghost top-left in viewport px) into a stored tray position. */
export function trayPosFromDrop(tray: HTMLElement, left: number, top: number, box: number): TrayPos | null {
  const r = tray.getBoundingClientRect();
  const cx = left + box / 2;
  const cy = top + box / 2;
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom + box / 2) return null;
  const usable = Math.max(1, r.width - box);
  return { x: Math.min(1, Math.max(0, (left - r.left) / usable)), y: Math.max(0, top - r.top) };
}
