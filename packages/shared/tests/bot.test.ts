import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, botThinkMs, chanceLotIsNeeded, chooseBotAction, type BotLevel } from '../src/bot/bot';
import { createRng, nextFloat } from '../src/engine/rng';
import { GameHost } from '../src/engine/host';
import type { GameState } from '../src/model/types';
import type { GameAction } from '../src/protocol/actions';
import { act, current, newGame, T0, totals, expectedTotals } from './helpers';

/** Plays a whole game between bots, with real pauses and timers. Throws if a bot makes an illegal move. */
function playBots(levels: BotLevel[], seed: number): GameState {
  const res = newGame(levels.length, { seed });
  const host = new GameHost(res);
  let rng = createRng(seed);
  const random = () => {
    const [v, next] = nextFloat(rng);
    rng = next;
    return v;
  };
  const ids = host.state.players.map((p) => p.id);
  const nextAt = new Map(ids.map((id) => [id, T0]));
  let now = T0;
  while (host.state.phase === 'playing' && now < T0 + 6 * 3_600_000) {
    now += 250;
    host.tick(now);
    ids.forEach((id, i) => {
      if (host.state.phase !== 'playing' || now < nextAt.get(id)!) return;
      const action = chooseBotAction(host.viewFor(id), now, levels[i], random);
      if (!action) return;
      const r = host.submit(id, action, now);
      if (!r.ok) throw new Error(`${levels[i]} bot tried ${JSON.stringify(action)}: ${r.error.code}`);
      nextAt.set(id, now + botThinkMs(levels[i], random));
    });
    expect(totals(host.state)).toEqual(expectedTotals(host.state));
  }
  return host.state;
}

describe('bots', () => {
  it.each([2, 3, 4])('finish a %i-bot game with only legal moves', (n) => {
    for (const seed of [1, 2, 3]) {
      const levels = Array.from({ length: n }, (_, i) => BOT_LEVELS[(i + seed) % 3]);
      const end = playBots(levels, seed);
      expect(end.phase).toBe('ended');
      expect(end.result!.winners.length).toBeGreaterThan(0);
    }
  });

  /** Wins for each side over 20 two-player games, swapping seats each game. */
  function headToHead(a: BotLevel, b: BotLevel) {
    const wins = { [a]: 0, [b]: 0 } as Record<BotLevel, number>;
    for (let seed = 1; seed <= 20; seed++) {
      const levels: BotLevel[] = seed % 2 ? [a, b] : [b, a];
      const end = playBots(levels, seed);
      for (const w of end.result!.winners) wins[levels[end.players.findIndex((p) => p.id === w)]] += 1 / end.result!.winners.length;
    }
    return wins;
  }

  it('hard beats medium, and medium beats easy, most of the time', () => {
    const hm = headToHead('hard', 'medium');
    expect(hm.hard).toBeGreaterThan(hm.medium * 2);
    const me = headToHead('medium', 'easy');
    expect(me.medium).toBeGreaterThan(me.easy * 2);
  });

  it('rotates, then fixes, a piece of its own design', () => {
    let s = newGame(2);
    // Off-turn, so fixing pieces is all it has to do.
    const me = s.players.find((p) => p.id !== current(s))!;
    const own = me.hand.find((id) => id.startsWith(`${me.designId}:`));
    expect(own).toBeDefined();
    s = act(s, { type: 'ROTATE', playerId: me.id, pieceId: own!, rotation: 2, now: T0 });
    const first = chooseBotAction(new GameHost(s).viewFor(me.id), T0, 'hard');
    expect(first).toEqual({ type: 'ROTATE', pieceId: own, rotation: 0 });
    s = act(s, { ...first!, playerId: me.id, now: T0 } as GameAction);
    const next = chooseBotAction(new GameHost(s).viewFor(me.id), T0, 'hard');
    expect(next).toMatchObject({ type: 'PLACE', pieceId: own });
    s = act(s, { ...next!, playerId: me.id, now: T0 } as GameAction);
    expect(s.players.find((p) => p.id === me.id)!.fixed).toContain(own);
  });

  it('never bids on its own lot and stays within its coins', () => {
    let s = newGame(2);
    const seller = current(s);
    const other = s.players.find((p) => p.id !== seller)!.id;
    s = act(s, { type: 'SELL', playerId: seller, pieceId: s.players.find((p) => p.id === seller)!.hand[0], now: T0 });
    const host = new GameHost(s);
    expect(chooseBotAction({ ...host.viewFor(seller), me: { ...host.viewFor(seller).me!, hand: [] } }, T0, 'hard')).toBeNull();
    const poor = { ...s, players: s.players.map((p) => (p.id === other ? { ...p, coins: 0 } : p)) };
    const view = new GameHost(poor).viewFor(other);
    expect(chooseBotAction({ ...view, me: { ...view.me!, hand: [] } }, T0, 'hard')).toBeNull();
  });

  it('estimates the lot from what it can see', () => {
    const s = newGame(2);
    const view = new GameHost(s).viewFor(current(s));
    for (const c of ['corner', 'edge', 'center'] as const) {
      const p = chanceLotIsNeeded(view, c);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});
