import type { GameState, PlayerId } from '../../model/types';
import { gameError, type ErrorCode, type GameError } from '../errors';
import { finishTurn, turnBlockReason, turnFacts, type TurnFacts } from './turn';

/** END_TURN: finishes the turn. Without a buy or sell it is a pass. */
export const endTurnBlockReason = (f: TurnFacts): ErrorCode | null => turnBlockReason(f);

export function applyEndTurn(state: GameState, playerId: PlayerId, now: number): GameState | GameError {
  const blocked = endTurnBlockReason(turnFacts(state, playerId));
  if (blocked) return gameError(blocked);
  return finishTurn(state, now);
}
