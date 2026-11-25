import {
  createGame,
  GameHost,
  randomSeed,
  type ClientAction,
  type GameSettings,
  type PlayerId,
} from '@kalamkari/shared';
import { Emitter, type Transport, type TransportEvent } from './Transport';

/**
 * Hotseat: the authoritative GameHost runs in memory. Only the active player's private view is ever
 * emitted; when the turn moves to someone else the transport emits a spectator view plus a
 * `handoff`, and waits for acknowledgeHandoff() before revealing the next player's board.
 */
export class LocalTransport implements Transport {
  readonly kind = 'local' as const;
  private readonly host: GameHost;
  private readonly events = new Emitter();
  private viewer: PlayerId | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(names: string[], settings: GameSettings = {}, seed = randomSeed()) {
    const res = createGame({
      players: names.map((name, i) => ({ id: `p${i + 1}`, name: name || `Player ${i + 1}` })),
      seed,
      now: Date.now(),
      config: settings,
    });
    if (!res.ok) throw new Error(res.error.detail);
    this.host = new GameHost(res.state);
    this.schedule();
  }

  controllablePlayers(): PlayerId[] {
    return this.host.state.players.map((p) => p.id);
  }

  subscribe(listener: (ev: TransportEvent) => void): () => void {
    const off = this.events.on(listener);
    listener({ type: 'status', status: 'online' });
    this.publish(listener);
    return off;
  }

  dispatch(action: ClientAction): void {
    const actor = action.playerId ?? this.viewer;
    if (!actor) return;
    const res = this.host.submit(actor, action, Date.now());
    if (!res.ok) {
      this.events.emit({ type: 'error', code: res.error.code, message: res.error.message });
      return;
    }
    this.changed();
  }

  acknowledgeHandoff(): void {
    this.viewer = this.host.state.turn.playerId;
    this.publish();
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private changed(): void {
    this.schedule();
    this.publish();
  }

  /** Emits either the viewer's private view or, if the device must change hands, a curtain. */
  private publish(target: (ev: TransportEvent) => void = (ev) => this.events.emit(ev)): void {
    const { state } = this.host;
    const now = Date.now();
    const active = state.turn.playerId;
    if (state.phase === 'playing' && this.viewer !== active) {
      const name = state.players.find((p) => p.id === active)?.name ?? '';
      target({ type: 'view', view: this.host.viewFor(null), serverNow: now });
      target({ type: 'handoff', toPlayerId: active, name });
      return;
    }
    target({ type: 'view', view: this.host.viewFor(this.viewer), serverNow: now });
  }

  /** One timer for the host's next deadline (auction close or turn timeout). */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    const due = this.host.nextDeadline();
    if (due === null) return;
    this.timer = setTimeout(() => {
      if (this.host.tick(Date.now())) this.changed();
      else this.schedule();
    }, Math.max(0, due - Date.now()) + 20);
  }
}
