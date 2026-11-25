import { getDesign, type PieceClass, type PieceRef, type Rotation } from '@kalamkari/shared';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export const designName = (id: string) => getDesign(id)?.name ?? id;

export const rotationLabel = (r: Rotation) => (r === 0 ? 'upright' : `rotated ${r * 90}°`);

export const classLabel = (c: PieceClass) => ({ corner: 'Corner', edge: 'Edge', center: 'Centre' })[c];

/** Screen-reader description of a held piece. Sighted players see the same information. */
export function pieceLabel(ref: PieceRef, rotation: Rotation, ownDesignId: string | undefined, pieceClass: PieceClass): string {
  const where = `row ${ref.row + 1}, column ${ref.col + 1}`;
  const whose = ref.designId === ownDesignId ? 'Your design' : `${designName(ref.designId)} design`;
  return `${whose}, ${classLabel(pieceClass).toLowerCase()} piece, ${where}, ${rotationLabel(rotation)}`;
}
