import { pieceIdOf } from './piece';
import type { DesignId, PieceId } from './types';

/** Every piece id of one design, row-major. */
export function piecesOfDesign(designId: DesignId, rows: number, cols: number): PieceId[] {
  const ids: PieceId[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) ids.push(pieceIdOf({ designId, row, col }));
  return ids;
}

/** Every piece in the game. */
export const allPieces = (designIds: DesignId[], rows: number, cols: number): PieceId[] =>
  designIds.flatMap((d) => piecesOfDesign(d, rows, cols));
