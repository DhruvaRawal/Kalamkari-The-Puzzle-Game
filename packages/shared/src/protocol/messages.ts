import { isBotLevel, type BotLevel } from '../bot/bot';
import type { GameSettings } from '../config/gameConfig';
import type { PlayerId, PlayerView } from '../model/types';
import type { PlayerAction } from './actions';

/** WebSocket path served by the server and proxied by Vite in dev. */
export const WS_PATH = '/ws';
export const MAX_MESSAGE_BYTES = 4096;

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Set for computer players: their difficulty. */
  bot?: BotLevel;
}

export interface LobbyInfo {
  code: string;
  hostId: PlayerId;
  players: LobbyPlayer[];
  settings: GameSettings;
  started: boolean;
  maxPlayers: number;
  minPlayers: number;
}

export type ClientMessage =
  | { t: 'create'; name: string; settings?: GameSettings }
  | { t: 'join'; code: string; name: string }
  | { t: 'resume'; code: string; token: string }
  | { t: 'settings'; settings: GameSettings }
  | { t: 'addBot' }
  | { t: 'removeBot'; id: PlayerId }
  | { t: 'botLevel'; id: PlayerId; level: BotLevel }
  | { t: 'start' }
  | { t: 'leave' }
  | { t: 'action'; action: PlayerAction; reqId?: number }
  | { t: 'ping' };

export type ServerMessage =
  | { t: 'welcome'; code: string; playerId: PlayerId; token: string }
  | { t: 'lobby'; lobby: LobbyInfo }
  | { t: 'state'; view: PlayerView; serverNow: number }
  | { t: 'error'; code: string; message: string; reqId?: number }
  | { t: 'pong'; serverNow: number };

/** Shape-checks an untrusted client message. Field-level validation happens in the handlers. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return null;
  const m = msg as Record<string, unknown>;
  const s = (v: unknown, max = 64) => typeof v === 'string' && v.length <= max;
  switch (m.t) {
    case 'create':
      return s(m.name) ? (m as ClientMessage) : null;
    case 'join':
      return s(m.code, 8) && s(m.name) ? (m as ClientMessage) : null;
    case 'resume':
      return s(m.code, 8) && s(m.token, 128) ? (m as ClientMessage) : null;
    case 'settings':
      return typeof m.settings === 'object' && m.settings !== null ? (m as ClientMessage) : null;
    case 'removeBot':
      return s(m.id, 16) ? { t: 'removeBot', id: m.id as string } : null;
    case 'botLevel':
      return s(m.id, 16) && isBotLevel(m.level) ? { t: 'botLevel', id: m.id as string, level: m.level } : null;
    case 'addBot':
    case 'start':
    case 'leave':
    case 'ping':
      return { t: m.t } as ClientMessage;
    case 'action':
      return typeof m.action === 'object' && m.action !== null ? (m as ClientMessage) : null;
    default:
      return null;
  }
}
