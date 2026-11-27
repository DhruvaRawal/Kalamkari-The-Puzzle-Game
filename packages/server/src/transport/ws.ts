import type { Server } from 'node:http';
import { MAX_MESSAGE_BYTES, parseClientMessage, WS_PATH, type ServerMessage } from '@kalamkari/shared';
import { WebSocket, WebSocketServer } from 'ws';
import { isRoomError, type Connection, type Member, type Room, type RoomError } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';

const RATE_PER_SEC = 25;

/** Maps sockets to room members and routes validated messages to rooms. */
export function attachWebSockets(server: Server, rooms: RoomManager): WebSocketServer {
  const wss = new WebSocketServer({ server, path: WS_PATH, maxPayload: MAX_MESSAGE_BYTES });

  wss.on('connection', (ws) => {
    let room: Room | null = null;
    let memberId: string | null = null;
    let tokens = RATE_PER_SEC;
    let lastRefill = Date.now();

    const conn: Connection = {
      send(msg: ServerMessage) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      },
    };
    const fail = (code: string, message: string, reqId?: number) => conn.send({ t: 'error', code, message, reqId });
    const bind = (r: Room, result: Member | RoomError) => {
      if (isRoomError(result)) return fail(result.code, result.message);
      if (room && memberId && room !== r) room.leave(memberId);
      room = r;
      memberId = result.id;
    };

    ws.on('message', (data) => {
      const now = Date.now();
      tokens = Math.min(RATE_PER_SEC, tokens + ((now - lastRefill) / 1000) * RATE_PER_SEC);
      lastRefill = now;
      if (tokens < 1) return fail('RATE_LIMITED', 'Slow down a little.');
      tokens -= 1;

      const msg = parseClientMessage(String(data));
      if (!msg) return fail('BAD_MESSAGE', 'Malformed message.');

      switch (msg.t) {
        case 'ping':
          return conn.send({ t: 'pong', serverNow: now });
        case 'create': {
          const r = rooms.create();
          const joined = r.join(msg.name, conn);
          bind(r, joined);
          if (memberId && msg.settings) r.updateSettings(memberId, msg.settings);
          return;
        }
        case 'join': {
          const r = rooms.get(msg.code);
          if (!r) return fail('ROOM_NOT_FOUND', `No room with code ${msg.code}.`);
          return bind(r, r.join(msg.name, conn));
        }
        case 'resume': {
          const r = rooms.get(msg.code);
          if (!r) return fail('ROOM_NOT_FOUND', 'That room has closed.');
          return bind(r, r.resume(msg.token, conn));
        }
      }

      if (!room || !memberId) return fail('NOT_IN_ROOM', 'Join a room first.');
      switch (msg.t) {
        case 'settings': {
          const e = room.updateSettings(memberId, msg.settings);
          return e ? fail(e.code, e.message) : undefined;
        }
        case 'start': {
          const e = room.start(memberId);
          return e ? fail(e.code, e.message) : undefined;
        }
        case 'addBot':
        case 'removeBot':
        case 'botLevel': {
          const e =
            msg.t === 'addBot'
              ? room.addBot(memberId)
              : msg.t === 'removeBot'
                ? room.removeBot(memberId, msg.id)
                : room.setBotLevel(memberId, msg.id, msg.level);
          return e ? fail(e.code, e.message) : undefined;
        }
        case 'leave':
          room.leave(memberId);
          room = null;
          memberId = null;
          return;
        case 'action':
          return room.act(memberId, msg.action, msg.reqId);
      }
    });

    ws.on('close', () => {
      if (room && memberId) room.detach(memberId, conn);
    });
  });

  return wss;
}
