import { describe, expect, it } from 'vitest';
import { encodeEdges, generateLayout, getLayout, validateLayout } from '../src/model/jigsaw';
import { pieceClassAt } from '../src/model/piece';
import { buildPiecePath, rotateEdges } from '../src/model/piecePath';
import type { PieceEdges } from '../src/model/types';

const count = (edges: PieceEdges, t: string) => edges.filter((e) => e === t).length;

/** Rotation-invariant archetype from the sketch legend. */
function archetype(edges: PieceEdges): string {
  const [f, t, s] = [count(edges, 'flat'), count(edges, 'tab'), count(edges, 'socket')];
  if (f === 2 && s === 2) return 'A';
  if (t === 3 && s === 1) return 'B';
  if (f === 1 && t === 1 && s === 2) return 'C';
  if (f === 1 && t === 2 && s === 1) return 'D';
  return `?${encodeEdges(edges)}`;
}

describe('jigsaw layout (transcribed sketch)', () => {
  const layout = getLayout(4, 4);

  it('every interior edge is tab↔socket and every border edge is flat', () => {
    expect(validateLayout(layout)).toEqual([]);
  });

  it('contains exactly 4 of each archetype A, B, C, D', () => {
    const counts: Record<string, number> = {};
    for (const row of layout.cells) for (const cell of row) counts[archetype(cell)] = (counts[archetype(cell)] ?? 0) + 1;
    expect(counts).toEqual({ A: 4, B: 4, C: 4, D: 4 });
  });

  it('archetypes line up with piece classes (A=corner, B=center, C/D=edge)', () => {
    layout.cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        const cls = pieceClassAt(r, c, 4, 4);
        const expected = cls === 'corner' ? ['A'] : cls === 'center' ? ['B'] : ['C', 'D'];
        expect(expected).toContain(archetype(cell));
      }),
    );
  });

  it('detects a broken layout', () => {
    const broken = structuredClone(layout) as typeof layout;
    (broken.cells[0] as PieceEdges[])[0] = ['tab', 'socket', 'socket', 'flat'];
    expect(validateLayout(broken).length).toBeGreaterThan(0);
  });

  it.each([
    [3, 3],
    [5, 5],
    [4, 6],
  ])('generates a valid %ix%i layout when none is hand-made', (rows, cols) => {
    const gen = getLayout(rows, cols);
    expect(gen.cells.length).toBe(rows);
    expect(validateLayout(gen)).toEqual([]);
    expect(generateLayout(rows, cols, 7)).toEqual(generateLayout(rows, cols, 7));
  });
});

describe('buildPiecePath', () => {
  it('builds a closed path for every cell, with a knob per non-flat edge', () => {
    for (const row of getLayout(4, 4).cells) {
      for (const edges of row) {
        const d = buildPiecePath(edges, 100);
        expect(d.startsWith('M0 0')).toBe(true);
        expect(d.endsWith('Z')).toBe(true);
        expect((d.match(/C/g) ?? []).length).toBe(4 * (4 - count(edges, 'flat')));
      }
    }
  });

  it('a flat-edged piece is just a square', () => {
    expect(buildPiecePath(['flat', 'flat', 'flat', 'flat'], 10)).toBe('M0 0 L10 0 L10 10 L0 10 L0 0 Z');
  });

  it('tabs bulge outward and sockets inward', () => {
    const ys = (d: string) => [...d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys(buildPiecePath(['tab', 'flat', 'flat', 'flat'])))).toBeLessThan(0);
    expect(Math.min(...ys(buildPiecePath(['socket', 'flat', 'flat', 'flat'])))).toBeGreaterThanOrEqual(0);
  });

  it('rotateEdges turns clockwise', () => {
    expect(rotateEdges(['tab', 'flat', 'socket', 'flat'], 1)).toEqual(['flat', 'tab', 'flat', 'socket']);
    expect(rotateEdges(['tab', 'flat', 'socket', 'flat'], 4)).toEqual(['tab', 'flat', 'socket', 'flat']);
  });
});
