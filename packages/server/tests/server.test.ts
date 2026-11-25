import type { PlayerView, ServerMessage } from '@kalamkari/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer, type RunningServer } from '../src/app';

let server: RunningServer;
beforeAll(async () => {
  server = await startServer({ port: 0, staticDir: '/nonexistent' });
});
afterAll(() => server.close());

/** A scripted client that records every server message. */
class Client {
  ws: WebSocket;
  messages: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  ready: Promise<void>;

  constructor() {
    this.ws = new WebSocket(`ws://localhost:${server.port}/ws`);
    this.ready = new Promise((r) => this.ws.once('open', () => r()));
    this.ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      this.messages.push(msg);
      this.waiters = this.waiters.filter((w) => (w.pred(msg) ? (w.resolve(msg), false) : true));
    });
  }
  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }
  next<T extends ServerMessage['t']>(t: T, pred: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
    return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${t}`)), 3000);
      this.waiters.push({
        pred: (m) => m.t === t && pred(m as Extract<ServerMessage, { t: T }>),
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { t: T }>);
        },
      });
    });
  }
  lastView(): PlayerView {
    const states = this.messages.filter((m): m is Extract<ServerMessage, { t: 'state' }> => m.t === 'state');
    return states[states.length - 1].view;
  }
  close() {
    this.ws.close();
  }
}

async function setupGame() {
  const a = new Client();
  const b = new Client();
  await Promise.all([a.ready, b.ready]);
  const welcomeA = a.next('welcome');
  a.send({ t: 'create', name: 'Asha', settings: { turnTimeoutMs: 60_000 } });
  const wa = await welcomeA;
  const welcomeB = b.next('welcome');
  b.send({ t: 'join', code: wa.code.toLowerCase(), name: 'Bala' });
  const wb = await welcomeB;
  const started = Promise.all([a.next('state'), b.next('state')]);
  a.send({ t: 'start' });
  await started;
  return { a, b, wa, wb };
}

describe('rooms', () => {
  it('rejects unknown rooms, non-host start and joining after start', async () => {
    const c = new Client();
    await c.ready;
    const e1 = c.next('error');
    c.send({ t: 'join', code: 'ZZZZ', name: 'x' });
    expect((await e1).code).toBe('ROOM_NOT_FOUND');

    const { a, b, wa } = await setupGame();
    const e2 = c.next('error');
    c.send({ t: 'join', code: wa.code, name: 'late' });
    expect((await e2).code).toBe('ROOM_STARTED');
    const e3 = c.next('error');
    c.send({ t: 'garbage' });
    expect((await e3).code).toBe('BAD_MESSAGE');
    [a, b, c].forEach((x) => x.close());
  });

  it('sends each player only their own projection', async () => {
    const { a, b, wa, wb } = await setupGame();
    const va = a.lastView();
    const vb = b.lastView();
    expect(va.viewerId).toBe(wa.playerId);
    expect(vb.viewerId).toBe(wb.playerId);
    expect(va.me!.designId).not.toBe(vb.me!.designId);
    const rawA = JSON.stringify(a.messages);
    for (const h of vb.me!.hand) expect(rawA).not.toContain(h.id);
    // Outside A's own section (which may hold pieces of any design), B's design never appears.
    const publicA = JSON.stringify(a.messages.map((m) => (m.t === 'state' ? { ...m, view: { ...m.view, me: null } } : m)));
    expect(publicA).not.toContain(vb.me!.designId);
    expect(va.config.turnTimeoutMs).toBe(60_000);
    a.close();
    b.close();
  });

  it('applies actions as the socket’s own player only (no spoofing)', async () => {
    const { a, b, wa, wb } = await setupGame();
    const view = a.lastView();
    const [active, idle] = view.turn.playerId === wa.playerId ? [a, b] : [b, a];
    const idleId = view.turn.playerId === wa.playerId ? wb.playerId : wa.playerId;
    const err = idle.next('error');
    idle.send({ t: 'action', action: { type: 'BUY', playerId: view.turn.playerId } });
    expect((await err).code).toBe('NOT_YOUR_TURN');

    const updated = active.next('state', (m) => m.view.turn.bought);
    active.send({ t: 'action', action: { type: 'BUY' } });
    const v = (await updated).view;
    expect(v.me!.hand).toHaveLength(11);
    expect(v.players.find((p) => p.id === idleId)!.coins).toBe(10);
    a.close();
    b.close();
  });

  it('marks disconnects and lets a player resume their seat with the token', async () => {
    const { a, b, wa, wb } = await setupGame();
    const offline = a.next('state', (m) => m.view.players.some((p) => p.id === wb.playerId && !p.connected));
    b.close();
    await offline;

    const b2 = new Client();
    await b2.ready;
    const back = b2.next('state');
    b2.send({ t: 'resume', code: wa.code, token: wb.token });
    const v = (await back).view;
    expect(v.viewerId).toBe(wb.playerId);
    expect(v.me!.hand.length).toBe(10);
    const bad = b2.next('error');
    b2.send({ t: 'resume', code: wa.code, token: 'nope' });
    expect((await bad).code).toBe('BAD_SESSION');
    a.close();
    b2.close();
  });

  it('closes auctions on the server timer', async () => {
    const { a, b, wa } = await setupGame();
    const view = a.lastView();
    const seller = view.turn.playerId === wa.playerId ? a : b;
    const bidder = seller === a ? b : a;
    const sellerView = seller.lastView();
    const opened = bidder.next('state', (m) => m.view.auction !== null);
    seller.send({ t: 'action', action: { type: 'SELL', pieceId: sellerView.me!.hand[0].id } });
    const auctionView = (await opened).view;
    expect(JSON.stringify(auctionView)).not.toContain(sellerView.me!.hand[0].id);

    // Shorten the clock instead of waiting 15 s: rewind the auction end on the authoritative state.
    const room = (server.rooms as unknown as { rooms: Map<string, { game: { state: { auction: { endsAt: number } } }; tick(): void }> }).rooms.get(
      wa.code,
    )!;
    room.game.state.auction.endsAt = Date.now() - 1;
    const closed = bidder.next('state', (m) => m.view.auction === null);
    room.tick();
    const after = (await closed).view;
    expect(after.bank.poolCount).toBe(13); // 2 × 16 − 20 dealt + 1 unsold
    a.close();
    b.close();
  });
});
