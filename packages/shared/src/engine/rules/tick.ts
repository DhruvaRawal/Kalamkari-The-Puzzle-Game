import type { GameState, PlayerId } from '../../model/types';
import { appendLog, findPlayer, updatePlayer } from '../util';
import { closeAuction } from './bid';
import { finishTurn } from './turn';

/** TICK: close an expired auction, then auto-end a timed-out turn. */
export function applyTick(state: GameState, now: number): GameState {
  if (state.phase !== 'playing') return state;
  let s = state;
  if (s.auction && now >= s.auction.endsAt) s = closeAuction(s, now);
  if (s.phase === 'playing' && !s.auction && s.turn.deadline !== null && now >= s.turn.deadline) {
    s = finishTurn(s, now, true);
  }
  return s;
}

/** Earliest time a TICK would change anything, or null. */
export function nextDeadline(state: GameState): number | null {
  if (state.phase !== 'playing') return null;
  if (state.auction) return state.auction.endsAt;
  return state.turn.deadline;
}

/** SET_CONNECTED: track presence; a disconnected active player gets a shorter clock. */
export function applyConnection(state: GameState, playerId: PlayerId, connected: boolean, now: number): GameState {
  const player = findPlayer(state, playerId);
  if (!player || player.connected === connected) return state;
  let s = updatePlayer(state, playerId, (p) => ({ ...p, connected }));
  s = appendLog(s, { kind: 'connection', at: now, playerId, connected });
  const active = s.turn.playerId === playerId && s.turn.deadline !== null;
  if (active && !connected) {
    const short = Math.min(s.turn.deadline!, now + s.config.disconnectedTurnTimeoutMs);
    s = { ...s, turn: { ...s.turn, deadline: short, restoreDeadline: s.turn.restoreDeadline ?? s.turn.deadline } };
  } else if (active && connected && s.turn.restoreDeadline) {
    s = { ...s, turn: { ...s.turn, deadline: Math.max(s.turn.deadline!, s.turn.restoreDeadline), restoreDeadline: null } };
  }
  return s;
}
