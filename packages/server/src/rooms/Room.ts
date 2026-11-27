import { randomBytes, randomUUID } from 'node:crypto';
import {
  BOT_NAME_PREFIX,
  BOT_NAMES,
  botThinkMs,
  chooseBotAction,
  createGame,
  defaultGameConfig,
  GameHost,
  randomSeed,
  sanitizeSettings,
  type BotLevel,
  type GameSettings,
  type LobbyInfo,
  type PlayerId,
  type ServerMessage,
} from '@kalamkari/shared';

/** Anything that can receive server messages (a WebSocket in production, a stub in tests). */
export interface Connection {
  send(msg: ServerMessage): void;
}

export interface Member {
  id: PlayerId;
  name: string;
  token: string;
  conn: Connection | null;
  /** Set for computer players, which the room plays itself. */
  bot?: BotLevel;
}

/** How often the room checks whether a bot wants to move. Bots also pause to "think" (botThinkMs). */
const BOT_STEP_MS = 250;

export type RoomError = { code: string; message: string };
const err = (code: string, message: string): RoomError => ({ code, message });
export const isRoomError = (x: Member | RoomError): x is RoomError => !('token' in x);

/**
 * One table: a lobby that becomes a game. Authoritative state lives in a shared GameHost; every
 * member only ever receives projectStateFor(their id).
 */
export class Room {
  private members: Member[] = [];
  private hostId: PlayerId | null = null;
  private settings: GameSettings = {};
  private game: GameHost | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private botTimer: ReturnType<typeof setInterval> | null = null;
  /** Per bot: when it may move next, and the situation it last reacted to. */
  private botDue = new Map<PlayerId, number>();
  private botSeen = new Map<PlayerId, string>();
  lastActive = Date.now();

  constructor(
    readonly code: string,
    private readonly clock: () => number = Date.now,
  ) {}

  get started(): boolean {
    return this.game !== null;
  }

  private get humans(): Member[] {
    return this.members.filter((m) => !m.bot);
  }

  get connectedCount(): number {
    return this.members.filter((m) => m.conn).length;
  }

  join(name: string, conn: Connection): Member | RoomError {
    if (this.game) return err('ROOM_STARTED', 'That game has already started.');
    if (this.members.length >= defaultGameConfig.maxPlayers) return err('ROOM_FULL', 'That room is full.');
    // "BOT " marks computer players, so people can't take it.
    const clean = name.trim().replace(/^bot\s+/i, '').slice(0, 24) || `Player ${this.members.length + 1}`;
    const member: Member = { id: randomUUID().slice(0, 8), name: clean, token: randomBytes(18).toString('base64url'), conn };
    this.members.push(member);
    this.hostId ??= member.id;
    this.touch();
    this.welcome(member);
    this.broadcast();
    return member;
  }

  resume(token: string, conn: Connection): Member | RoomError {
    const member = this.members.find((m) => m.token === token && !m.bot);
    if (!member) return err('BAD_SESSION', 'Your seat in that room no longer exists.');
    member.conn = conn;
    this.touch();
    this.welcome(member);
    if (this.game) this.game.setConnected(member.id, true, this.clock());
    this.broadcast();
    return member;
  }

  /** The socket went away. Only acts if `conn` is still the member's current connection. */
  detach(memberId: PlayerId, conn: Connection): void {
    const member = this.members.find((m) => m.id === memberId);
    if (!member || member.conn !== conn) return;
    member.conn = null;
    if (this.game) {
      this.game.setConnected(memberId, false, this.clock());
      this.schedule();
    }
    this.broadcast();
  }

  /** Explicit leave: frees the seat in the lobby, counts as a disconnect once playing. */
  leave(memberId: PlayerId): void {
    if (this.game) {
      const member = this.members.find((m) => m.id === memberId);
      if (member?.conn) this.detach(memberId, member.conn);
      return;
    }
    this.members = this.members.filter((m) => m.id !== memberId);
    // Bots never host. With no people left, the bots go too.
    if (!this.humans.length) this.members = [];
    if (this.hostId === memberId) this.hostId = this.humans[0]?.id ?? null;
    this.broadcast();
  }

  /** Host only, in the lobby: seat a computer player with a random "BOT <name>". */
  addBot(memberId: PlayerId): RoomError | null {
    const blocked = this.lobbyHostCheck(memberId);
    if (blocked) return blocked;
    if (this.members.length >= defaultGameConfig.maxPlayers) return err('ROOM_FULL', 'The room is full.');
    const taken = new Set(this.members.map((m) => m.name));
    const free = BOT_NAMES.map((n) => BOT_NAME_PREFIX + n).filter((n) => !taken.has(n));
    const name = free.length ? free[Math.floor(Math.random() * free.length)] : `${BOT_NAME_PREFIX}${this.members.length + 1}`;
    this.members.push({ id: randomUUID().slice(0, 8), name, token: randomBytes(18).toString('base64url'), conn: null, bot: 'medium' });
    this.touch();
    this.broadcast();
    return null;
  }

  removeBot(memberId: PlayerId, botId: PlayerId): RoomError | null {
    const blocked = this.lobbyHostCheck(memberId) ?? this.findBot(botId);
    if (blocked) return blocked;
    this.members = this.members.filter((m) => m.id !== botId);
    this.broadcast();
    return null;
  }

  setBotLevel(memberId: PlayerId, botId: PlayerId, level: BotLevel): RoomError | null {
    const blocked = this.lobbyHostCheck(memberId) ?? this.findBot(botId);
    if (blocked) return blocked;
    this.members = this.members.map((m) => (m.id === botId ? { ...m, bot: level } : m));
    this.broadcast();
    return null;
  }

  private lobbyHostCheck(memberId: PlayerId): RoomError | null {
    if (memberId !== this.hostId) return err('NOT_HOST', 'Only the host can add or change bots.');
    if (this.game) return err('ROOM_STARTED', 'The game has already started.');
    return null;
  }

  private findBot(botId: PlayerId): RoomError | null {
    return this.members.some((m) => m.id === botId && m.bot) ? null : err('NO_SUCH_BOT', 'That bot has already left.');
  }

  updateSettings(memberId: PlayerId, input: unknown): RoomError | null {
    if (memberId !== this.hostId) return err('NOT_HOST', 'Only the host can change settings.');
    if (this.game) return err('ROOM_STARTED', 'The game has already started.');
    this.settings = { ...this.settings, ...sanitizeSettings(input) };
    this.broadcast();
    return null;
  }

  start(memberId: PlayerId): RoomError | null {
    if (memberId !== this.hostId) return err('NOT_HOST', 'Only the host can start the game.');
    if (this.game) return err('ROOM_STARTED', 'The game has already started.');
    const res = createGame({
      players: this.members.map((m) => ({ id: m.id, name: m.name })),
      seed: randomSeed(),
      now: this.clock(),
      config: this.settings,
    });
    if (!res.ok) return err(res.error.code, res.error.detail);
    this.game = new GameHost(res.state);
    for (const m of this.members) if (!m.conn && !m.bot) this.game.setConnected(m.id, false, this.clock());
    if (this.members.some((m) => m.bot)) {
      this.botTimer = setInterval(() => this.stepBots(), BOT_STEP_MS);
      this.botTimer.unref?.();
    }
    this.schedule();
    this.broadcast();
    return null;
  }

  act(memberId: PlayerId, action: unknown, reqId?: number): void {
    const member = this.members.find((m) => m.id === memberId);
    if (!member) return;
    if (!this.game) return member.conn?.send({ t: 'error', code: 'NOT_STARTED', message: 'The game has not started.', reqId });
    this.touch();
    // playerId and clock come from the server, never from the client.
    const res = this.game.submit(memberId, action, this.clock());
    if (!res.ok) {
      member.conn?.send({ t: 'error', code: res.error.code, message: res.error.message, reqId });
      return;
    }
    this.schedule();
    this.broadcast();
  }

  /** Runs due timers; exposed for tests. */
  tick(): void {
    if (this.game?.tick(this.clock())) this.broadcast();
    this.schedule();
  }

  /**
   * Lets each bot that is ready make one move, from its own view of the game (it sees no more
   * than a person in its seat). Runs on an interval while a game with bots is on; exposed for tests.
   */
  stepBots(): void {
    const game = this.game;
    if (!game || game.state.phase !== 'playing') return this.stopBots();
    const now = this.clock();
    let changed = false;
    for (const m of this.members) {
      if (!m.bot || game.state.phase !== 'playing') continue;
      const view = game.viewFor(m.id);
      // Something new to react to: pause before reacting, like a person would.
      const seen = [view.turn.playerId, view.turn.number, view.auction?.id, view.auction?.highBid?.amount, view.me?.hand.length].join('|');
      if (seen !== this.botSeen.get(m.id)) {
        this.botSeen.set(m.id, seen);
        if ((this.botDue.get(m.id) ?? 0) <= now) this.botDue.set(m.id, now + botThinkMs(m.bot));
      }
      if (now < (this.botDue.get(m.id) ?? 0)) continue;
      const action = chooseBotAction(view, now, m.bot);
      if (!action) continue;
      this.botDue.set(m.id, now + botThinkMs(m.bot));
      if (game.submit(m.id, action, now).ok) changed = true;
    }
    if (changed) {
      this.schedule();
      this.broadcast();
    }
  }

  private stopBots(): void {
    if (this.botTimer) clearInterval(this.botTimer);
    this.botTimer = null;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopBots();
  }

  lobbyInfo(): LobbyInfo {
    return {
      code: this.code,
      hostId: this.hostId ?? '',
      players: this.members.map((m) => ({ id: m.id, name: m.name, connected: m.conn !== null || !!m.bot, ...(m.bot && { bot: m.bot }) })),
      settings: this.settings,
      started: this.started,
      minPlayers: defaultGameConfig.minPlayers,
      maxPlayers: defaultGameConfig.maxPlayers,
    };
  }

  private welcome(m: Member) {
    m.conn?.send({ t: 'welcome', code: this.code, playerId: m.id, token: m.token });
  }

  private broadcast(): void {
    const lobby = this.lobbyInfo();
    const now = this.clock();
    for (const m of this.members) {
      if (!m.conn) continue;
      m.conn.send({ t: 'lobby', lobby });
      if (this.game) m.conn.send({ t: 'state', view: this.game.viewFor(m.id), serverNow: now });
    }
  }

  /** One timer, armed for the game's next deadline (auction close or turn timeout). */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const due = this.game?.nextDeadline();
    if (due == null) return;
    this.timer = setTimeout(() => this.tick(), Math.max(0, due - this.clock()) + 10);
  }

  private touch() {
    this.lastActive = Date.now();
  }
}
