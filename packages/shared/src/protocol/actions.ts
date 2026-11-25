import type { PieceId, PlayerId, Rotation } from '../model/types';

/** Actions a player may send. `playerId` and `now` are stamped by the host, never trusted. */
export type PlayerAction =
  | { type: 'BUY' }
  | { type: 'SELL'; pieceId: PieceId }
  | { type: 'BID'; amount: number }
  | { type: 'END_TURN' }
  | { type: 'ROTATE'; pieceId: PieceId; rotation: Rotation }
  | { type: 'PLACE'; pieceId: PieceId; row: number; col: number };

/** What a client hands to its transport. Local hotseat may act for any seat, hence optional playerId. */
export type ClientAction = PlayerAction & { playerId?: PlayerId };

/** Actions only a host may issue. */
export type SystemAction =
  | { type: 'TICK' }
  | { type: 'SET_CONNECTED'; playerId: PlayerId; connected: boolean };

/** What the reducer consumes. */
export type GameAction = ((PlayerAction & { playerId: PlayerId }) | SystemAction) & { now: number };

export const PLAYER_ACTION_TYPES = ['BUY', 'SELL', 'BID', 'END_TURN', 'ROTATE', 'PLACE'] as const;

/** Narrow untrusted input to a PlayerAction (shape only; rules do the semantic checks). */
export function parsePlayerAction(input: unknown): PlayerAction | null {
  if (!input || typeof input !== 'object') return null;
  const a = input as Record<string, unknown>;
  const str = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 64;
  const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
  switch (a.type) {
    case 'BUY':
    case 'END_TURN':
      return { type: a.type };
    case 'SELL':
      return str(a.pieceId) ? { type: 'SELL', pieceId: a.pieceId as string } : null;
    case 'BID':
      return int(a.amount) ? { type: 'BID', amount: a.amount as number } : null;
    case 'ROTATE':
      return str(a.pieceId) && int(a.rotation) && (a.rotation as number) >= 0 && (a.rotation as number) <= 3
        ? { type: 'ROTATE', pieceId: a.pieceId as string, rotation: a.rotation as Rotation }
        : null;
    case 'PLACE':
      return str(a.pieceId) && int(a.row) && int(a.col)
        ? { type: 'PLACE', pieceId: a.pieceId as string, row: a.row as number, col: a.col as number }
        : null;
    default:
      return null;
  }
}
