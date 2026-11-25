import type { GameState } from '../model/types';
import type { GameAction } from '../protocol/actions';
import { gameError, type GameError } from './errors';
import { applyBid } from './rules/bid';
import { applyBuy } from './rules/buy';
import { applyEndTurn } from './rules/pass';
import { applyPlace, applyRotate } from './rules/place';
import { applySell } from './rules/sell';
import { applyConnection, applyTick } from './rules/tick';

export type ReduceResult = { ok: true; state: GameState } | { ok: false; error: GameError };

function route(state: GameState, a: GameAction): GameState | GameError {
  switch (a.type) {
    case 'BUY':
      return applyBuy(state, a.playerId, a.now);
    case 'SELL':
      return applySell(state, a.playerId, a.pieceId, a.now);
    case 'BID':
      return applyBid(state, a.playerId, a.amount, a.now);
    case 'END_TURN':
      return applyEndTurn(state, a.playerId, a.now);
    case 'ROTATE':
      return applyRotate(state, a.playerId, a.pieceId, a.rotation);
    case 'PLACE':
      return applyPlace(state, a.playerId, a.pieceId, a.row, a.col, a.now);
    case 'TICK':
      return applyTick(state, a.now);
    case 'SET_CONNECTED':
      return applyConnection(state, a.playerId, a.connected, a.now);
    default:
      return gameError('UNKNOWN_ACTION');
  }
}

const isError = (r: GameState | GameError): r is GameError => 'code' in r && 'message' in r;

/** The game engine: pure, deterministic, shared by server and client. */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  const result = route(state, action);
  if (isError(result)) return { ok: false, error: result };
  if (result === state) return { ok: true, state };
  return { ok: true, state: { ...result, version: state.version + 1 } };
}
