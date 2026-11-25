import { parsePieceId, placeBlockReason } from '../../model/piece';
import type { GameState, PieceId, PlayerId, Rotation } from '../../model/types';
import { gameError, type GameError } from '../errors';
import { appendLog, findPlayer, takeFromHand, updatePlayer } from '../util';
import { checkCompletion } from './win';

/** PLACE: drop a held piece on a slot of your own board. Allowed any time, even off-turn. */
export function applyPlace(
  state: GameState,
  playerId: PlayerId,
  pieceId: PieceId,
  row: number,
  col: number,
  now: number,
): GameState | GameError {
  if (state.phase !== 'playing') return gameError('GAME_ENDED');
  const player = findPlayer(state, playerId);
  if (!player) return gameError('UNKNOWN_PLAYER');
  if (player.fixed.includes(pieceId)) return gameError('PIECE_FIXED');
  if (!player.hand.includes(pieceId)) return gameError('NOT_IN_HAND');
  const { rows, cols } = state.config.grid;
  if (row < 0 || col < 0 || row >= rows || col >= cols) return gameError('OUT_OF_BOUNDS');

  const blocked = placeBlockReason({
    ownerDesignId: player.designId,
    piece: parsePieceId(pieceId),
    rotation: state.rotations[pieceId] ?? 0,
    slot: { row, col },
    fixed: player.fixed.map(parsePieceId),
  });
  if (blocked) return gameError(blocked);

  let s = takeFromHand(state, playerId, pieceId);
  s = updatePlayer(s, playerId, (p) => ({ ...p, fixed: [...p.fixed, pieceId] }));
  s = appendLog(s, { kind: 'fixed', at: now, playerId });
  return checkCompletion(s, now);
}

/** ROTATE: set the rotation of one of your unfixed pieces. */
export function applyRotate(state: GameState, playerId: PlayerId, pieceId: PieceId, rotation: Rotation): GameState | GameError {
  if (state.phase !== 'playing') return gameError('GAME_ENDED');
  const player = findPlayer(state, playerId);
  if (!player) return gameError('UNKNOWN_PLAYER');
  if (player.fixed.includes(pieceId)) return gameError('PIECE_FIXED');
  if (!player.hand.includes(pieceId)) return gameError('NOT_IN_HAND');
  return { ...state, rotations: { ...state.rotations, [pieceId]: rotation } };
}
