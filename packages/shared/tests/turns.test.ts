import { reduce } from "../src/engine/reducer";
import type { GameAction } from "../src/protocol/actions";
import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/model/types';
import { act, current, expectError, newGame, others, player, T0, totals, expectedTotals } from './helpers';

const buy = (s: GameState, now = T0) => act(s, { type: 'BUY', playerId: current(s), now });
const endTurn = (s: GameState, now = T0) => act(s, { type: 'END_TURN', playerId: current(s), now });
const nextSeat = (s: GameState) => {
  const i = s.players.findIndex((p) => p.id === current(s));
  return s.players[(i + 1) % s.players.length].id;
};

describe('buy', () => {
  it('costs 1 coin and draws one random piece from the pool', () => {
    const s = newGame(4);
    const me = current(s);
    const after = buy(s);
    expect(player(after, me).coins).toBe(9);
    expect(player(after, me).hand).toHaveLength(11);
    expect(after.bank.pool).toHaveLength(23);
    expect(after.bank.coins).toBe(11);
    const drawn = player(after, me).hand.at(-1)!;
    expect(s.bank.pool).toContain(drawn);
    expect(after.rotations[drawn]).toBeGreaterThanOrEqual(0);
    expect(totals(after)).toEqual(expectedTotals(after));
  });

  it('only once per turn, and only on your turn', () => {
    const s = buy(newGame(4));
    expect(expectError(s, { type: 'BUY', playerId: current(s), now: T0 })).toBe('ALREADY_BOUGHT');
    expect(expectError(s, { type: 'BUY', playerId: others(s, current(s))[0], now: T0 })).toBe('NOT_YOUR_TURN');
  });

  it('is blocked with 0 coins (turn can only pass or sell)', () => {
    let s = newGame(2);
    s = { ...s, players: s.players.map((p) => (p.id === current(s) ? { ...p, coins: 0 } : p)) };
    expect(expectError(s, { type: 'BUY', playerId: current(s), now: T0 })).toBe('INSUFFICIENT_COINS');
  });

  it('is blocked when the pool is empty', () => {
    let s = newGame(2);
    s = { ...s, bank: { ...s.bank, pool: [] } };
    expect(expectError(s, { type: 'BUY', playerId: current(s), now: T0 })).toBe('POOL_EMPTY');
  });
});

describe('end turn / pass', () => {
  it('moves clockwise and restarts the clock', () => {
    const s = newGame(4);
    const expected = nextSeat(s);
    const after = endTurn(s, T0 + 5);
    expect(current(after)).toBe(expected);
    expect(after.turn.bought).toBe(false);
    expect(after.turn.deadline).toBe(T0 + 5 + s.config.turnTimeoutMs);
  });

  it('wraps from the last seat to the first', () => {
    let s = newGame(3);
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      order.push(current(s));
      s = endTurn(s);
    }
    expect(order[3]).toBe(order[0]);
    expect(new Set(order.slice(0, 3)).size).toBe(3);
  });

  it('auto-passes when the turn timer runs out', () => {
    const s = newGame(2);
    const me = current(s);
    const early = act(s, { type: 'TICK', now: s.turn.deadline! - 1 });
    expect(current(early)).toBe(me);
    const late = act(s, { type: 'TICK', now: s.turn.deadline! });
    expect(current(late)).not.toBe(me);
    expect(late.log.some((l) => l.kind === 'pass' && l.timedOut)).toBe(true);
  });

  it('shortens the clock of a disconnected active player', () => {
    const s = newGame(2);
    const dc = act(s, { type: 'SET_CONNECTED', playerId: current(s), connected: false, now: T0 + 1000 });
    expect(dc.turn.deadline).toBe(T0 + 1000 + s.config.disconnectedTurnTimeoutMs);
    const late = act(dc, { type: 'TICK', now: dc.turn.deadline! });
    expect(current(late)).not.toBe(current(s));
  });

  it('restores the full clock when the active player reconnects in time', () => {
    const s = newGame(2);
    const dc = act(s, { type: 'SET_CONNECTED', playerId: current(s), connected: false, now: T0 + 1000 });
    const back = act(dc, { type: 'SET_CONNECTED', playerId: current(s), connected: true, now: T0 + 5000 });
    expect(back.turn.deadline).toBe(s.turn.deadline);
  });
});

describe('sell and auction', () => {
  const sellFirst = (s: GameState, now = T0) => {
    const me = current(s);
    const pieceId = player(s, me).hand[0];
    return { me, pieceId, s: act(s, { type: 'SELL', playerId: me, pieceId, now }) };
  };

  it('pays the seller by class and opens a face-down auction', () => {
    const base = newGame(4);
    const { me, pieceId, s } = sellFirst(base);
    const payout = s.auction!.payout;
    expect(payout).toBe(s.config.sellPayout[s.auction!.pieceClass]);
    expect(player(s, me).coins).toBe(10 + payout);
    expect(player(s, me).hand).not.toContain(pieceId);
    expect(s.bank.coins).toBe(10 - payout);
    expect(s.auction).toMatchObject({ pieceId, sellerId: me, highBid: null, endsAt: T0 + 15_000 });
    expect(s.turn.deadline).toBeNull();
    expect(totals(s)).toEqual(expectedTotals(s));
  });

  it('pauses Buy, Sell and End turn while the auction is open', () => {
    const { me, s } = sellFirst(newGame(4));
    expect(expectError(s, { type: 'BUY', playerId: me, now: T0 })).toBe('AUCTION_OPEN');
    expect(expectError(s, { type: 'END_TURN', playerId: me, now: T0 })).toBe('AUCTION_OPEN');
  });

  it('validates bids: not the seller, ascending, within coins', () => {
    const { me, s } = sellFirst(newGame(4));
    const [a, b] = others(s, me);
    expect(expectError(s, { type: 'BID', playerId: me, amount: 1, now: T0 })).toBe('SELLER_CANNOT_BID');
    expect(expectError(s, { type: 'BID', playerId: a, amount: 0, now: T0 })).toBe('BID_TOO_LOW');
    expect(expectError(s, { type: 'BID', playerId: a, amount: 11, now: T0 })).toBe('BID_EXCEEDS_COINS');
    const s2 = act(s, { type: 'BID', playerId: a, amount: 3, now: T0 + 1000 });
    expect(expectError(s2, { type: 'BID', playerId: b, amount: 3, now: T0 + 1000 })).toBe('BID_TOO_LOW');
    const s3 = act(s2, { type: 'BID', playerId: b, amount: 4, now: T0 + 2000 });
    expect(s3.auction!.highBid).toMatchObject({ playerId: b, amount: 4 });
  });

  it('ties go to the earlier bid (equal bids are rejected)', () => {
    const { me, s } = sellFirst(newGame(3));
    const [a, b] = others(s, me);
    const s2 = act(s, { type: 'BID', playerId: a, amount: 2, now: T0 + 1 });
    expect(expectError(s2, { type: 'BID', playerId: b, amount: 2, now: T0 + 2 })).toBe('BID_TOO_LOW');
    expect(s2.auction!.highBid!.playerId).toBe(a);
  });

  it('a bid leaves at least bidResetMs on the clock', () => {
    const { me, s } = sellFirst(newGame(2));
    const [a] = others(s, me);
    const late = act(s, { type: 'BID', playerId: a, amount: 1, now: T0 + 14_000 });
    expect(late.auction!.endsAt).toBe(T0 + 14_000 + s.config.bidResetMs);
    const early = act(s, { type: 'BID', playerId: a, amount: 1, now: T0 + 1000 });
    expect(early.auction!.endsAt).toBe(T0 + 15_000);
  });

  it('rejects bids after the clock ran out', () => {
    const { me, s } = sellFirst(newGame(2));
    expect(expectError(s, { type: 'BID', playerId: others(s, me)[0], amount: 1, now: T0 + 15_000 })).toBe('NO_AUCTION');
  });

  it('highest bidder pays the Auction House and receives the piece; turn returns to the seller', () => {
    const { me, pieceId, s } = sellFirst(newGame(4));
    const [a] = others(s, me);
    const bankBefore = s.bank.coins;
    let t = act(s, { type: 'BID', playerId: a, amount: 5, now: T0 + 1 });
    t = act(t, { type: 'TICK', now: t.auction!.endsAt });
    expect(t.auction).toBeNull();
    expect(player(t, a).coins).toBe(5);
    expect(player(t, a).hand).toContain(pieceId);
    expect(t.bank.coins).toBe(bankBefore + 5);
    expect(current(t)).toBe(me);
    expect(t.turn.sold).toBe(true);
    expect(t.turn.deadline).toBe(T0 + 15_000 + t.config.turnTimeoutMs);
    expect(totals(t)).toEqual(expectedTotals(t));
    // The seller may still buy, then the turn ends automatically.
    const bought = act(t, { type: 'BUY', playerId: me, now: T0 + 16_000 });
    expect(current(bought)).not.toBe(me);
  });

  it('with no bids the piece goes to the pool', () => {
    const { pieceId, s } = sellFirst(newGame(4));
    const t = act(s, { type: 'TICK', now: s.auction!.endsAt });
    expect(t.bank.pool).toContain(pieceId);
    expect(t.bank.pool).toHaveLength(25);
  });

  it('buy then sell: the turn passes after the auction', () => {
    let s = buy(newGame(4));
    const me = current(s);
    s = act(s, { type: 'SELL', playerId: me, pieceId: player(s, me).hand[0], now: T0 });
    s = act(s, { type: 'TICK', now: s.auction!.endsAt });
    expect(current(s)).not.toBe(me);
  });

  it('only one sell per turn', () => {
    let { me, s } = sellFirst(newGame(2));
    s = act(s, { type: 'TICK', now: s.auction!.endsAt });
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: player(s, me).hand[0], now: T0 })).toBe('ALREADY_SOLD');
  });

  it('is disallowed when the Auction House cannot pay', () => {
    let s = newGame(4);
    s = { ...s, bank: { ...s.bank, coins: 0 } };
    const me = current(s);
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: player(s, me).hand[0], now: T0 })).toBe('BANK_INSUFFICIENT_COINS');
  });

  it('allows a 1-coin corner sale when the bank only has 1 coin, but not a 2-coin sale', () => {
    let s = newGame(4);
    s = { ...s, bank: { ...s.bank, coins: 1 } };
    const me = current(s);
    s = {
      ...s,
      players: s.players.map((p) => (p.id === me ? { ...p, hand: [`${p.designId}:0:0`, `${p.designId}:0:1`] } : p)),
    };
    const d = player(s, me).designId;
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: `${d}:0:1`, now: T0 })).toBe('BANK_INSUFFICIENT_COINS');
    expect(act(s, { type: 'SELL', playerId: me, pieceId: `${d}:0:0`, now: T0 }).auction!.payout).toBe(1);
  });

  it('blocks selling fixed pieces, unknown pieces, and with an empty hand', () => {
    let s = newGame(2);
    const me = current(s);
    const d = player(s, me).designId;
    s = { ...s, players: s.players.map((p) => (p.id === me ? { ...p, hand: [], fixed: [`${d}:0:0`] } : p)) };
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: `${d}:0:0`, now: T0 })).toBe('NO_PIECES_TO_SELL');
    s = { ...s, players: s.players.map((p) => (p.id === me ? { ...p, hand: [`${d}:1:1`] } : p)) };
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: `${d}:0:0`, now: T0 })).toBe('PIECE_FIXED');
    expect(expectError(s, { type: 'SELL', playerId: me, pieceId: 'nonsense', now: T0 })).toBe('NOT_IN_HAND');
  });
});

describe('stalemate', () => {
  it('ends when the pool is empty and every player passes in a row; most fixed wins', () => {
    let s = newGame(3);
    s = { ...s, bank: { ...s.bank, pool: [] } };
    const leader = others(s, current(s))[0];
    s = { ...s, players: s.players.map((p) => (p.id === leader ? { ...p, fixed: [`${p.designId}:0:0`], hand: p.hand.slice(1) } : p)) };
    s = endTurn(s);
    s = endTurn(s);
    expect(s.phase).toBe('playing');
    s = endTurn(s);
    expect(s.phase).toBe('ended');
    expect(s.result).toMatchObject({ reason: 'stalemate', winners: [leader] });
  });

  it('shares the win on equal fixed counts', () => {
    let s = newGame(2);
    s = { ...s, bank: { ...s.bank, pool: [] } };
    s = endTurn(endTurn(s));
    expect(s.result!.winners).toHaveLength(2);
  });

  it('any buy or sell resets the pass count', () => {
    let s = newGame(2);
    s = { ...s, bank: { ...s.bank, pool: [] } };
    s = endTurn(s);
    const me = current(s);
    s = act(s, { type: 'SELL', playerId: me, pieceId: player(s, me).hand[0], now: T0 });
    s = act(s, { type: 'TICK', now: s.auction!.endsAt }); // unsold → back in pool
    s = endTurn(s);
    expect(s.emptyPoolPasses).toBe(0);
    expect(s.phase).toBe('playing');
  });
});

describe('invariants under random play', () => {
  it('conserves 50 coins and 64 pieces and never throws', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = newGame(2 + (seed % 3), { seed });
      let now = T0;
      let rand = seed;
      const r = (n: number) => {
        rand = (rand * 1103515245 + 12345) & 0x7fffffff;
        return rand % n;
      };
      for (let step = 0; step < 300 && s.phase === 'playing'; step++) {
        now += 500 + r(4000);
        const pid = s.players[r(s.players.length)].id;
        const hand = player(s, pid).hand;
        const actions = [
          { type: 'BUY' as const },
          { type: 'END_TURN' as const },
          { type: 'SELL' as const, pieceId: hand[r(Math.max(1, hand.length))] ?? 'x' },
          { type: 'BID' as const, amount: 1 + r(6) },
          { type: 'TICK' as const },
          { type: 'ROTATE' as const, pieceId: hand[0] ?? 'x', rotation: r(4) as 0 },
          { type: 'PLACE' as const, pieceId: hand[0] ?? 'x', row: r(4), col: r(4) },
        ];
        const a = actions[r(actions.length)];
        const res = a.type === 'TICK' ? reduceSafe(s, { type: 'TICK', now }) : reduceSafe(s, { ...a, playerId: pid, now });
        s = res;
        const t = totals(s);
        expect(t).toEqual(expectedTotals(s));
        expect(s.players.every((p) => p.coins >= 0) && s.bank.coins >= 0).toBe(true);
      }
    }
  });
});


function reduceSafe(s: GameState, a: GameAction): GameState {
  const res = reduce(s, a);
  return res.ok ? res.state : s;
}
