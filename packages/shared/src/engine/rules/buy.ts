import type { GameState, PlayerId } from '../../model/types';
import { gameError, type ErrorCode, type GameError } from '../errors';
import { nextInt } from '../rng';
import { appendLog, findPlayer, giveToHand, updatePlayer } from '../util';
import { maybeAutoFinish, turnBlockReason, turnFacts, type TurnFacts } from './turn';

export interface BuyFacts extends TurnFacts {
  bought: boolean;
  coins: number;
  price: number;
  poolCount: number;
}

export function buyBlockReason(f: BuyFacts): ErrorCode | null {
  return (
    turnBlockReason(f) ??
    (f.bought ? 'ALREADY_BOUGHT' : null) ??
    (f.poolCount <= 0 ? 'POOL_EMPTY' : null) ??
    (f.coins < f.price ? 'INSUFFICIENT_COINS' : null)
  );
}

export function applyBuy(state: GameState, playerId: PlayerId, now: number): GameState | GameError {
  const player = findPlayer(state, playerId);
  if (!player) return gameError('UNKNOWN_PLAYER');
  const price = state.config.buyPrice;
  const blocked = buyBlockReason({
    ...turnFacts(state, playerId),
    bought: state.turn.bought,
    coins: player.coins,
    price,
    poolCount: state.bank.pool.length,
  });
  if (blocked) return gameError(blocked);

  const [index, rng] = nextInt(state.rng, state.bank.pool.length);
  const pieceId = state.bank.pool[index];
  let s: GameState = {
    ...state,
    rng,
    bank: { coins: state.bank.coins + price, pool: state.bank.pool.filter((_, i) => i !== index) },
    turn: { ...state.turn, bought: true },
  };
  s = updatePlayer(s, playerId, (p) => ({ ...p, coins: p.coins - price }));
  s = giveToHand(s, playerId, pieceId);
  s = appendLog(s, { kind: 'buy', at: now, playerId });
  return maybeAutoFinish(s, now);
}
