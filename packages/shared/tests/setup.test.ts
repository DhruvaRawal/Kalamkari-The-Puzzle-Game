import { describe, expect, it } from 'vitest';
import { AVATAR_COUNT, AVATAR_MOTIFS } from '../src/config/avatars';
import { createGame } from '../src/engine/createGame';
import { projectStateFor } from '../src/engine/projection';
import { newGame, T0, totals, expectedTotals } from './helpers';

describe('setup', () => {
  it.each([
    [4, 24, 10, 64, 50],
    [3, 18, 10, 48, 40],
    [2, 12, 10, 32, 30],
  ])('%i players: Auction House keeps %i pieces and %i coins (%i pieces, %i coins in total)', (n, pool, coins, pieces, total) => {
    const s = newGame(n);
    expect(s.players).toHaveLength(n);
    expect(s.bank.pool).toHaveLength(pool);
    expect(s.bank.coins).toBe(coins);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(10);
      expect(p.coins).toBe(10);
      expect(p.fixed).toEqual([]);
    }
    expect(totals(s)).toEqual({ coins: total, pieces });
    expect(s.designIds).toHaveLength(n);
  });

  it('only puts the players’ own designs in play', () => {
    const s = newGame(2);
    expect([...s.designIds].sort()).toEqual(s.players.map((p) => p.designId).sort());
    const all = [...s.bank.pool, ...s.players.flatMap((p) => p.hand)];
    expect(all.every((id) => s.designIds.includes(id.split(':')[0]))).toBe(true);
    // Different seeds pick different design pairs out of the four.
    const pairs = new Set(Array.from({ length: 20 }, (_, i) => newGame(2, { seed: i }).designIds.slice().sort().join()));
    expect(pairs.size).toBeGreaterThan(1);
  });

  it('assigns distinct designs and deals no piece twice', () => {
    const s = newGame(4);
    expect(new Set(s.players.map((p) => p.designId)).size).toBe(4);
    const all = [...s.bank.pool, ...s.players.flatMap((p) => p.hand)];
    expect(new Set(all).size).toBe(64);
  });

  it('gives every dealt piece a rotation, random when configured', () => {
    const s = newGame(4);
    const rots = s.players.flatMap((p) => p.hand.map((id) => s.rotations[id]));
    expect(rots.every((r) => r >= 0 && r <= 3)).toBe(true);
    expect(new Set(rots).size).toBeGreaterThan(1);
    const upright = newGame(4, { config: { randomInitialRotation: false } });
    expect(Object.values(upright.rotations).every((r) => r === 0)).toBe(true);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(newGame(3)).toEqual(newGame(3));
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => newGame(4, { seed: i }).turn.playerId));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('starts with the chosen first player and a running turn clock', () => {
    const s = newGame(2);
    expect(s.players.map((p) => p.id)).toContain(s.turn.playerId);
    expect(s.turn.deadline).toBe(T0 + s.config.turnTimeoutMs);
    expect(s.phase).toBe('playing');
  });

  it.each([1, 5])('rejects %i players', (n) => {
    const res = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: '' })), seed: 1, now: 0 });
    expect(res.ok).toBe(false);
  });

  it('rejects duplicate player ids and too few designs', () => {
    expect(createGame({ players: [{ id: 'a', name: '' }, { id: 'a', name: '' }], seed: 1, now: 0 }).ok).toBe(false);
    expect(
      createGame({ players: [{ id: 'a', name: '' }, { id: 'b', name: '' }, { id: 'c', name: '' }], seed: 1, now: 0, designIds: ['x', 'y'] }).ok,
    ).toBe(false);
  });

  it('scales by config: 5x5 grid and a 5th design', () => {
    const res = createGame({
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      seed: 3,
      now: 0,
      config: { grid: { rows: 5, cols: 5 } },
      designIds: ['d1', 'd2', 'd3', 'd4', 'd5'],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(totals(res.state).pieces).toBe(50); // 2 players × 25 pieces
    expect(res.state.layout.rows).toBe(5);
  });

  it('gives every player a distinct, public avatar', () => {
    const s = newGame(4);
    const avatars = s.players.map((p) => p.avatar);
    expect(new Set(avatars.map((a) => a % AVATAR_MOTIFS)).size).toBe(4); // no two players share a motif
    for (const a of avatars) expect(a >= 0 && a < AVATAR_COUNT).toBe(true);
    // Same for every viewer, and deterministic per seed.
    for (const viewer of s.players) expect(projectStateFor(s, viewer.id).players.map((p) => p.avatar)).toEqual(avatars);
    expect(newGame(4).players.map((p) => p.avatar)).toEqual(avatars);
    // Different seeds give different avatars.
    expect(new Set(Array.from({ length: 20 }, (_, i) => newGame(2, { seed: i }).players[0].avatar)).size).toBeGreaterThan(1);
  });
});
