import type { GameState, PlayerId, PlayerView } from '../model/types';
import type { ClientAction, GameAction } from '../protocol/actions';
import { parsePlayerAction } from '../protocol/actions';
import { gameError } from './errors';
import { projectStateFor } from './projection';
import { reduce, type ReduceResult } from './reducer';
import { nextDeadline } from './rules/tick';

/**
 * Wraps the engine with the bookkeeping every host needs (current state, timers, projection).
 * Used by the server's rooms and by the client's LocalTransport. Hosts add only I/O and setTimeout.
 */
export class GameHost {
  constructor(private current: GameState) {}

  get state(): GameState {
    return this.current;
  }

  /** Applies an untrusted client action on behalf of `playerId` with the host's clock. */
  submit(playerId: PlayerId, input: ClientAction | unknown, now: number): ReduceResult {
    const action = parsePlayerAction(input);
    if (!action) return { ok: false, error: gameError('UNKNOWN_ACTION') };
    return this.dispatch({ ...action, playerId, now } as GameAction);
  }

  /** Applies a trusted action (system actions or pre-stamped player actions). */
  dispatch(action: GameAction): ReduceResult {
    const res = reduce(this.current, action);
    if (res.ok) this.current = res.state;
    return res;
  }

  /** Runs due timers. Returns true if anything changed. */
  tick(now: number): boolean {
    const before = this.current.version;
    this.dispatch({ type: 'TICK', now });
    return this.current.version !== before;
  }

  nextDeadline(): number | null {
    return nextDeadline(this.current);
  }

  setConnected(playerId: PlayerId, connected: boolean, now: number): boolean {
    const before = this.current.version;
    this.dispatch({ type: 'SET_CONNECTED', playerId, connected, now });
    return this.current.version !== before;
  }

  viewFor(playerId: PlayerId | null): PlayerView {
    return projectStateFor(this.current, playerId);
  }
}
