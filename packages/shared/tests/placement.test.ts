import { describe, expect, it } from 'vitest';
import { canFixPiece, placeBlockReason } from '../src/model/piece';
import { resolveCompletionWinners } from '../src/engine/rules/win';
import type { GameState, PlayerState } from '../src/model/types';
import { act, current, expectError, forceIntoHand, giveOwnDesign, newGame, others, player, T0, totals, expectedTotals } from './helpers';

describe('placeBlockReason (the single placement rule)', () => {
  const base = { ownerDesignId: 'lotus', piece: { designId: 'lotus', row: 1, col: 2 }, rotation: 0 as const, slot: { row: 1, col: 2 }, fixed: [] };
  it('accepts the right piece, slot and rotation', () => expect(canFixPiece(base)).toBe(true));
  it('rejects another design', () => expect(placeBlockReason({ ...base, piece: { ...base.piece, designId: 'castle' } })).toBe('WRONG_DESIGN'));
  it('rejects the wrong slot', () => expect(placeBlockReason({ ...base, slot: { row: 0, col: 0 } })).toBe('WRONG_SLOT'));
  it('rejects a rotated piece', () => expect(placeBlockReason({ ...base, rotation: 2 })).toBe('WRONG_ROTATION'));
  it('rejects a filled slot', () => expect(placeBlockReason({ ...base, fixed: [{ designId: 'lotus', row: 1, col: 2 }] })).toBe('SLOT_TAKEN'));
});

describe('PLACE / ROTATE in the engine', () => {
  const setup = (): { s: GameState; me: string; id: string } => {
    const s0 = newGame(3);
    const me = others(s0, current(s0))[0]; // deliberately NOT the active player
    const id = `${player(s0, me).designId}:2:1`;
    return { s: forceIntoHand(s0, me, id, 1), me, id };
  };

  it('works off-turn and during auctions, needs the correct rotation', () => {
    let { s, me, id } = setup();
    const seller = current(s);
    s = act(s, { type: 'SELL', playerId: seller, pieceId: player(s, seller).hand[0], now: T0 });
    expect(expectError(s, { type: 'PLACE', playerId: me, pieceId: id, row: 2, col: 1, now: T0 })).toBe('WRONG_ROTATION');
    s = act(s, { type: 'ROTATE', playerId: me, pieceId: id, rotation: 0, now: T0 });
    s = act(s, { type: 'PLACE', playerId: me, pieceId: id, row: 2, col: 1, now: T0 });
    expect(player(s, me).fixed).toEqual([id]);
    expect(player(s, me).hand).not.toContain(id);
    expect(s.rotations[id]).toBeUndefined();
    expect(totals(s)).toEqual(expectedTotals(s));
  });

  it('fixed pieces cannot move, rotate or be sold', () => {
    let { s, me, id } = setup();
    s = act(s, { type: 'ROTATE', playerId: me, pieceId: id, rotation: 0, now: T0 });
    s = act(s, { type: 'PLACE', playerId: me, pieceId: id, row: 2, col: 1, now: T0 });
    expect(expectError(s, { type: 'PLACE', playerId: me, pieceId: id, row: 2, col: 1, now: T0 })).toBe('PIECE_FIXED');
    expect(expectError(s, { type: 'ROTATE', playerId: me, pieceId: id, rotation: 1, now: T0 })).toBe('PIECE_FIXED');
  });

  it("rejects other designs' pieces, out-of-bounds slots and pieces you don't hold", () => {
    let { s, me } = setup();
    const foreign = player(s, current(s)).designId;
    s = forceIntoHand(s, me, `${foreign}:0:0`, 0);
    expect(expectError(s, { type: 'PLACE', playerId: me, pieceId: `${foreign}:0:0`, row: 0, col: 0, now: T0 })).toBe('WRONG_DESIGN');
    expect(expectError(s, { type: 'PLACE', playerId: me, pieceId: `${foreign}:0:0`, row: 9, col: 0, now: T0 })).toBe('OUT_OF_BOUNDS');
    const notMine = player(s, current(s)).hand[0];
    expect(expectError(s, { type: 'PLACE', playerId: me, pieceId: notMine, row: 0, col: 0, now: T0 })).toBe('NOT_IN_HAND');
  });
});

describe('winning', () => {
  it('the game ends immediately when a player fixes all 16 pieces', () => {
    let s = newGame(2);
    const me = others(s, current(s))[0];
    s = giveOwnDesign(s, me);
    const d = player(s, me).designId;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        expect(s.phase).toBe('playing');
        s = act(s, { type: 'PLACE', playerId: me, pieceId: `${d}:${row}:${col}`, row, col, now: T0 });
      }
    }
    expect(s.phase).toBe('ended');
    expect(s.result).toMatchObject({ reason: 'completed', winners: [me] });
    expect(s.turn.deadline).toBeNull();
    expect(expectError(s, { type: 'BUY', playerId: current(s), now: T0 })).toBe('GAME_ENDED');
    expect(totals(s)).toEqual(expectedTotals(s));
  });

  it('a completion during an auction returns the auctioned piece to the pool', () => {
    let s = newGame(2);
    const seller = current(s);
    const me = others(s, seller)[0];
    s = giveOwnDesign(s, me);
    s = act(s, { type: 'SELL', playerId: seller, pieceId: player(s, seller).hand[0], now: T0 });
    const d = player(s, me).designId;
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      s = act(s, { type: 'PLACE', playerId: me, pieceId: `${d}:${row}:${col}`, row, col, now: T0 });
    }
    expect(s.auction).toBeNull();
    expect(totals(s)).toEqual(expectedTotals(s));
  });

  it('simultaneous completion goes to the most coins; equal coins share', () => {
    const mk = (id: string, coins: number) => ({ id, coins }) as PlayerState;
    expect(resolveCompletionWinners([mk('a', 3), mk('b', 7)])).toEqual(['b']);
    expect(resolveCompletionWinners([mk('a', 5), mk('b', 5)])).toEqual(['a', 'b']);
  });
});
