import { createGame, type CreateGameOptions } from '../src/engine/createGame';
import { reduce } from '../src/engine/reducer';
import { parsePieceId } from '../src/model/piece';
import type { GameState, PieceId, PlayerId } from '../src/model/types';
import type { GameAction } from '../src/protocol/actions';

export const T0 = 1_000_000;

export function newGame(n = 4, opts: Partial<CreateGameOptions> = {}): GameState {
  const res = createGame({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })),
    seed: 42,
    now: T0,
    ...opts,
  });
  if (!res.ok) throw new Error(res.error.detail);
  return res.state;
}

/** Applies an action and asserts success. */
export function act(state: GameState, action: GameAction): GameState {
  const res = reduce(state, action);
  if (!res.ok) throw new Error(`${action.type} failed: ${res.error.code}`);
  return res.state;
}

export function expectError(state: GameState, action: GameAction): string {
  const res = reduce(state, action);
  if (res.ok) throw new Error(`${action.type} unexpectedly succeeded`);
  return res.error.code;
}

export const current = (s: GameState): PlayerId => s.turn.playerId;
export const player = (s: GameState, id: PlayerId) => s.players.find((p) => p.id === id)!;
export const others = (s: GameState, id: PlayerId) => s.players.filter((p) => p.id !== id).map((p) => p.id);

/** What totals() must always equal for this game: n × starting coins + bank coins, n designs of pieces. */
export function expectedTotals(s: GameState) {
  const n = s.players.length;
  return {
    coins: n * s.config.startingCoins + s.config.bankStartingCoins,
    pieces: n * s.config.grid.rows * s.config.grid.cols,
  };
}

/** Total coins / pieces across players, bank and open auction (must be conserved). */
export function totals(s: GameState) {
  const coins = s.bank.coins + s.players.reduce((a, p) => a + p.coins, 0);
  const pieces = s.bank.pool.length + s.players.reduce((a, p) => a + p.hand.length + p.fixed.length, 0) + (s.auction ? 1 : 0);
  return { coins, pieces };
}

/** Moves a specific piece into a player's hand directly (test setup only). */
export function forceIntoHand(s: GameState, playerId: PlayerId, pieceId: PieceId, rotation: 0 | 1 | 2 | 3 = 0): GameState {
  const strip = (ids: PieceId[]) => ids.filter((id) => id !== pieceId);
  return {
    ...s,
    bank: { ...s.bank, pool: strip(s.bank.pool) },
    players: s.players.map((p) =>
      p.id === playerId ? { ...p, hand: [...strip(p.hand), pieceId] } : { ...p, hand: strip(p.hand) },
    ),
    rotations: { ...s.rotations, [pieceId]: rotation },
  };
}

/** Gives a player every piece of their own design upright, except those listed. */
export function giveOwnDesign(s: GameState, playerId: PlayerId): GameState {
  const p = player(s, playerId);
  const { rows, cols } = s.config.grid;
  let next = s;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    next = forceIntoHand(next, playerId, `${p.designId}:${row}:${col}`, 0);
  }
  return next;
}

export const refOf = parsePieceId;
