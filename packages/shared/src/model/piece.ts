import type { DesignId, PieceClass, PieceId, PieceRef, Rotation, Slot } from './types';

export const pieceIdOf = (ref: PieceRef): PieceId => `${ref.designId}:${ref.row}:${ref.col}`;

export function parsePieceId(id: PieceId): PieceRef {
  const parts = id.split(':');
  if (parts.length !== 3) throw new Error(`Invalid piece id "${id}"`);
  return { designId: parts[0], row: Number(parts[1]), col: Number(parts[2]) };
}

/** Class from position within its own design: two borders = corner, one = edge, none = center. */
export function pieceClassAt(row: number, col: number, rows: number, cols: number): PieceClass {
  const borders = Number(row === 0 || row === rows - 1) + Number(col === 0 || col === cols - 1);
  return borders === 2 ? 'corner' : borders === 1 ? 'edge' : 'center';
}

export const normalizeRotation = (n: number): Rotation => ((((Math.round(n) % 4) + 4) % 4) as Rotation);

export type PlaceBlockReason = 'WRONG_DESIGN' | 'WRONG_SLOT' | 'WRONG_ROTATION' | 'SLOT_TAKEN';

export interface PlaceCheck {
  ownerDesignId: DesignId;
  piece: PieceRef;
  rotation: Rotation;
  slot: Slot;
  /** Slots already filled on the owner's board. */
  fixed: readonly PieceRef[];
}

/**
 * THE placement rule. Used by the drag-snap check, keyboard placement and the engine.
 * Returns null when the piece fixes into the slot.
 */
export function placeBlockReason(c: PlaceCheck): PlaceBlockReason | null {
  if (c.fixed.some((f) => f.row === c.slot.row && f.col === c.slot.col)) return 'SLOT_TAKEN';
  if (c.piece.designId !== c.ownerDesignId) return 'WRONG_DESIGN';
  if (c.piece.row !== c.slot.row || c.piece.col !== c.slot.col) return 'WRONG_SLOT';
  if (c.rotation !== 0) return 'WRONG_ROTATION';
  return null;
}

export const canFixPiece = (c: PlaceCheck): boolean => placeBlockReason(c) === null;
