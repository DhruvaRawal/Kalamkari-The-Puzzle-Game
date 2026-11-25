import type { ClientAction, LobbyInfo, PlayerId, PlayerView } from '@kalamkari/shared';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export type TransportEvent =
  /** A fresh projection for the current viewer. `serverNow` lets the client correct clock skew. */
  | { type: 'view'; view: PlayerView; serverNow: number }
  | { type: 'lobby'; lobby: LobbyInfo }
  | { type: 'error'; code: string; message: string }
  | { type: 'status'; status: ConnectionStatus }
  /** The device must change hands before the next private view is shown (privacy curtain). */
  | { type: 'handoff'; toPlayerId: PlayerId; name: string };

/**
 * What the game UI talks to. It must not care whether the host is in-memory (hotseat) or remote.
 * `kind` exists for labels only and must never drive game logic.
 */
export interface Transport {
  readonly kind: 'local' | 'online';
  /** Seats this device may act for: every seat in hotseat, just mine online. */
  controllablePlayers(): PlayerId[];
  dispatch(action: ClientAction): void;
  subscribe(listener: (ev: TransportEvent) => void): () => void;
  /** Dismisses a pending handoff (no-op for transports that never emit one). */
  acknowledgeHandoff(): void;
  dispose(): void;
}

/** Shared listener bookkeeping for transports. */
export class Emitter {
  private listeners = new Set<(ev: TransportEvent) => void>();
  on(fn: (ev: TransportEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(ev: TransportEvent): void {
    this.listeners.forEach((l) => l(ev));
  }
}
