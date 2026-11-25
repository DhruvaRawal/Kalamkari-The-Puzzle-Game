import { useCallback, useEffect, useState } from 'preact/hooks';
import type { PieceId } from '@kalamkari/shared';

/** Free-form tray positions. Client-only (not a game rule), persisted per game in localStorage. */
export interface TrayPos {
  /** 0..1 of the usable tray width. */
  x: number;
  /** px from the top. */
  y: number;
}

const read = (key: string): Record<PieceId, TrayPos> => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    return {};
  }
};

export function useTrayLayout(gameKey: string) {
  const key = `kalamkari.tray.${gameKey}`;
  const [positions, setPositions] = useState<Record<PieceId, TrayPos>>(() => read(key));
  useEffect(() => setPositions(read(key)), [key]);
  const move = useCallback(
    (id: PieceId, pos: TrayPos) =>
      setPositions((prev) => {
        const next = { ...prev, [id]: pos };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }),
    [key],
  );
  /** Persists positions for pieces seen for the first time, so they never reflow later. */
  const assign = useCallback(
    (added: Record<PieceId, TrayPos>) =>
      setPositions((prev) => {
        const next = { ...prev, ...added };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      }),
    [key],
  );
  return { positions, move, assign };
}

/** Grid cell i as a tray position. */
export function gridPosition(index: number, perRow: number, step: number): TrayPos {
  const col = index % perRow;
  const row = Math.floor(index / perRow);
  return { x: perRow <= 1 ? 0 : col / (perRow - 1), y: row * step };
}

/** Picks free grid cells for pieces that have no position yet. */
export function placeNewPieces(
  ids: PieceId[],
  existing: Record<PieceId, TrayPos>,
  perRow: number,
  step: number,
): Record<PieceId, TrayPos> {
  const taken = Object.values(existing);
  const added: Record<PieceId, TrayPos> = {};
  let cell = 0;
  for (const id of ids) {
    if (existing[id]) continue;
    let pos = gridPosition(cell++, perRow, step);
    const near = (p: TrayPos) => Math.abs(p.y - pos.y) < step / 2 && Math.abs(p.x - pos.x) < 0.5 / Math.max(1, perRow - 1);
    while (taken.some(near)) pos = gridPosition(cell++, perRow, step);
    taken.push(pos);
    added[id] = pos;
  }
  return added;
}
