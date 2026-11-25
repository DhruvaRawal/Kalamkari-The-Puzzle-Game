import { nextInt } from './rng';
import type { GameState, LogEntry, PieceId, PlayerId, PlayerState, Rotation } from '../model/types';

export const findPlayer = (state: GameState, id: PlayerId): PlayerState | undefined =>
  state.players.find((p) => p.id === id);

export function updatePlayer(state: GameState, id: PlayerId, fn: (p: PlayerState) => PlayerState): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? fn(p) : p)) };
}

export const appendLog = (state: GameState, entry: LogEntry): GameState => ({
  ...state,
  log: [...state.log, entry].slice(-state.config.logLimit),
});

/** A rotation for a piece entering a hand (random if configured). */
export function drawRotation(state: GameState): [Rotation, GameState] {
  if (!state.config.randomInitialRotation) return [0, state];
  const [r, rng] = nextInt(state.rng, 4);
  return [r as Rotation, { ...state, rng }];
}

/** Moves a piece into a player's hand with a fresh rotation. */
export function giveToHand(state: GameState, playerId: PlayerId, pieceId: PieceId): GameState {
  const [rotation, s] = drawRotation(state);
  const next = updatePlayer(s, playerId, (p) => ({ ...p, hand: [...p.hand, pieceId] }));
  return { ...next, rotations: { ...next.rotations, [pieceId]: rotation } };
}

/** Removes a piece from a player's hand (and forgets its rotation). */
export function takeFromHand(state: GameState, playerId: PlayerId, pieceId: PieceId): GameState {
  const next = updatePlayer(state, playerId, (p) => ({ ...p, hand: p.hand.filter((id) => id !== pieceId) }));
  const { [pieceId]: _dropped, ...rotations } = next.rotations;
  return { ...next, rotations };
}
