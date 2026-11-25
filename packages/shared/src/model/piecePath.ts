import type { EdgeType, PieceEdges } from './types';

/**
 * How far a knob reaches beyond the cell, as a fraction of the cell size.
 * Renderers pad their viewBox by this much so tabs aren't clipped.
 */
export const KNOB_REACH = 0.27;

type Pt = readonly [along: number, out: number];

/**
 * One knob along a unit edge from (0,0) to (1,0); `out` is positive away from the piece.
 * Segments: [control1, control2, end] for cubic beziers.
 */
const KNOB: readonly (readonly [Pt, Pt, Pt])[] = [
  [[0.36, 0], [0.42, 0.04], [0.39, 0.09]],
  [[0.33, 0.19], [0.4, 0.26], [0.5, 0.26]],
  [[0.6, 0.26], [0.67, 0.19], [0.61, 0.09]],
  [[0.58, 0.04], [0.64, 0], [0.66, 0]],
];

const sign = (e: EdgeType) => (e === 'tab' ? 1 : e === 'socket' ? -1 : 0);
const fmt = (n: number) => Number(n.toFixed(2)).toString();

/**
 * Builds the closed SVG outline of a piece occupying [0,size]² (knobs reach outside it), traced
 * clockwise from the top-left corner. Every piece in every design comes from this one function.
 */
export function buildPiecePath(edges: PieceEdges, size = 100): string {
  // Map (along, out) on side i to absolute coordinates, walking clockwise.
  const toXY = [
    (a: number, o: number) => [a * size, -o * size], // top: left → right, out = up
    (a: number, o: number) => [size + o * size, a * size], // right: top → bottom, out = right
    (a: number, o: number) => [size - a * size, size + o * size], // bottom: right → left, out = down
    (a: number, o: number) => [-o * size, size - a * size], // left: bottom → top, out = left
  ] as const;

  let d = 'M0 0';
  edges.forEach((edge, side) => {
    const s = sign(edge);
    const map = (p: Pt) => toXY[side](p[0], p[1] * s).map(fmt).join(' ');
    if (s !== 0) {
      d += ` L${map([0.34, 0])}`;
      for (const [c1, c2, end] of KNOB) d += ` C${map(c1)} ${map(c2)} ${map(end)}`;
    }
    d += ` L${map([1, 0])}`;
  });
  return `${d} Z`;
}

/** Rotates edges clockwise by `quarterTurns` (what the piece looks like after rotating). */
export function rotateEdges(edges: PieceEdges, quarterTurns: number): PieceEdges {
  const k = ((quarterTurns % 4) + 4) % 4;
  return [0, 1, 2, 3].map((i) => edges[(i - k + 4) % 4]) as unknown as PieceEdges;
}
