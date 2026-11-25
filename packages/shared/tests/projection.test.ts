import { describe, expect, it } from 'vitest';
import { GameHost } from '../src/engine/host';
import { projectStateFor } from '../src/engine/projection';
import { availableActions, bidOptions, placementBlockReason } from '../src/engine/selectors';
import type { GameState } from '../src/model/types';
import { act, current, forceIntoHand, newGame, others, player, T0 } from './helpers';

const p0hand = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.hand.length;

/** Every secret that `viewer` must not learn. */
function secretsFor(s: GameState, viewerId: string): string[] {
  const secrets = new Set<string>();
  for (const p of s.players) {
    if (p.id === viewerId) continue;
    p.hand.forEach((id) => secrets.add(id));
    p.fixed.forEach((id) => secrets.add(id));
  }
  s.bank.pool.forEach((id) => secrets.add(id));
  if (s.auction) secrets.add(s.auction.pieceId);
  // A viewer's own pieces may legitimately appear; never flag them.
  const me = s.players.find((p) => p.id === viewerId);
  me?.hand.forEach((id) => secrets.delete(id));
  me?.fixed.forEach((id) => secrets.delete(id));
  return [...secrets];
}

function expectNoLeaks(s: GameState) {
  for (const viewer of [...s.players.map((p) => p.id), null]) {
    const view = projectStateFor(s, viewer);
    const json = JSON.stringify(view);
    for (const secret of secretsFor(s, viewer ?? '')) {
      expect(json.includes(secret), `${viewer} sees ${secret}`).toBe(false);
    }
    expect(json).not.toContain('"rng"');
    // Outside my own section (where held pieces of any design legitimately appear),
    // no design id may appear at all — so nobody can learn who owns which design.
    const publicJson = JSON.stringify({ ...view, me: null });
    for (const p of s.players) expect(publicJson, `${viewer} sees design of ${p.id}`).not.toContain(p.designId);
  }
}

describe('projectStateFor', () => {
  it('never leaks designs, hands, pool or the auction piece', () => {
    let s = newGame(4);
    s = act(s, { type: 'BUY', playerId: current(s), now: T0 });
    s = act(s, { type: 'SELL', playerId: current(s), pieceId: player(s, current(s)).hand[0], now: T0 });
    s = act(s, { type: 'BID', playerId: others(s, current(s))[0], amount: 2, now: T0 + 1 });
    expectNoLeaks(s);
    s = act(s, { type: 'TICK', now: s.auction!.endsAt });
    expectNoLeaks(s);
  });

  it('designs stay secret even after the game ends', () => {
    let s = newGame(2);
    s = { ...s, bank: { ...s.bank, pool: [] } };
    s = act(s, { type: 'END_TURN', playerId: current(s), now: T0 });
    s = act(s, { type: 'END_TURN', playerId: current(s), now: T0 });
    expect(s.phase).toBe('ended');
    expectNoLeaks(s);
  });

  it('shows my own hand, rotations and design', () => {
    const s = newGame(3);
    const me = s.players[0];
    const v = projectStateFor(s, me.id);
    expect(v.me!.designId).toBe(me.designId);
    expect(v.me!.hand.map((h) => h.id)).toEqual(me.hand);
    expect(v.me!.hand[0].rotation).toBe(s.rotations[me.hand[0]]);
    expect(v.players.find((p) => p.id === s.players[1].id)!.pieceCount).toBe(10);
    expect(v.players.find((p) => p.id === s.players[1].id)!.handCount).toBeNull();
  });

  it('hides opponents’ fixed counts unless showFixedCounts is on', () => {
    for (const showFixedCounts of [false, true]) {
      let s = newGame(2, { config: { showFixedCounts } });
      const [a, b] = s.players;
      s = forceIntoHand(s, b.id, `${b.designId}:0:0`, 0);
      s = act(s, { type: 'PLACE', playerId: b.id, pieceId: `${b.designId}:0:0`, row: 0, col: 0, now: T0 });
      const v = projectStateFor(s, a.id);
      expect(v.players.find((p) => p.id === b.id)!.fixedCount).toBe(showFixedCounts ? 1 : null);
      expect(v.players.find((p) => p.id === a.id)!.fixedCount).toBe(0);
      expect(v.players.find((p) => p.id === b.id)!.handCount).toBe(showFixedCounts ? p0hand(s, b.id) : null);
      // The public log must not leak it either.
      expect(v.log.some((e) => e.kind === 'fixed')).toBe(showFixedCounts);
      expect(projectStateFor(s, b.id).log.some((e) => e.kind === 'fixed')).toBe(true);
    }
  });
});

describe('selectors use the same validators as the engine', () => {
  it('availableActions matches what the reducer accepts', () => {
    const s = newGame(3);
    const host = new GameHost(s);
    for (const p of s.players) {
      const v = host.viewFor(p.id);
      const avail = availableActions(v, p.id);
      const res = new GameHost(s).submit(p.id, { type: 'BUY' }, T0);
      expect(avail.buy === null).toBe(res.ok);
    }
  });

  it('bidOptions reflect seller and coins', () => {
    let s = newGame(2);
    const seller = current(s);
    s = act(s, { type: 'SELL', playerId: seller, pieceId: player(s, seller).hand[0], now: T0 });
    const other = others(s, seller)[0];
    expect(bidOptions(projectStateFor(s, seller), seller, T0).blocked).toBe('SELLER_CANNOT_BID');
    expect(bidOptions(projectStateFor(s, other), other, T0)).toEqual({ blocked: null, minBid: 1, maxBid: 10 });
  });

  it('placementBlockReason mirrors the engine', () => {
    let s = newGame(2);
    const me = s.players[0];
    const id = `${me.designId}:3:3`;
    s = forceIntoHand(s, me.id, id, 2);
    const v = projectStateFor(s, me.id);
    expect(placementBlockReason(v, id, { row: 3, col: 3 })).toBe('WRONG_ROTATION');
    expect(placementBlockReason(v, id, { row: 0, col: 3 })).toBe('WRONG_SLOT');
  });
});

describe('GameHost', () => {
  it('stamps playerId and clock, rejects junk, and reports deadlines', () => {
    const s = newGame(2);
    const host = new GameHost(s);
    expect(host.submit(current(s), { type: 'HACK' }, T0).ok).toBe(false);
    expect(host.submit(current(s), { type: 'TICK' }, T0).ok).toBe(false); // system actions can't be submitted
    expect(host.nextDeadline()).toBe(s.turn.deadline);
    expect(host.tick(s.turn.deadline!)).toBe(true);
    expect(host.state.turn.playerId).not.toBe(current(s));
  });
});
