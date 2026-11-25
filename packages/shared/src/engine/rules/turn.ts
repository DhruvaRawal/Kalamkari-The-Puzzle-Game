import type { GameState, PlayerId } from '../../model/types';
import { type ErrorCode } from '../errors';
import { appendLog, findPlayer } from '../util';
import { endGame, resolveStalemateWinners } from './win';

/** Facts shared by every "active player" action. */
export interface TurnFacts {
  ended: boolean;
  isTurn: boolean;
  auctionOpen: boolean;
}

export function turnBlockReason(f: TurnFacts): ErrorCode | null {
  if (f.ended) return 'GAME_ENDED';
  if (!f.isTurn) return 'NOT_YOUR_TURN';
  if (f.auctionOpen) return 'AUCTION_OPEN';
  return null;
}

export const turnFacts = (state: GameState, playerId: PlayerId): TurnFacts => ({
  ended: state.phase !== 'playing',
  isTurn: state.turn.playerId === playerId,
  auctionOpen: state.auction !== null,
});

export function turnDeadline(state: GameState, playerId: PlayerId, now: number): number {
  const connected = findPlayer(state, playerId)?.connected ?? true;
  return now + (connected ? state.config.turnTimeoutMs : state.config.disconnectedTurnTimeoutMs);
}

export function startTurn(state: GameState, playerId: PlayerId, now: number): GameState {
  const next: GameState = {
    ...state,
    turn: { playerId, number: state.turn.number + 1, bought: false, sold: false, deadline: turnDeadline(state, playerId, now), restoreDeadline: null },
  };
  return appendLog(next, { kind: 'turn', at: now, playerId });
}

/** Restarts the active player's clock (e.g. when the turn comes back after their auction). */
export const resumeTurn = (state: GameState, now: number): GameState => ({
  ...state,
  turn: { ...state.turn, deadline: turnDeadline(state, state.turn.playerId, now) },
});

/**
 * Finishes the active player's turn. A turn with no buy and no sell is a pass; consecutive passes
 * while the pool is empty, one per player, end the game in a stalemate.
 */
export function finishTurn(state: GameState, now: number, timedOut = false): GameState {
  const { playerId, bought, sold } = state.turn;
  let s = state;
  if (!bought && !sold) {
    s = appendLog(s, { kind: 'pass', at: now, playerId, timedOut });
    s = { ...s, emptyPoolPasses: s.bank.pool.length === 0 ? s.emptyPoolPasses + 1 : 0 };
    if (s.emptyPoolPasses >= s.players.length) {
      return endGame(s, 'stalemate', resolveStalemateWinners(s.players), now);
    }
  } else {
    s = { ...s, emptyPoolPasses: 0 };
  }
  const idx = s.players.findIndex((p) => p.id === playerId);
  const nextPlayer = s.players[(idx + 1) % s.players.length];
  return startTurn(s, nextPlayer.id, now);
}

/** After an action: if the player has used both Buy and Sell (and no auction is pending), move on. */
export function maybeAutoFinish(state: GameState, now: number): GameState {
  if (state.phase !== 'playing' || state.auction) return state;
  return state.turn.bought && state.turn.sold ? finishTurn(state, now) : state;
}
