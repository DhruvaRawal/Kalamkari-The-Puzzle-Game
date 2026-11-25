import layoutData from '../config/jigsawLayout.json';
import { createRng, nextFloat } from '../engine/rng';
import type { EdgeType, JigsawLayout, PieceEdges } from './types';

const CODE: Record<string, EdgeType> = { F: 'flat', T: 'tab', S: 'socket' };

/** Parses "FTST" (top,right,bottom,left) into edge types. */
export function parseEdges(code: string): PieceEdges {
  if (!/^[FTS]{4}$/.test(code)) throw new Error(`Invalid edge code "${code}"`);
  const [t, r, b, l] = code.split('').map((c) => CODE[c]);
  return [t, r, b, l];
}

export function encodeEdges(edges: PieceEdges): string {
  return edges.map((e) => e[0].toUpperCase()).join('');
}

export const complementOf = (e: EdgeType): EdgeType => (e === 'tab' ? 'socket' : e === 'socket' ? 'tab' : 'flat');

/**
 * Builds a valid layout for any grid: border edges flat, each interior seam a random tab/socket pair.
 * Used when jigsawLayout.json has no hand-made layout for the configured grid.
 */
export function generateLayout(rows: number, cols: number, seed = 1): JigsawLayout {
  let rng = createRng(seed);
  const flip = (): EdgeType => {
    const [v, next] = nextFloat(rng);
    rng = next;
    return v < 0.5 ? 'tab' : 'socket';
  };
  // right[r][c] = the right edge of cell (r,c); bottom[r][c] likewise.
  const right = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, flip));
  const bottom = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, flip));
  const cells: PieceEdges[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: PieceEdges[] = [];
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 'flat' : complementOf(bottom[r - 1][c]);
      const rgt = c === cols - 1 ? 'flat' : right[r][c];
      const bot = r === rows - 1 ? 'flat' : bottom[r][c];
      const lft = c === 0 ? 'flat' : complementOf(right[r][c - 1]);
      row.push([top, rgt, bot, lft]);
    }
    cells.push(row);
  }
  return { rows, cols, cells };
}

/** The layout for a grid: hand-made from jigsawLayout.json if present, else generated. */
export function getLayout(rows: number, cols: number): JigsawLayout {
  const raw = (layoutData.layouts as Record<string, string[][]>)[`${rows}x${cols}`];
  if (!raw) return generateLayout(rows, cols, rows * 1000 + cols);
  if (raw.length !== rows || raw.some((r) => r.length !== cols)) {
    throw new Error(`jigsawLayout ${rows}x${cols} has wrong dimensions`);
  }
  return { rows, cols, cells: raw.map((r) => r.map(parseEdges)) };
}

export interface LayoutProblem {
  row: number;
  col: number;
  side: 'top' | 'right' | 'bottom' | 'left';
  message: string;
}

/** Checks that border edges are flat and every interior seam is tab against socket. */
export function validateLayout(layout: JigsawLayout): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const { rows, cols, cells } = layout;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [top, right, bottom, left] = cells[r][c];
      const check = (side: LayoutProblem['side'], isBorder: boolean, edge: EdgeType, neighbour?: EdgeType) => {
        if (isBorder) {
          if (edge !== 'flat') problems.push({ row: r, col: c, side, message: `border edge is ${edge}` });
        } else if (edge === 'flat' || neighbour !== complementOf(edge)) {
          problems.push({ row: r, col: c, side, message: `${edge} meets ${neighbour}` });
        }
      };
      check('top', r === 0, top, r > 0 ? cells[r - 1][c][2] : undefined);
      check('right', c === cols - 1, right, c < cols - 1 ? cells[r][c + 1][3] : undefined);
      check('bottom', r === rows - 1, bottom, r < rows - 1 ? cells[r + 1][c][0] : undefined);
      check('left', c === 0, left, c > 0 ? cells[r][c - 1][1] : undefined);
    }
  }
  return problems;
}
