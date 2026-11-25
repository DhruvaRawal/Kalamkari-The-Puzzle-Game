import type { GameResult, GameState, PlayerId, PlayerState } from '../../model/types';
import { appendLog } from '../util';

export const piecesPerDesign = (state: GameState) => state.config.grid.rows * state.config.grid.cols;

export const isComplete = (state: GameState, p: PlayerState) => p.fixed.length >= piecesPerDesign(state);

/** All ids sharing the top score. */
function topBy(players: PlayerState[], score: (p: PlayerState) => number): PlayerId[] {
  const best = Math.max(...players.map(score));
  return players.filter((p) => score(p) === best).map((p) => p.id);
}

/**
 * Winners among completed players: the one with the most coins; equal coins share the win.
 * Exported separately so simultaneous completion is testable even though the engine is serial.
 */
export const resolveCompletionWinners = (completed: PlayerState[]): PlayerId[] => topBy(completed, (p) => p.coins);

/** Stalemate: most fixed pieces wins; ties share. */
export const resolveStalemateWinners = (players: PlayerState[]): PlayerId[] => topBy(players, (p) => p.fixed.length);

export function endGame(state: GameState, reason: GameResult['reason'], winners: PlayerId[], now: number): GameState {
  // An auction can't outlive the game: its piece goes back to the pool untouched.
  const bank = state.auction ? { ...state.bank, pool: [...state.bank.pool, state.auction.pieceId] } : state.bank;
  const ended: GameState = {
    ...state,
    bank,
    auction: null,
    phase: 'ended',
    turn: { ...state.turn, deadline: null },
    result: {
      reason,
      winners,
      standings: state.players.map((p) => ({ playerId: p.id, fixedCount: p.fixed.length, coins: p.coins })),
    },
  };
  return appendLog(ended, { kind: 'end', at: now, reason, winners });
}

/** Ends the game if anyone has completed their design. */
export function checkCompletion(state: GameState, now: number): GameState {
  if (state.phase !== 'playing') return state;
  const completed = state.players.filter((p) => isComplete(state, p));
  if (completed.length === 0) return state;
  return endGame(state, 'completed', resolveCompletionWinners(completed), now);
}
